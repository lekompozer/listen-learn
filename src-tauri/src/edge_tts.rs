/// TTS implementation:
///   1. Edge TTS via WebSocket (wss://speech.platform.bing.com) — works on all platforms
///   2. macOS `say` + `afconvert` — offline fallback (macOS only)
///
/// Return value: tagged string  "mp3:<base64>"  or  "m4a:<base64>"

use base64::{engine::general_purpose::STANDARD, Engine};
use futures_util::{SinkExt, StreamExt};
use rand::Rng;
use tokio_tungstenite::{connect_async, tungstenite::Message};

const DEFAULT_VOICE: &str = "en-US-JennyNeural";
const TTS_TOKEN: &str = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";

#[tauri::command]
pub async fn get_edge_tts_audio(
    text: String,
    voice: Option<String>,
    use_macos_say: Option<bool>,
) -> Result<String, String> {
    let voice = voice.unwrap_or_else(|| DEFAULT_VOICE.to_string());
    get_tts_impl(text, voice, use_macos_say.unwrap_or(false)).await
}

// ── platform split ────────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
async fn get_tts_impl(text: String, voice: String, use_macos_say: bool) -> Result<String, String> {
    if use_macos_say {
        return macos_say_tts(&text, &voice).await;
    }
    // Try Edge TTS up to 2 times before falling back to macOS say
    for attempt in 1u8..=2 {
        match edge_tts_websocket(&text, &voice).await {
            Ok(b64) => return Ok(format!("mp3:{b64}")),
            Err(e) => {
                log::warn!("[TTS] Edge WS attempt {attempt} failed: {e}");
                if attempt < 2 {
                    tokio::time::sleep(std::time::Duration::from_millis(800)).await;
                }
            }
        }
    }
    log::warn!("[TTS] Edge WS failed after 2 attempts, falling back to macOS say");
    macos_say_tts(&text, &voice).await
}

#[cfg(not(target_os = "macos"))]
async fn get_tts_impl(text: String, voice: String, _use_macos_say: bool) -> Result<String, String> {
    match edge_tts_websocket(&text, &voice).await {
        Ok(b64) => Ok(format!("mp3:{b64}")),
        Err(e) => Err(format!("Edge TTS failed: {e}")),
    }
}

// ── Edge TTS WebSocket ────────────────────────────────────────────────────────

async fn edge_tts_websocket(text: &str, voice: &str) -> Result<String, String> {
    use tokio_tungstenite::tungstenite::http::Request;

    let conn_id = uuid_v4();
    let url = format!(
        "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1\
         ?TrustedClientToken={TTS_TOKEN}&ConnectionId={conn_id}"
    );

    let request = Request::builder()
        .uri(&url)
        .header("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold")
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
             (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
        )
        .body(())
        .map_err(|e| format!("WS request build error: {e}"))?;

    let (mut ws, _) = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        connect_async(request),
    )
    .await
    .map_err(|_| "WS connect timeout".to_string())?
    .map_err(|e| format!("WS connect error: {e}"))?;

    let ts = "Tue Apr 22 2025 12:00:00 GMT+0000 (Coordinated Universal Time)";

    // 1. Speech config
    let config_msg = format!(
        "X-Timestamp:{ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n\
         {{\"context\":{{\"synthesis\":{{\"audio\":{{\"metadataoptions\":{{\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"true\"}},\
         \"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}}}}}"
    );
    ws.send(Message::Text(config_msg))
        .await
        .map_err(|e| format!("WS send config: {e}"))?;

    // 2. SSML
    let req_id = uuid_v4_no_dashes();
    let ssml = format!(
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>\
         <voice name='{voice}'><prosody rate='0.8'>{text}</prosody></voice></speak>",
        voice = voice,
        text = escape_xml(text),
    );
    let ssml_msg = format!(
        "X-RequestId:{req_id}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:{ts}Z\r\nPath:ssml\r\n\r\n{ssml}"
    );
    ws.send(Message::Text(ssml_msg))
        .await
        .map_err(|e| format!("WS send ssml: {e}"))?;

    // 3. Collect audio until turn.end
    let mut audio_data: Vec<u8> = Vec::new();
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(60);

    loop {
        if tokio::time::Instant::now() > deadline {
            return Err("WS audio timeout".to_string());
        }
        match tokio::time::timeout(std::time::Duration::from_secs(15), ws.next()).await {
            Ok(Some(Ok(Message::Binary(data)))) => {
                if let Some(start) = find_header_end(&data) {
                    audio_data.extend_from_slice(&data[start..]);
                }
            }
            Ok(Some(Ok(Message::Text(txt)))) => {
                if txt.contains("Path:turn.end") {
                    break;
                }
            }
            Ok(Some(Ok(_))) => {}
            Ok(Some(Err(e))) => return Err(format!("WS recv error: {e}")),
            Ok(None) => break,
            Err(_) => return Err("WS chunk timeout".to_string()),
        }
    }

    if audio_data.is_empty() {
        return Err("Edge TTS: no audio data received".to_string());
    }
    Ok(STANDARD.encode(&audio_data))
}

fn find_header_end(data: &[u8]) -> Option<usize> {
    for i in 0..data.len().saturating_sub(3) {
        if data[i] == b'\r' && data[i + 1] == b'\n' && data[i + 2] == b'\r' && data[i + 3] == b'\n' {
            return Some(i + 4);
        }
    }
    None
}

// ── macOS say ─────────────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
async fn macos_say_tts(text: &str, voice: &str) -> Result<String, String> {
    let mac_voice = match voice {
        "en-US-GuyNeural"       => "Tom",
        "en-GB-SoniaNeural"     => "Kate",
        "en-AU-NatashaNeural"   => "Karen",
        "en-GB-RyanNeural"      => "Daniel",
        _                       => "Samantha",
    };

    let rand_id: u32 = rand::thread_rng().gen();
    let aiff_path = format!("/tmp/ll_tts_{rand_id}.aiff");
    let m4a_path  = format!("/tmp/ll_tts_{rand_id}.m4a");

    let ok = std::process::Command::new("say")
        .args(["-v", mac_voice, "-r", "160", text, "-o", &aiff_path])
        .status()
        .map_err(|e| format!("say error: {e}"))?
        .success();
    if !ok { return Err("say command failed".to_string()); }

    let ok = std::process::Command::new("afconvert")
        .args(["-f", "m4af", "-d", "aac", &aiff_path, &m4a_path])
        .status()
        .map_err(|e| format!("afconvert error: {e}"))?
        .success();
    let _ = std::fs::remove_file(&aiff_path);
    if !ok {
        let _ = std::fs::remove_file(&m4a_path);
        return Err("afconvert failed".to_string());
    }

    let bytes = std::fs::read(&m4a_path).map_err(|e| format!("read failed: {e}"))?;
    let _ = std::fs::remove_file(&m4a_path);
    if bytes.is_empty() { return Err("macOS say: empty audio".to_string()); }
    Ok(format!("m4a:{}", STANDARD.encode(&bytes)))
}

// ── helpers ───────────────────────────────────────────────────────────────────

fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn uuid_v4() -> String {
    let mut rng = rand::thread_rng();
    let bytes: [u8; 16] = rng.gen();
    format!(
        "{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}",
        u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]),
        u16::from_be_bytes([bytes[4], bytes[5]]),
        u16::from_be_bytes([bytes[6], bytes[7]]) & 0x0fff,
        (u16::from_be_bytes([bytes[8], bytes[9]]) & 0x3fff) | 0x8000,
        {
            let b = &bytes[10..16];
            (b[0] as u64) << 40 | (b[1] as u64) << 32 | (b[2] as u64) << 24
                | (b[3] as u64) << 16 | (b[4] as u64) << 8 | b[5] as u64
        }
    )
}

fn uuid_v4_no_dashes() -> String {
    uuid_v4().replace('-', "")
}
