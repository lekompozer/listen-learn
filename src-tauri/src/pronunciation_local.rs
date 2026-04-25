/// Local pronunciation scoring using whisper.cpp (via whisper-rs).
///
/// Flow:
///   1. Frontend sends raw PCM f32 samples (from WebAudio decodeAudioData)
///   2. Rust runs whisper-rs with temperature=0, initial_prompt=expected_text
///   3. Token-level probabilities → per-word confidence score (Method 2)
///   4. Levenshtein word error rate vs expected_text → accuracy score (Method 1)
///   5. Combined score = 0.6 × token_confidence + 0.4 × word_accuracy
///   6. Returns JSON: { overall_score, transcript, words: [{word, expected, prob, ok}], feedback }
///
/// Model file location (user downloads once, stored in app data dir):
///   macOS: ~/Library/Application Support/pro.wynai.listenlearn/models/ggml-base.en.bin
///
/// Model download URL baked in as MODEL_URL constant below.

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{AppHandle, Manager};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

/// URL for the model file (ggml-base.en ~ 142 MB, great balance of speed vs accuracy).
/// Users can also drop a custom model file at the same path.
const MODEL_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin";

const MODEL_FILENAME: &str = "ggml-base.en.bin";

// Cache the loaded context so we don't reload the model on every call.
static WHISPER_CTX: Mutex<Option<WhisperContext>> = Mutex::new(None);

/// Return the path where the model file should live.
fn model_path(app: &AppHandle) -> PathBuf {
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    data_dir.join("models").join(MODEL_FILENAME)
}

/// Check whether the model file exists on disk.
#[tauri::command]
pub fn check_whisper_model(app: AppHandle) -> bool {
    model_path(&app).exists()
}

/// Return the URL users should download the model from, and the expected local path.
#[tauri::command]
pub fn get_whisper_model_info(app: AppHandle) -> serde_json::Value {
    let path = model_path(&app);
    serde_json::json!({
        "exists": path.exists(),
        "path": path.to_string_lossy(),
        "url": MODEL_URL,
        "filename": MODEL_FILENAME,
        "size_mb": 142,
    })
}

/// Download the model file from HuggingFace into app data dir.
/// Emits progress events: { downloaded_bytes, total_bytes }.
/// Call from TypeScript with invoke('download_whisper_model').
#[tauri::command]
pub async fn download_whisper_model(app: AppHandle) -> Result<String, String> {
    use std::io::Write;
    use tauri::Emitter;

    let path = model_path(&app);
    if path.exists() {
        return Ok(path.to_string_lossy().into_owned());
    }
    // Create parent dirs
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("mkdir failed: {e}"))?;
    }

    let client = reqwest::Client::new();
    let resp = client
        .get(MODEL_URL)
        .send()
        .await
        .map_err(|e| format!("Download request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Download HTTP {}", resp.status()));
    }

    let total = resp.content_length().unwrap_or(0);
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Download read failed: {e}"))?;

    let mut file =
        std::fs::File::create(&path).map_err(|e| format!("File create failed: {e}"))?;
    file.write_all(&bytes)
        .map_err(|e| format!("File write failed: {e}"))?;

    let _ = app.emit(
        "whisper-download-done",
        serde_json::json!({ "total_bytes": total, "path": path.to_string_lossy() }),
    );

    log::info!("[Whisper-local] Model downloaded to {:?}", path);
    Ok(path.to_string_lossy().into_owned())
}

/// Load (or reuse cached) WhisperContext.  Returns Err if model file missing.
fn get_or_load_ctx(model_path: &PathBuf) -> Result<(), String> {
    let mut guard = WHISPER_CTX
        .lock()
        .map_err(|_| "Whisper mutex poisoned".to_string())?;

    if guard.is_some() {
        return Ok(()); // already loaded
    }

    if !model_path.exists() {
        return Err(format!(
            "Model file not found at {:?}. Download it first with download_whisper_model().",
            model_path
        ));
    }

    log::info!("[Whisper-local] Loading model from {:?}", model_path);
    let ctx = WhisperContext::new_with_params(
        &model_path.to_string_lossy(),
        WhisperContextParameters::default(),
    )
    .map_err(|e| format!("Failed to load Whisper model: {e}"))?;

    *guard = Some(ctx);
    log::info!("[Whisper-local] Model loaded OK");
    Ok(())
}

/// Trim leading noise/silence from f32 audio before sending to Whisper.
/// Scans forward in 50ms windows; when a window's peak exceeds the voice threshold,
/// we keep audio starting 100ms before that point (to preserve the word onset).
/// This removes AC fan / ambient recording at the start that confuses Whisper.
fn trim_leading_noise(audio: &[f32]) -> &[f32] {
    const WIN: usize = 800;           // 50ms at 16kHz
    const PEAK_THRESHOLD: f32 = 0.02; // AC fan ≈ 0.005-0.015; quiet voice ≈ 0.05+
    let mut i = 0;
    while i + WIN <= audio.len() {
        let peak = audio[i..i + WIN]
            .iter()
            .map(|x| x.abs())
            .fold(0.0f32, f32::max);
        if peak >= PEAK_THRESHOLD {
            // Keep 100ms before speech onset so we don't clip the first phoneme
            let keep_from = i.saturating_sub(WIN * 2);
            return &audio[keep_from..];
        }
        i += WIN;
    }
    audio // no speech found — return full audio unchanged
}

/// Normalise text for comparison: lowercase, collapse whitespace, strip punctuation.
fn normalise(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| if c.is_alphabetic() || c == '\'' { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Compute Word Error Rate (0.0 = perfect, 1.0 = all wrong) using Levenshtein on word list.
fn word_error_rate(reference: &[&str], hypothesis: &[&str]) -> f32 {
    let r_len = reference.len();
    let h_len = hypothesis.len();
    if r_len == 0 {
        return if h_len == 0 { 0.0 } else { 1.0 };
    }

    // DP edit distance on word level
    let mut dp = vec![vec![0usize; h_len + 1]; r_len + 1];
    for i in 0..=r_len { dp[i][0] = i; }
    for j in 0..=h_len { dp[0][j] = j; }
    for i in 1..=r_len {
        for j in 1..=h_len {
            dp[i][j] = if reference[i - 1] == hypothesis[j - 1] {
                dp[i - 1][j - 1]
            } else {
                1 + dp[i - 1][j - 1].min(dp[i - 1][j]).min(dp[i][j - 1])
            };
        }
    }
    (dp[r_len][h_len] as f32) / (r_len as f32)
}

/// Align hypothesis words to reference words using a simple greedy match,
/// returning per-reference-word data: (matched_hypothesis_word, token_prob).
fn align_words<'a>(
    ref_words: &[&'a str],
    hyp_words: &[(&'a str, f64)],
) -> Vec<WordResult> {
    // Build a flat list of hypothesis words for matching
    let hyp_flat: Vec<(&str, f64)> = hyp_words.to_vec();
    let mut results = Vec::new();
    let mut hyp_idx = 0_usize;

    for &rw in ref_words {
        if hyp_idx >= hyp_flat.len() {
            // Reference word was not found in hypothesis (deleted / missed)
            results.push(WordResult {
                expected: rw.to_string(),
                heard: String::new(),
                prob: 0.0,
                correct: false,
            });
            continue;
        }

        let (hw, prob) = hyp_flat[hyp_idx];
        let correct = rw == hw;
        results.push(WordResult {
            expected: rw.to_string(),
            heard: hw.to_string(),
            prob: (prob * 100.0) as f32,
            correct,
        });
        hyp_idx += 1;
    }

    results
}

#[derive(serde::Serialize)]
pub struct WordResult {
    pub expected: String,
    pub heard: String,
    /// Whisper token confidence 0-100
    pub prob: f32,
    /// true if heard == expected after normalisation
    pub correct: bool,
}

#[derive(serde::Serialize)]
pub struct LocalPronunciationResult {
    pub overall_score: f32,      // 0-100
    pub transcript: String,
    pub expected_text: String,
    pub words: Vec<WordResult>,
    pub feedback: String,
    pub token_score: f32,        // 0-100 (avg token confidence for correct words)
    pub accuracy_score: f32,     // 0-100 (1 - WER)
}

/// Compute RMS energy of a sample window.
#[allow(dead_code)]
#[inline]
fn rms_window(window: &[f32]) -> f32 {
    let sum_sq: f32 = window.iter().map(|s| s * s).sum();
    (sum_sq / window.len() as f32).sqrt()
}

#[allow(dead_code)]
/// Trim leading and trailing silence from 16 kHz mono PCM samples.
/// Returns a slice of the original buffer (zero-copy).
/// Works well for quiet-room recordings (English learners sitting at desk).
fn trim_silence(samples: &[f32]) -> &[f32] {
    const WINDOW: usize = 400;    // 25 ms at 16 kHz — one analysis frame
    const THRESHOLD: f32 = 0.01;  // ~-40 dB — safe floor for quiet rooms
    const PAD: usize = 1600;      // 100 ms padding kept around detected speech

    if samples.len() < WINDOW * 2 {
        return samples; // too short to trim safely
    }

    // Scan forward: find first window whose RMS exceeds threshold
    let start_frame = (0..samples.len().saturating_sub(WINDOW))
        .find(|&i| rms_window(&samples[i..i + WINDOW]) > THRESHOLD)
        .unwrap_or(0);
    let start = start_frame.saturating_sub(PAD);

    // Scan backward: find last window whose RMS exceeds threshold
    let end_frame = (WINDOW..=samples.len())
        .rev()
        .find(|&i| rms_window(&samples[i - WINDOW..i]) > THRESHOLD)
        .unwrap_or(samples.len());
    let end = (end_frame + PAD).min(samples.len());

    if end <= start {
        return samples; // pathological case — no silence found, return whole buffer
    }
    &samples[start..end]
}

/// Warm up the Whisper model at app start (optional — call once from frontend).
/// If the model hasn't been downloaded yet this is a silent no-op.
#[tauri::command]
pub fn preload_whisper_model(app: AppHandle) -> Result<(), String> {
    let path = model_path(&app);
    if !path.exists() {
        return Ok(()); // model not downloaded yet — user will download later
    }
    get_or_load_ctx(&path)?;
    log::info!("[Whisper-local] Model preloaded and cached in RAM");
    Ok(())
}

/// Main Tauri command: score pronunciation locally.
///
/// `audio_pcm_f32` — a JSON array of f32 PCM samples at 16 kHz mono.
///   The frontend produces this via:
///     AudioContext.decodeAudioData(arrayBuffer) → getChannelData(0)
/// `expected_text` — the word/phrase the user tried to say.
#[tauri::command]
pub fn score_pronunciation_local(
    app: AppHandle,
    audio_pcm_f32: Vec<f32>,
    expected_text: String,
) -> Result<LocalPronunciationResult, String> {
    let path = model_path(&app);
    get_or_load_ctx(&path)?;

    let guard = WHISPER_CTX
        .lock()
        .map_err(|_| "Whisper mutex poisoned".to_string())?;
    let ctx = guard.as_ref().ok_or("Whisper context not loaded")?;

    let mut state = ctx
        .create_state()
        .map_err(|e| format!("create_state failed: {e}"))?;

    // Trim leading noise/silence — AC fan / ambient sound before user speaks
    // confuses Whisper and causes first-word loss.
    let trimmed_audio = trim_leading_noise(&audio_pcm_f32);

    // Pad trimmed audio to at least 1.5s — whisper.cpp needs enough context.
    const MIN_SAMPLES: usize = 16000 * 3 / 2; // 1.5s at 16kHz
    let padded: Vec<f32>;
    let audio: &[f32] = if trimmed_audio.len() < MIN_SAMPLES {
        padded = {
            let mut v = trimmed_audio.to_vec();
            v.resize(MIN_SAMPLES, 0.0);
            v
        };
        &padded
    } else {
        trimmed_audio
    };

    // --- Whisper params ---
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_temperature(0.0);
    params.set_temperature_inc(0.0);
    // Initial prompt = expected sentence → biases Whisper toward the correct vocabulary
    params.set_initial_prompt(&expected_text);
    // Enable token-level timestamps + probabilities
    params.set_token_timestamps(true);
    // NOT setting single_segment — can cause empty output on short audio
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_language(Some("en"));

    log::info!(
        "[Whisper-local] audio: {} samples ({:.1}s) trimmed_to={} padded={} expected={:?}",
        audio_pcm_f32.len(),
        audio_pcm_f32.len() as f32 / 16000.0,
        trimmed_audio.len(),
        audio.len() != trimmed_audio.len(),
        expected_text,
    );

    state
        .full(params, audio)
        .map_err(|e| format!("Whisper inference failed: {e}"))?;

    // --- Collect token-level data ---
    let n_segments = state.full_n_segments().map_err(|e| e.to_string())?;
    let mut raw_tokens: Vec<(String, f64)> = Vec::new();
    let mut full_transcript = String::new();

    for seg_idx in 0..n_segments {
        let n_tokens = state
            .full_n_tokens(seg_idx)
            .map_err(|e| e.to_string())?;

        for tok_idx in 0..n_tokens {
            let text = state
                .full_get_token_text(seg_idx, tok_idx)
                .map_err(|e| e.to_string())?;
            let data = state
                .full_get_token_data(seg_idx, tok_idx)
                .map_err(|e| e.to_string())?;

            // Skip special tokens ([_BEG_], [_TT_*]) and noise/event tags
            // (" [birds chirping]", " [BLANK_AUDIO]", etc. have leading space — use trim())
            let trimmed_text = text.trim();
            if trimmed_text.starts_with('[') && trimmed_text.ends_with(']') { continue; }
            let word = trimmed_text.to_string();
            if word.is_empty() { continue; }
            full_transcript.push_str(&text);
            raw_tokens.push((word, data.p as f64));
        }
    }

    // --- Normalise tokens → word-level probabilities ---
    // whisper-rs may emit sub-word tokens (e.g. " love" " app" "les").
    // Merge tokens that don't start with a space into the previous word.
    let mut merged: Vec<(String, f64)> = Vec::new();
    for (tok, prob) in &raw_tokens {
        let clean = tok.trim_start_matches(' ');
        // A token starting with a space = new word boundary
        if tok.starts_with(' ') || merged.is_empty() {
            merged.push((normalise(clean), *prob));
        } else {
            // Append to current word, take min probability (weakest link)
            if let Some(last) = merged.last_mut() {
                last.0.push_str(clean);
                last.1 = last.1.min(*prob);
            }
        }
    }
    // Filter empty
    let hyp_words: Vec<(&str, f64)> = merged
        .iter()
        .filter(|(w, _)| !w.is_empty())
        .map(|(w, p)| (w.as_str(), *p))
        .collect();

    let norm_expected = normalise(&expected_text);
    let ref_words: Vec<&str> = norm_expected.split_whitespace().collect();

    // --- Method 1: Word Accuracy (1 - WER) ---
    let hyp_plain: Vec<&str> = hyp_words.iter().map(|(w, _)| *w).collect();
    let wer = word_error_rate(&ref_words, &hyp_plain);
    let accuracy_score = ((1.0 - wer) * 100.0).clamp(0.0, 100.0);

    // --- Method 2: Token confidence for aligned correct words ---
    let word_results = align_words(&ref_words, &hyp_words);
    let correct_probs: Vec<f32> = word_results
        .iter()
        .filter(|w| w.correct)
        .map(|w| w.prob)
        .collect();
    let token_score = if correct_probs.is_empty() {
        0.0_f32
    } else {
        correct_probs.iter().sum::<f32>() / correct_probs.len() as f32
    };

    // --- Combined score: 60% token confidence + 40% word accuracy ---
    // When transcript is completely wrong (accuracy=0), token confidence is irrelevant.
    // When transcript is perfect, token confidence tells us clarity of articulation.
    let overall_score = (0.6 * token_score + 0.4 * accuracy_score).clamp(0.0, 100.0);

    // --- Human-readable feedback ---
    let feedback = build_feedback(overall_score, &word_results, &full_transcript.trim().to_string(), &expected_text);

    log::info!(
        "[Whisper-local] expected={:?} transcript={:?} accuracy={:.1} token={:.1} overall={:.1}",
        expected_text, full_transcript.trim(), accuracy_score, token_score, overall_score
    );

    Ok(LocalPronunciationResult {
        overall_score,
        transcript: full_transcript.trim().to_string(),
        expected_text: expected_text.clone(),
        words: word_results,
        feedback,
        token_score,
        accuracy_score,
    })
}

fn build_feedback(score: f32, words: &[WordResult], transcript: &str, expected: &str) -> String {
    if transcript.is_empty() {
        return "Không nghe thấy giọng nói — thử lại nhé!".to_string();
    }
    let wrong: Vec<&str> = words
        .iter()
        .filter(|w| !w.correct && !w.expected.is_empty())
        .map(|w| w.expected.as_str())
        .collect();

    if score >= 90.0 {
        format!("🎉 Tuyệt vời! Phát âm \"{}\" rất chuẩn.", expected)
    } else if score >= 75.0 {
        if wrong.is_empty() {
            format!("👍 Tốt lắm! Nghe được: \"{}\".", transcript)
        } else {
            format!("👍 Khá tốt! Chú ý thêm: {}.", wrong.join(", "))
        }
    } else if score >= 50.0 {
        format!(
            "🔄 Cần luyện thêm. Từ cần chú ý: {}.",
            if wrong.is_empty() { "phát âm rõ hơn".to_string() } else { wrong.join(", ") }
        )
    } else {
        format!(
            "💪 Thử lại nhé! AI nghe được: \"{}\". Hãy đọc chậm và rõ hơn.",
            transcript
        )
    }
}
