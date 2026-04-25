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
    /// asset:// URL the webview can fetch the file from
    #[serde(rename = "assetUrl")]
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

fn make_asset_url(dest: &PathBuf) -> String {
    // Convert absolute path → asset:// URL that Tauri's asset protocol serves
    // macOS/Linux: asset:///absolute/path
    // Windows:     asset://localhost/C:/path (Tauri handles drive letters)
    let s = dest.to_string_lossy().replace('\\', "/");
    format!("asset://{s}")
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

    // Re-check asset paths are still valid; remove entries whose files were deleted externally
    let files = files_dir(&app).map_err(|e| e.to_string())?;
    lib.books.retain(|b| {
        // Derive filename from asset_url
        let url = &b.asset_url;
        let path = PathBuf::from(url.trim_start_matches("asset://"));
        if path.exists() {
            true
        } else {
            // Also try reconstructing from id
            let ext = match b.book_type.as_str() {
                "epub" => "epub",
                "image" => {
                    let name = &b.original_name;
                    name.rsplit('.').next().unwrap_or("png")
                }
                _ => "pdf",
            };
            files.join(format!("{}.{}", b.id, ext)).exists()
        }
    });

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
    Ok(book.asset_url.clone())
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
    // Remove file
    let asset_path = PathBuf::from(book.asset_url.trim_start_matches("asset://"));
    if asset_path.exists() {
        let _ = std::fs::remove_file(&asset_path);
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
