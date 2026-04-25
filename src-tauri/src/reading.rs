/// reading.rs — Local book library for Listen & Learn Reading feature.
///
/// Books are stored in: $APP_LOCAL_DATA/reading/files/<uuid>.<ext>
/// Metadata index:       $APP_LOCAL_DATA/reading/library.json
///
/// All file I/O is in Rust — no tauri-plugin-fs needed, no extra permissions.
/// Frontend gets back `asset://` URLs that Tauri streams directly from disk.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

// ─── Data model ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookPosition {
    pub page: u32,
    pub scroll: f64, // 0.0 – 1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Book {
    pub id: String,
    #[serde(rename = "originalName")]
    pub original_name: String,
    #[serde(rename = "type")]
    pub book_type: String, // "pdf" | "epub" | "image"
    #[serde(rename = "sizeBytes")]
    pub size_bytes: u64,
    #[serde(rename = "addedAt")]
    pub added_at: String,
    #[serde(rename = "lastReadAt")]
    pub last_read_at: Option<String>,
    #[serde(rename = "lastPosition")]
    pub last_position: Option<BookPosition>,
    /// Raw absolute OS path — stored in library.json for path reconstruction
    #[serde(rename = "filePath", default)]
    pub file_path: String,
    /// asset:// URL computed at runtime — NOT stored in library.json
    #[serde(rename = "assetUrl", skip_serializing_if = "String::is_empty", default)]
    pub asset_url: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct Library {
    books: Vec<Book>,
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

fn reading_dir(app: &tauri::AppHandle) -> tauri::Result<PathBuf> {
    let base = app.path().app_local_data_dir()?;
    Ok(base.join("reading"))
}

fn files_dir(app: &tauri::AppHandle) -> tauri::Result<PathBuf> {
    Ok(reading_dir(app)?.join("files"))
}

fn library_path(app: &tauri::AppHandle) -> tauri::Result<PathBuf> {
    Ok(reading_dir(app)?.join("library.json"))
}

fn load_library(app: &tauri::AppHandle) -> tauri::Result<Library> {
    let path = library_path(app)?;
    if !path.exists() {
        return Ok(Library::default());
    }
    let raw = std::fs::read_to_string(&path)?;
    let lib: Library = serde_json::from_str(&raw).unwrap_or_default();
    Ok(lib)
}

fn save_library(app: &tauri::AppHandle, lib: &Library) -> tauri::Result<()> {
    let path = library_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(lib)?;
    std::fs::write(&path, json)?;
    Ok(())
}

fn ext_to_type(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        "pdf" => "pdf",
        "epub" => "epub",
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp" => "image",
        _ => "pdf",
    }
}

/// Replicate JS `encodeURIComponent` — encodes everything except A-Za-z0-9 - _ . ! ~ * ' ( )
fn encode_uri_component(s: &str) -> String {
    let mut result = String::with_capacity(s.len() * 3);
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9'
            | b'-' | b'_' | b'.' | b'!' | b'~' | b'*' | b'\'' | b'(' | b')' => {
                result.push(b as char);
            }
            _ => {
                result.push_str(&format!("%{b:02X}"));
            }
        }
    }
    result
}

fn make_asset_url(dest: &PathBuf) -> String {
    // Match Tauri's convertFileSrc(path) output exactly:
    // macOS/Linux: asset://localhost/<encodeURIComponent(path)>
    // Windows:     http://asset.localhost/<encodeURIComponent(path)>
    let path_str = dest.to_string_lossy();
    let encoded = encode_uri_component(&path_str);
    if cfg!(target_os = "windows") {
        format!("http://asset.localhost/{encoded}")
    } else {
        format!("asset://localhost/{encoded}")
    }
}

// ─── Tauri commands ─────────────────────────────────────────────────────────────

/// Import a file from an arbitrary source path into the reading library.
/// Returns the Book metadata (including assetUrl).
#[tauri::command]
pub async fn reading_import_file(
    app: tauri::AppHandle,
    src_path: String,
    original_name: String,
) -> Result<Book, String> {
    let src = PathBuf::from(&src_path);
    if !src.exists() {
        return Err(format!("File not found: {src_path}"));
    }

    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("pdf")
        .to_string();
    let book_type = ext_to_type(&ext).to_string();
    let id = uuid::Uuid::new_v4().to_string();
    let file_name = format!("{id}.{ext}");

    let dest_dir = files_dir(&app).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    let dest = dest_dir.join(&file_name);

    std::fs::copy(&src, &dest).map_err(|e| format!("Copy failed: {e}"))?;

    let size_bytes = dest.metadata().map(|m| m.len()).unwrap_or(0);
    let now = chrono::Utc::now().to_rfc3339();

    let book = Book {
        id: id.clone(),
        original_name: original_name.clone(),
        book_type,
        size_bytes,
        added_at: now,
        last_read_at: None,
        last_position: None,
        file_path: dest.to_string_lossy().into_owned(),
        asset_url: make_asset_url(&dest),
    };

    let mut lib = load_library(&app).map_err(|e| e.to_string())?;
    lib.books.push(book.clone());
    save_library(&app, &lib).map_err(|e| e.to_string())?;

    log::info!("[Reading] Imported '{}' → {}", original_name, dest.display());
    Ok(book)
}

/// List all books in the library, sorted by lastReadAt desc (most recent first).
#[tauri::command]
pub async fn reading_list_books(app: tauri::AppHandle) -> Result<Vec<Book>, String> {
    let mut lib = load_library(&app).map_err(|e| e.to_string())?;

    // Re-check files still exist; also recompute assetUrl from filePath (migration fix)
    let files_base = files_dir(&app).map_err(|e| e.to_string())?;
    lib.books.retain(|b| {
        // Prefer filePath (new field); fall back to id-based reconstruction
        if !b.file_path.is_empty() {
            PathBuf::from(&b.file_path).exists()
        } else {
            let ext = match b.book_type.as_str() {
                "epub" => "epub",
                "image" => b.original_name.rsplit('.').next().unwrap_or("png"),
                _ => "pdf",
            };
            files_base.join(format!("{}.{}", b.id, ext)).exists()
        }
    });

    // Recompute assetUrl at runtime (so old library.json entries get the correct URL)
    for b in &mut lib.books {
        let path = if !b.file_path.is_empty() {
            PathBuf::from(&b.file_path)
        } else {
            let ext = match b.book_type.as_str() {
                "epub" => "epub",
                "image" => b.original_name.rsplit('.').next().unwrap_or("png"),
                _ => "pdf",
            };
            files_base.join(format!("{}.{}", b.id, ext))
        };
        b.asset_url = make_asset_url(&path);
        if b.file_path.is_empty() {
            b.file_path = path.to_string_lossy().into_owned();
        }
    }

    // Sort: books with lastReadAt first (most recent), then by addedAt desc
    lib.books.sort_by(|a, b| {
        let ta = a.last_read_at.as_deref().unwrap_or(&a.added_at);
        let tb = b.last_read_at.as_deref().unwrap_or(&b.added_at);
        tb.cmp(ta)
    });

    Ok(lib.books)
}

/// Get the asset:// URL for a book. Refreshes the URL in case app path changed.
#[tauri::command]
pub async fn reading_get_asset_url(
    app: tauri::AppHandle,
    id: String,
) -> Result<String, String> {
    let lib = load_library(&app).map_err(|e| e.to_string())?;
    let book = lib
        .books
        .iter()
        .find(|b| b.id == id)
        .ok_or_else(|| format!("Book not found: {id}"))?;
    // Recompute at call time to ensure correct URL format
    let path = if !book.file_path.is_empty() {
        PathBuf::from(&book.file_path)
    } else {
        files_dir(&app)
            .map_err(|e| e.to_string())?
            .join(format!("{}.{}", book.id, book.book_type))
    };
    Ok(make_asset_url(&path))
}

/// Delete a book from the library and remove its file from disk.
#[tauri::command]
pub async fn reading_delete_book(
    app: tauri::AppHandle,
    id: String,
) -> Result<(), String> {
    let mut lib = load_library(&app).map_err(|e| e.to_string())?;
    let pos = lib
        .books
        .iter()
        .position(|b| b.id == id)
        .ok_or_else(|| format!("Book not found: {id}"))?;

    let book = lib.books.remove(pos);
    // Remove the physical file using filePath (never try to parse the asset:// URL)
    if !book.file_path.is_empty() {
        let _ = std::fs::remove_file(&book.file_path);
    } else {
        // Fall back: reconstruct from id
        if let Ok(dir) = files_dir(&app) {
            let ext = match book.book_type.as_str() {
                "epub" => "epub",
                "image" => book.original_name.rsplit('.').next().unwrap_or("png"),
                _ => "pdf",
            };
            let _ = std::fs::remove_file(dir.join(format!("{}.{}", book.id, ext)));
        }
    }

    save_library(&app, &lib).map_err(|e| e.to_string())?;
    log::info!("[Reading] Deleted '{}' ({})", book.original_name, id);
    Ok(())
}

/// Persist the user's reading position (page + scroll offset) for a book.
#[tauri::command]
pub async fn reading_save_position(
    app: tauri::AppHandle,
    id: String,
    page: u32,
    scroll: f64,
) -> Result<(), String> {
    let mut lib = load_library(&app).map_err(|e| e.to_string())?;
    let book = lib
        .books
        .iter_mut()
        .find(|b| b.id == id)
        .ok_or_else(|| format!("Book not found: {id}"))?;

    book.last_position = Some(BookPosition { page, scroll });
    book.last_read_at = Some(chrono::Utc::now().to_rfc3339());

    save_library(&app, &lib).map_err(|e| e.to_string())?;
    Ok(())
}

/// Read a book's raw file bytes and return them as a binary IPC response.
/// The JS caller gets an `ArrayBuffer` — no asset:// URL fetching needed.
#[tauri::command]
pub async fn reading_read_file(
    app: tauri::AppHandle,
    id: String,
) -> Result<tauri::ipc::Response, String> {
    let lib = load_library(&app).map_err(|e| e.to_string())?;
    let book = lib
        .books
        .iter()
        .find(|b| b.id == id)
        .ok_or_else(|| format!("Book not found: {id}"))?;

    let path = if !book.file_path.is_empty() {
        PathBuf::from(&book.file_path)
    } else {
        let ext = match book.book_type.as_str() {
            "epub" => "epub",
            "image" => book.original_name.rsplit('.').next().unwrap_or("png"),
            _ => "pdf",
        };
        files_dir(&app)
            .map_err(|e| e.to_string())?
            .join(format!("{}.{}", book.id, ext))
    };

    if !path.exists() {
        return Err(format!("File not found on disk: {}", path.display()));
    }

    let bytes = std::fs::read(&path).map_err(|e| format!("Read failed: {e}"))?;
    log::info!("[Reading] read_file '{}' ({} bytes)", book.original_name, bytes.len());
    Ok(tauri::ipc::Response::new(bytes))
}
