/// TTS via macOS built-in `say` command + `afconvert` → AAC/M4A.
/// Replaces the dead Microsoft Edge TTS REST endpoint (404 since 2025).
///
/// Returns AAC/M4A audio as base64-encoded string.
/// On non-macOS platforms returns an error (app is macOS-only for now).

use base64::{engine::general_purpose::STANDARD, Engine};

/// Supported voices (subset) — kept for API compatibility.
const DEFAULT_VOICE: &str = "en-US-JennyNeural";

/// Generate TTS audio using macOS `say` + `afconvert`.
/// Maps Edge voice names to built-in macOS voices.
#[tauri::command]
pub async fn get_edge_tts_audio(text: String, voice: Option<String>) -> Result<String, String> {
    let voice = voice.unwrap_or_else(|| DEFAULT_VOICE.to_string());

    // Map Edge voice names → macOS built-in voices
    let mac_voice = match voice.as_str() {
        "en-US-GuyNeural"       => "Tom",
        "en-GB-SoniaNeural"     => "Kate",
        "en-AU-NatashaNeural"   => "Karen",
        "en-GB-RyanNeural"      => "Daniel",
        _                       => "Samantha",   // en-US-JennyNeural + default
    };

    use rand::Rng;
    let rand_id: u32 = rand::thread_rng().gen();
    let aiff_path = format!("/tmp/ll_tts_{rand_id}.aiff");
    let m4a_path  = format!("/tmp/ll_tts_{rand_id}.m4a");

    // 1. Generate AIFF with macOS `say`
    let say_status = std::process::Command::new("say")
        .args(["-v", mac_voice, "-r", "185", &text, "-o", &aiff_path])
        .status()
        .map_err(|e| format!("say command error: {e}"))?;

    if !say_status.success() {
        return Err("say command returned error".to_string());
    }

    // 2. Convert AIFF → AAC/M4A with built-in `afconvert` (WKWebView supports it)
    let afconvert_status = std::process::Command::new("afconvert")
        .args(["-f", "m4af", "-d", "aac", &aiff_path, &m4a_path])
        .status()
        .map_err(|e| format!("afconvert error: {e}"))?;

    let _ = std::fs::remove_file(&aiff_path);

    if !afconvert_status.success() {
        let _ = std::fs::remove_file(&m4a_path);
        return Err("afconvert failed".to_string());
    }

    // 3. Read + base64 encode + cleanup
    let bytes = std::fs::read(&m4a_path)
        .map_err(|e| format!("read audio file failed: {e}"))?;
    let _ = std::fs::remove_file(&m4a_path);

    if bytes.is_empty() {
        return Err("TTS produced empty audio".to_string());
    }

    Ok(STANDARD.encode(&bytes))
}
