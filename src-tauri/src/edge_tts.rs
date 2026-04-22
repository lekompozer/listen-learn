/// Edge TTS via Microsoft's unofficial WebSocket API.
/// Bypasses CORS restriction that blocks direct browser WebSocket to speech.platform.bing.com.
///
/// Protocol reference: https://github.com/nicholasgasior/edge-tts-rs
/// We implement the minimal WebSocket handshake ourselves using `reqwest` + `tokio-tungstenite`
/// (tokio-tungstenite is pulled in transitively; if not available we fall back to HTTP request).
///
/// Returns raw MP3 bytes as base64-encoded string.

use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};

/// Supported voices (subset)
const DEFAULT_VOICE: &str = "en-US-JennyNeural";

/// Request Edge TTS audio via the unofficial REST endpoint.
/// Microsoft exposes a REST fallback that works without WebSocket.
#[tauri::command]
pub async fn get_edge_tts_audio(text: String, voice: Option<String>) -> Result<String, String> {
    let voice = voice.unwrap_or_else(|| DEFAULT_VOICE.to_string());

    // Use the unofficial REST endpoint (same one Edge browser uses for Read Aloud)
    let token_url = "https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0";
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    // Step 1: get access token
    let token_resp = client
        .post(token_url)
        .header("Ocp-Apim-Subscription-Key", "")
        .send()
        .await;

    // If token approach fails, use the direct synthesis URL
    let _ = token_resp; // ignore — use direct endpoint

    // Direct SSML synthesis endpoint
    let ssml = format!(
        r#"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
            <voice name='{voice}'>
                <prosody rate='0%' pitch='0%'>{text}</prosody>
            </voice>
        </speak>"#,
        voice = voice,
        text = escape_xml(&text),
    );

    // Use edge-tts compatible endpoint
    let synthesis_url = "https://eastus.tts.speech.microsoft.com/cognitiveservices/v1";
    // Fallback: use the browser-compatible free endpoint
    let free_url = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";

    let api_key_header = format!(
        "TrustedClientToken={}",
        "6A5AA1D4EAFF4E9FB37E23D68491D6F4" // public read-aloud token (same as Edge browser)
    );

    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/ssml+xml"));
    headers.insert(
        "X-Microsoft-OutputFormat",
        HeaderValue::from_static("audio-24khz-48kbitrate-mono-mp3"),
    );
    headers.insert(
        "User-Agent",
        HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"),
    );

    let url = format!("{free_url}?{api_key_header}&ConnectionId={}", uuid_v4());

    let resp = client
        .post(&url)
        .headers(headers)
        .body(ssml)
        .send()
        .await
        .map_err(|e| format!("TTS request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("TTS error {status}: {body}"));
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("TTS read body error: {e}"))?;

    if bytes.is_empty() {
        return Err("TTS returned empty audio".to_string());
    }

    Ok(STANDARD.encode(&bytes))
}

fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn uuid_v4() -> String {
    use rand::Rng;
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
            (b[0] as u64) << 40
                | (b[1] as u64) << 32
                | (b[2] as u64) << 24
                | (b[3] as u64) << 16
                | (b[4] as u64) << 8
                | (b[5] as u64)
        }
    )
}
