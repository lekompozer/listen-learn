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
    return ocr_linux(image_path).await;
}

// ── Linux: Tesseract ──────────────────────────────────────────────────────────
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
async fn ocr_linux(image_path: &str) -> Result<String, String> {
    use std::process::Command;

    let tmp_base = format!("/tmp/ll_ocr_tess_{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis());

    let out = Command::new("tesseract")
        .args([image_path, &tmp_base, "-l", "eng+vie", "--psm", "6"])
        .output()
        .map_err(|e| format!("Tesseract not found. Install with: sudo apt install tesseract-ocr tesseract-ocr-vie — error: {e}"))?;

    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }

    let txt_path = format!("{}.txt", tmp_base);
    let text = std::fs::read_to_string(&txt_path).map_err(|e| format!("read output: {e}"))?;
    let _ = std::fs::remove_file(&txt_path);
    let trimmed = text.trim().to_string();
    if trimmed.is_empty() { return Err("OCR returned no text".to_string()); }
    Ok(trimmed)
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

// ── Windows: Windows.Media.Ocr (Win10+) with Tesseract fallback (Win7/8) ─────
#[cfg(target_os = "windows")]
async fn ocr_windows(image_path: &str) -> Result<String, String> {
    use std::process::Command;

    // Try WinRT OcrEngine first (Windows 10+)
    let escaped = image_path.replace('\'', "''");
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
        return Ok(text);
    }

    // WinRT failed (Win7/8 or no language pack) → fallback to Tesseract
    ocr_windows_tesseract(image_path)
}

/// Tesseract fallback for Windows 7/8/older systems without WinRT OCR.
/// Requires `tesseract` to be installed and in PATH.
/// Install: https://github.com/UB-Mannheim/tesseract/wiki
#[cfg(target_os = "windows")]
fn ocr_windows_tesseract(image_path: &str) -> Result<String, String> {
    use std::process::Command;

    // Write output to temp txt file (tesseract appends .txt automatically)
    let tmp_base = format!(
        "{}\\ll_ocr_tess_{}",
        std::env::temp_dir().display(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    let out = Command::new("tesseract")
        .args([image_path, &tmp_base, "-l", "eng+vie", "--psm", "6"])
        .output()
        .map_err(|e| format!("Tesseract not found. Please install from https://github.com/UB-Mannheim/tesseract/wiki — error: {e}"))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(format!("Tesseract OCR failed: {stderr}"));
    }

    let txt_path = format!("{}.txt", tmp_base);
    let text = std::fs::read_to_string(&txt_path)
        .map_err(|e| format!("read tesseract output: {e}"))?;
    let _ = std::fs::remove_file(&txt_path);

    let trimmed = text.trim().to_string();
    if trimmed.is_empty() {
        return Err("OCR returned no text (image may have no readable text)".to_string());
    }
    Ok(trimmed)
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
