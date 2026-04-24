mod google_auth;
mod edge_tts;

/// Proxy Cloudflare Workers AI call from Rust to avoid browser CORS restrictions.
/// Credentials come from env vars baked in via build.rs (same as OAuth creds).
#[tauri::command]
async fn call_gemma4(messages: serde_json::Value) -> Result<String, String> {
    let account_id = env!("CF_ACCOUNT_ID");
    let api_key = env!("CF_AI_TOKEN");
    if account_id.is_empty() || api_key.is_empty() {
        log::error!("[Gemma4] CF credentials not baked in — rebuild with NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID and NEXT_PUBLIC_CLOUDFLARE_WORKER_AI_API_KEY in .env.local");
        return Err("Gemma4 credentials missing — please rebuild the app".to_string());
    }
    let model = "@cf/google/gemma-4-26b-a4b-it";
    let url = format!(
        "https://api.cloudflare.com/client/v4/accounts/{}/ai/run/{}",
        account_id, model
    );
    log::info!("[Gemma4] Calling CF Workers AI...");
    let client = reqwest::Client::new();

    // Gemma models on CF Workers AI don't support 'system' role.
    // Extract system message and prepend to first user message instead.
    let messages_arr = messages.as_array().cloned().unwrap_or_default();
    let system_content: Option<String> = messages_arr.iter().find_map(|m| {
        if m.get("role").and_then(|r| r.as_str()) == Some("system") {
            m.get("content").and_then(|c| c.as_str()).map(|s| s.to_string())
        } else { None }
    });
    let mut filtered: Vec<serde_json::Value> = messages_arr.into_iter()
        .filter(|m| m.get("role").and_then(|r| r.as_str()) != Some("system"))
        .collect();
    if let Some(sys) = system_content {
        if let Some(first) = filtered.iter_mut().find(|m| {
            m.get("role").and_then(|r| r.as_str()) == Some("user")
        }) {
            let orig = first["content"].as_str().unwrap_or("").to_string();
            first["content"] = serde_json::Value::String(format!("{sys}\n\n{orig}"));
        }
    }
    let res = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "messages": filtered, "max_tokens": 4000 }))
        .send()
        .await
        .map_err(|e| { log::error!("[Gemma4] Request failed: {e}"); format!("Request failed: {e}") })?;
    let status = res.status();
    if !status.is_success() {
        let code = status.as_u16();
        let body = res.text().await.unwrap_or_default();
        log::error!("[Gemma4] API error {code}: {body}");
        return Err(format!("Gemma4 API error {code}: {body}"));
    }
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    log::info!("[Gemma4] Raw response: {}", data.to_string().chars().take(500).collect::<String>());
    // CF REST API wraps in "result". Gemma4 uses OpenAI-compatible "choices" format.
    let text = data["result"]["response"]
        .as_str()
        .or_else(|| data["result"]["choices"][0]["message"]["content"].as_str())
        .or_else(|| data["choices"][0]["message"]["content"].as_str())
        .unwrap_or("")
        .to_string();
    log::info!("[Gemma4] Response length: {} chars", text.len());
    Ok(text)
}

/// Transcribe audio via Cloudflare Whisper from Rust (no browser CORS, credentials baked in).
/// `audio_base64` is a raw base64-encoded audio file (no data URL prefix).
/// Returns the transcript string.
#[tauri::command]
async fn transcribe_audio(audio_base64: String, language: Option<String>) -> Result<String, String> {
    let account_id = env!("CF_ACCOUNT_ID");
    let api_key = env!("CF_AI_TOKEN");
    if account_id.is_empty() || api_key.is_empty() {
        return Err("CF credentials not baked in — rebuild with CF env vars in .env.local".to_string());
    }
    let url = format!(
        "https://api.cloudflare.com/client/v4/accounts/{}/ai/run/@cf/openai/whisper-large-v3-turbo",
        account_id
    );
    let lang = language.unwrap_or_else(|| "en".to_string());
    use base64::{engine::general_purpose::STANDARD, Engine};
    let audio_bytes = STANDARD.decode(&audio_base64).map_err(|e| format!("base64 decode: {e}"))?;

    let client = reqwest::Client::new();
    let part = reqwest::multipart::Part::bytes(audio_bytes)
        .file_name("audio.webm")
        .mime_str("audio/webm").map_err(|e| e.to_string())?;
    let form = reqwest::multipart::Form::new()
        .part("audio", part)
        .text("language", lang);

    let res = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    if !res.status().is_success() {
        let code = res.status().as_u16();
        let body = res.text().await.unwrap_or_default();
        log::error!("[Whisper] API error {code}: {body}");
        return Err(format!("Whisper API error {code}: {body}"));
    }
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    if !data["success"].as_bool().unwrap_or(false) {
        return Err(format!("Whisper error: {:?}", data["errors"]));
    }
    let text = data["result"]["text"].as_str().unwrap_or("").trim().to_string();
    log::info!("[Whisper] Transcript: {} chars", text.len());
    Ok(text)
}

/// Return the current OS platform string so the frontend can hide platform-specific UI.
#[tauri::command]
fn get_platform() -> &'static str {
    if cfg!(target_os = "macos") { "macos" }
    else if cfg!(target_os = "windows") { "windows" }
    else { "linux" }
}

use tauri::{WebviewWindowBuilder, WebviewUrl};

/// Open a URL in the system default browser (for SePay payment, OAuth, etc.)
#[tauri::command]
async fn open_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}


#[tauri::command]
fn get_app_build_info() -> serde_json::Value {
    serde_json::json!({
        "build": env!("APP_BUILD_NUMBER"),
        "version": env!("CARGO_PKG_VERSION"),
    })
}

/// Compare two semver strings. Returns true if `latest` > `current`.
fn semver_is_newer(latest: &str, current: &str) -> bool {
    let parse = |s: &str| -> (u32, u32, u32) {
        let parts: Vec<u32> = s.split('.').filter_map(|p| p.parse().ok()).collect();
        (
            parts.first().copied().unwrap_or(0),
            parts.get(1).copied().unwrap_or(0),
            parts.get(2).copied().unwrap_or(0),
        )
    };
    parse(latest) > parse(current)
}

/// Fetch latest.json from R2 and compare with current version.
/// Does NOT require signatures — works for all platforms at all times.
/// Returns: { available, latestVersion, currentVersion, downloadUrl, notes }
#[tauri::command]
async fn check_latest_version(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let current = app.package_info().version.to_string();
    let manifest_url = "https://pub-9e0c13107bce4befa1b3def86de29eb0.r2.dev/desktop-ll/latest.json";

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let data: serde_json::Value = client
        .get(manifest_url)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Parse error: {e}"))?;

    let latest = data["version"].as_str().unwrap_or("0.0.0").to_string();
    let available = semver_is_newer(&latest, &current);

    // Pick the right download URL for the current platform/arch
    let platform_key = if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") { "darwin-aarch64" } else { "darwin-x86_64" }
    } else if cfg!(target_os = "windows") {
        "windows-x86_64"
    } else {
        "linux-x86_64"
    };

    let download_url = data["platforms"][platform_key]["url"]
        .as_str()
        .unwrap_or("")
        .to_string();

    log::info!("[Updater] current={current} latest={latest} available={available} platform={platform_key}");

    Ok(serde_json::json!({
        "available": available,
        "latestVersion": latest,
        "currentVersion": current,
        "downloadUrl": download_url,
        "notes": data["notes"].as_str().unwrap_or(""),
    }))
}

#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    use tauri_plugin_updater::UpdaterExt;
    match app.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => Ok(serde_json::json!({
                "available": true,
                "version": update.version,
                "currentVersion": update.current_version,
                "body": update.body,
            })),
            Ok(None) => Ok(serde_json::json!({ "available": false })),
            Err(e) => Err(format!("Update check failed: {e}")),
        },
        Err(e) => Err(format!("Updater unavailable: {e}")),
    }
}

#[tauri::command]
async fn download_and_install_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater().map_err(|e| format!("Updater unavailable: {e}"))?;
    let update = updater.check().await
        .map_err(|e| format!("Update check failed: {e}"))?
        .ok_or_else(|| "Already up to date".to_string())?;
    update.download_and_install(|_downloaded, _total| {}, || {})
        .await
        .map_err(|e| format!("Install failed: {e}"))?;
    app.restart();
}

#[tauri::command]
#[allow(dead_code)]
fn read_audio_files_in_dir(dir_path: String) -> Result<Vec<serde_json::Value>, String> {
    let audio_ext = ["mp3", "flac", "m4a", "wav", "ogg", "aac", "opus", "wma", "aiff",
                      "mp4", "mov", "webm", "mkv", "m4v"];
    let path = std::path::Path::new(&dir_path);
    if !path.is_dir() {
        return Err("Not a directory".to_string());
    }
    let entries = std::fs::read_dir(path).map_err(|e| e.to_string())?;
    let mut files: Vec<serde_json::Value> = entries
        .flatten()
        .filter_map(|e| {
            let p = e.path();
            if !p.is_file() { return None; }
            let ext = p.extension()?.to_str()?.to_lowercase();
            if !audio_ext.contains(&ext.as_str()) { return None; }
            let name = p.file_name()?.to_str()?.to_string();
            let full = p.to_str()?.to_string();
            Some(serde_json::json!({ "path": full, "name": name }))
        })
        .collect();
    files.sort_by(|a, b| {
        a["name"].as_str().unwrap_or("").cmp(b["name"].as_str().unwrap_or(""))
    });
    Ok(files)
}

/// Copy a list of files into the app's managed playlists directory.
/// Creates `{app_data_dir}/playlists/{playlist_id}/` if it doesn't exist.
/// Returns the destination paths so the caller can build asset:// URLs.
#[tauri::command]
#[allow(dead_code)]
async fn copy_files_to_playlist_dir(
    app: tauri::AppHandle,
    playlist_id: String,
    file_paths: Vec<String>,
) -> Result<Vec<serde_json::Value>, String> {
    use tauri::Manager;
    let app_data = app.path().app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    let dest_dir = app_data.join("playlists").join(&playlist_id);
    std::fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for src in &file_paths {
        let src_path = std::path::Path::new(src);
        let file_name = src_path.file_name()
            .ok_or_else(|| format!("No filename: {src}"))?
            .to_string_lossy()
            .to_string();

        // Avoid collisions: if the file already exists, add a numeric suffix
        let mut dest = dest_dir.join(&file_name);
        if dest.exists() {
            let stem = src_path.file_stem().unwrap_or_default().to_string_lossy().to_string();
            let ext = src_path.extension()
                .map(|e| e.to_string_lossy().to_string())
                .unwrap_or_default();
            let mut counter = 1u32;
            loop {
                let new_name = if ext.is_empty() {
                    format!("{stem}_{counter}")
                } else {
                    format!("{stem}_{counter}.{ext}")
                };
                dest = dest_dir.join(&new_name);
                if !dest.exists() { break; }
                counter += 1;
            }
        }

        std::fs::copy(src_path, &dest).map_err(|e| e.to_string())?;
        result.push(serde_json::json!({
            "srcPath": src,
            "destPath": dest.to_string_lossy().to_string(),
        }));
    }
    Ok(result)
}

#[tauri::command]
fn js_log(level: String, msg: String) {
    match level.as_str() {
        "error" => log::error!("[JS] {}", msg),
        "warn"  => log::warn!("[JS] {}", msg),
        _       => log::info!("[JS] {}", msg),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // tauri-plugin-localhost only needed in production to serve ../out/ at port 3002.
    // In dev mode, Next.js already runs on port 3002 — adding the plugin would cause a port conflict.
    #[cfg(not(dev))]
    let builder = builder.plugin(tauri_plugin_localhost::Builder::new(3002).build());

    builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            // In production, tauri-plugin-localhost serves ../out/ via HTTP at port 3002.
            // Using ExternalUrl makes window.location.origin = "http://localhost:3002"
            // which is the same origin as dev mode.
            // Both dev and prod load via http://localhost:3002.
            // In prod: tauri-plugin-localhost serves ../out/ at port 3002.
            // In dev: Next.js dev server runs at port 3002 (started by beforeDevCommand).
            // WebviewUrl::App("index.html") would load /index.html which 404s in Next.js dev server.
            let webview_url = WebviewUrl::External(
                "http://localhost:3002".parse().expect("invalid localhost url"),
            );

            let builder = WebviewWindowBuilder::new(
                app,
                "main",
                webview_url,
            )
            .title("WynAI Listen & Learn")
            .inner_size(1100.0, 780.0)
            .min_inner_size(800.0, 600.0)
            .center()
            .resizable(true)
            // Spoof Safari UA so YouTube iframe accepts the embedded player
            .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15")
            .initialization_script(
                "window.__TAURI_DESKTOP__ = true; \
                 window.__WORDAI_ERRORS__ = []; \
                 (function() { \
                   var _origError = console.error.bind(console); \
                   var _origWarn  = console.warn.bind(console); \
                   function _fwdLog(level, args) { \
                     try { \
                       var msg = Array.from(args).map(function(a){ \
                         return (a instanceof Error) ? (a.message + ' ' + a.stack) : String(a); \
                       }).join(' '); \
                       window.__TAURI_INTERNALS__ && \
                         window.__TAURI_INTERNALS__.invoke('js_log', { level: level, msg: msg }); \
                     } catch(e) {} \
                   } \
                   console.error = function() { _origError.apply(console, arguments); _fwdLog('error', arguments); }; \
                   console.warn  = function() { _origWarn.apply(console, arguments);  _fwdLog('warn',  arguments); }; \
                 })(); \
                 console.log('[WynAI Listen&Learn] v0.1.0 desktop runtime active');"
            )
            // Enable DevTools in all builds for debugging
            .devtools(true);

            // macOS-only: hidden title bar — shows traffic lights but no title text,
            // content fills the full window height. MusicHeader sits below the traffic lights.
            #[cfg(target_os = "macos")]
            let builder = builder
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .hidden_title(true);

            let _window = builder.build()?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_build_info,
            check_latest_version,
            check_for_updates,
            download_and_install_update,
            open_url,
            google_auth::open_google_auth,
            read_audio_files_in_dir,
            copy_files_to_playlist_dir,
            edge_tts::get_edge_tts_audio,
            call_gemma4,
            transcribe_audio,
            get_platform,
            js_log,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Listen & Learn");
}
