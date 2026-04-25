/// ocr.rs — Native OCR using platform system APIs.
///
/// macOS : Vision framework via `swift` subprocess (no extra deps)
/// Windows: Windows.Media.Ocr via PowerShell WinRT bridge
/// Linux  : returns error (no built-in OCR)
///
/// Tauri command: `ocr_extract_text(image_path: String) -> Result<String, String>`

#[tauri::command]
pub async fn ocr_extract_text(image_path: String) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    return ocr_macos(&image_path).await;

    #[cfg(target_os = "windows")]
    return ocr_windows(&image_path).await;

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    Err("OCR is not supported on this platform".to_string())
}

// ── macOS: Vision framework via Swift ────────────────────────────────────────
#[cfg(target_os = "macos")]
async fn ocr_macos(image_path: &str) -> Result<String, String> {
    use std::process::Command;

    // Inline Swift script — uses VNRecognizeTextRequest from Vision framework
    let escaped = image_path.replace('\\', "\\\\").replace('"', "\\\"");
    let script = format!(
        r#"import Vision
import Foundation
let url = URL(fileURLWithPath: "{path}")
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["en-US", "vi"]
let handler = VNImageRequestHandler(url: url, options: [:])
try? handler.perform([request])
let observations = request.results as? [VNRecognizedTextObservation] ?? []
let text = observations.compactMap {{ $0.topCandidates(1).first?.string }}.joined(separator: "\n")
print(text)
"#,
        path = escaped
    );

    // Write to temp file (swift -e doesn't support Framework imports)
    let tmp = format!("/tmp/ll_ocr_{}.swift", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis());

    std::fs::write(&tmp, &script).map_err(|e| format!("write tmp: {e}"))?;

    let out = Command::new("swift")
        .arg(&tmp)
        .output()
        .map_err(|e| format!("swift not found — install Xcode Command Line Tools: {e}"))?;

    let _ = std::fs::remove_file(&tmp);

    if out.status.success() {
        let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if text.is_empty() { return Err("OCR returned no text (image may have no readable text)".to_string()); }
        Ok(text)
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

// ── Windows: Windows.Media.Ocr via PowerShell ────────────────────────────────
#[cfg(target_os = "windows")]
async fn ocr_windows(image_path: &str) -> Result<String, String> {
    use std::process::Command;

    let escaped = image_path.replace('\'', "''");

    // PowerShell script using WinRT OcrEngine
    let script = format!(r#"
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime

# Helper to synchronously await WinRT IAsyncOperation
function Await($async, $type) {{
    $task = [System.WindowsRuntimeSystemExtensions].GetMethods() |
        Where-Object {{ $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and !$_.IsGenericMethod }} |
        Select-Object -First 1
    ($task.MakeGenericMethod($type)).Invoke($null, @($async)) | Out-Null
    ($task.MakeGenericMethod($type)).Invoke($null, @($async)).Result
}}

$path = '{path}'
$file   = Await([Windows.Storage.StorageFile]::GetFileFromPathAsync($path)) ([Windows.Storage.StorageFile])
$stream = Await($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$dec    = Await([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bmp    = Await($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$result = Await($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
Write-Output $result.Text
"#,
        path = escaped
    );

    let out = Command::new("powershell")
        .args(["-NonInteractive", "-Command", &script])
        .output()
        .map_err(|e| e.to_string())?;

    if out.status.success() {
        let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if text.is_empty() { return Err("OCR returned no text".to_string()); }
        Ok(text)
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

/// ocr_extract_text_base64 — accepts a base64-encoded PNG/JPEG image,
/// writes it to a temp file, runs OCR, then cleans up.
#[tauri::command]
pub async fn ocr_extract_text_base64(image_base64: String) -> Result<String, String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(image_base64.trim())
        .map_err(|e| format!("base64 decode: {e}"))?;

    // Write to temp PNG
    let tmp = format!(
        "/tmp/ll_ocr_region_{}.png",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );
    std::fs::write(&tmp, &bytes).map_err(|e| format!("write tmp: {e}"))?;

    let result = ocr_extract_text(tmp.clone()).await;
    let _ = std::fs::remove_file(&tmp);
    result
}
