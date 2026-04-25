# Reading Feature — Technical Implementation Plan

> Tab `Reading` trong DailyVocab sidebar (QUICK ACTIONS, dưới AI Chat, trên Saved).
> Cho phép user import PDF/EPUB/ảnh, lưu local, đọc trong reading mode với SelectionSpeakPopup hoạt động sẵn.
> Hỗ trợ EN + CJK (Trung/Nhật/Hàn) cho truyện tranh.

## 1. Cross-Platform Strategy (Conditional Compilation)

| Concern | macOS Intel/M | Windows | Linux |
|---|---|---|---|
| File copy/list/delete | `std::fs` | `std::fs` | `std::fs` |
| PDF text extract | PDF.js (frontend, text layer) | PDF.js | PDF.js |
| PDF image render | PDF.js canvas | PDF.js canvas | PDF.js canvas |
| EPUB | epubjs (frontend) | epubjs | epubjs |
| OCR (Phase 2) | **Apple Vision Framework** via sidecar binary `macocr` (Swift) | **Windows.Media.Ocr** via `windows` crate | Tesseract (optional, user cài) |
| CJK / vertical text | ✅ native | ✅ native (cần Language Pack) | ⚠️ cần `*_vert.traineddata` |

**Bí quyết**: Phase 1 (MVP) **không cần OCR**. PDF.js và epubjs đã handle 90% use case (PDF text thật + EPUB) trên cả 4 platform với code identical.

## 2. Architecture

### 2.1 Storage layout
```
$APP_LOCAL_DATA/reading/
  files/
    <uuid>.pdf
    <uuid>.epub
    <uuid>.png
  library.json    ← metadata index
```

`library.json` schema:
```json
{
  "books": [
    {
      "id": "uuid-v4",
      "originalName": "harry-potter.pdf",
      "type": "pdf" | "epub" | "image",
      "sizeBytes": 12345678,
      "addedAt": "2026-04-25T10:00:00Z",
      "lastReadAt": "2026-04-25T11:00:00Z",
      "lastPosition": { "page": 42, "scroll": 0.5 }
    }
  ]
}
```

### 2.2 Rust commands (in `src-tauri/src/reading.rs`)

| Command | Args | Returns |
|---|---|---|
| `reading_pick_file()` | — | `Option<{src_path, original_name}>` (uses tauri-plugin-dialog) |
| `reading_import_file(src_path, original_name)` | path | `Book` metadata + new asset URL |
| `reading_list_books()` | — | `Vec<Book>` |
| `reading_get_asset_url(id)` | id | `String` (`asset:` URL for `<embed>` / fetch) |
| `reading_delete_book(id)` | id | `()` |
| `reading_save_position(id, position)` | id, page, scroll | `()` |

**Why `asset:` URL?** Tauri's asset protocol streams files directly from disk to webview without base64 encoding. PDF.js + epubjs accept regular HTTP URLs via fetch.

### 2.3 Frontend

```
src/
  components/
    reading/
      ReadingTab.tsx         ← split view shell
      ReadingLibrary.tsx     ← left pane: book list + import button
      ReadingReader.tsx      ← right pane: dispatcher PDF/EPUB/image
      readers/
        PdfReader.tsx        ← pdfjs-dist render with text layer
        EpubReader.tsx       ← epubjs viewer
        ImageReader.tsx      ← <img> + future OCR overlay
      lib/
        readingStore.ts      ← thin Tauri wrapper, in-memory cache
```

**Selection works for free**: SelectionSpeakPopup already listens `document.mouseup` → any selectable text in reader pane triggers popup.

### 2.4 PDF.js integration

- Package: `pdfjs-dist@^4` — has prebuilt worker in `pdfjs-dist/build/pdf.worker.min.mjs`
- Render strategy: `<canvas>` for image + `<div class="textLayer">` overlay (transparent text positioned over canvas)
  - User sees the visual page but `mouseup` on textLayer text → SelectionSpeakPopup fires
  - Same UX as Adobe Reader / browser PDF viewer
- Worker setup must be `workerSrc = '/pdf.worker.min.mjs'` (file copied to `public/`)
- For Tauri static export: copy worker to `public/pdfjs/` at build time

### 2.5 EPUB integration

- Package: `epubjs@^0.3` (the de-facto standard, used by 1000s of apps)
- Renders via iframe + custom CSS — text is naturally selectable HTML
- Just need to attach `mouseup` listener inside iframe to trigger SelectionSpeakPopup. epubjs API: `rendition.on("selected", (cfiRange, contents) => contents.window.dispatchEvent(...))`

### 2.6 Image / scanned PDF (Phase 2)

UI: when book type is `image` OR PDF page returns no text → show "🔍 Reading Mode" button → run OCR → display extracted text in clean Reading Mode (no images, just selectable text on warm-cream background).

## 3. Phased Implementation

### Phase 1 — MVP (this PR)
1. ✅ Plan doc (this file)
2. Rust: `reading.rs` with import/list/delete/get_asset_url/save_position
3. Frontend: `'reading'` section + ReadingTab + Library + PdfReader + EpubReader
4. Wire SelectionSpeakPopup (no work needed — already global)
5. Capability: allow `dialog:allow-open` (already enabled), `asset:` protocol for reading dir

### Phase 2 — OCR (next PR)
- macOS: ship `macocr` Swift binary as Tauri sidecar
- Windows: `windows` crate + `Windows.Media.Ocr` API + LanguagePack check
- Linux: optional Tesseract (`leptess` crate) — graceful "OCR not available" fallback
- Frontend: button "Trích xuất text → Reading Mode"

### Phase 3 — Comic / vertical CJK (future)
- Click panel of manga page → OCR with `["ja-JP"]` lang hint → overlay bubble with translation

## 4. Dependency Decisions

| Tool | Pick | Rejected | Why |
|---|---|---|---|
| PDF render | **pdfjs-dist** (frontend) | pdfium-render (Rust) | Already cross-platform, mature, text layer is the killer feature. pdfium adds 8-15MB native lib per platform. |
| EPUB | **epubjs** (frontend) | epub-rs | epubjs handles CSS/iframe/pagination; epub-rs only parses, would need to rewrite renderer. |
| Storage | **Tauri `app_local_data_dir`** | Cloud | Local-only as requested. Use `tauri::Manager.path().app_local_data_dir()`. |
| Metadata | **library.json** | SQLite | <1000 books expected, JSON is plenty + easy to debug/migrate. |

## 5. Security / Permissions

- `tauri.conf.json` → already has `dialog: allow-open` (used for OAuth file dialog already)
- `capabilities/main.json` → add `fs:allow-read-text-file`, `fs:allow-write-text-file`, `fs:scope-applocaldata-recursive` if using fs plugin. **Alternative**: do all FS in Rust commands → no extra perms needed.
- **Choice**: pure Rust commands, NO `tauri-plugin-fs` → simpler perm model + no risk of arbitrary file access.

## 6. Build Size Impact

| Platform | Phase 1 | Phase 2 |
|---|---|---|
| macOS DMG | +0 (PDF.js bundled in JS, ~1.5MB to .app) | +0 (Vision native) or +200KB sidecar |
| Windows MSI | +0 | +0 (Windows.Media.Ocr native) |
| Linux deb/AppImage | +0 | +0 if no Tesseract, or user-installed |

## 7. UX Flow

```
[QUICK ACTIONS sidebar]
 ↓ click "Reading"
[ReadingTab — split view]
 ├─ Library (left, 280px)
 │   ├─ "+ Import PDF/EPUB" button
 │   └─ <book cards> sorted by lastReadAt
 └─ Reader (right, flex-1)
     ├─ PDF: canvas + textLayer + page nav
     ├─ EPUB: rendition iframe
     └─ Image: <img> + (Phase 2) "🔍 Extract text"
 ↓ user selects text
[SelectionSpeakPopup] (already global, no changes)
 ├─ Speaker → TTS pronounce
 ├─ Translate → VI
 ├─ Meaning → dictionary
 └─ Try Speak → mic + Whisper score
```

## 8. Files to Create / Modify (Phase 1)

**New:**
- `src-tauri/src/reading.rs`
- `src/components/reading/ReadingTab.tsx`
- `src/components/reading/ReadingLibrary.tsx`
- `src/components/reading/ReadingReader.tsx`
- `src/components/reading/readers/PdfReader.tsx`
- `src/components/reading/readers/EpubReader.tsx`
- `src/components/reading/lib/readingStore.ts`
- `public/pdfjs/pdf.worker.min.mjs` (copied from node_modules at postinstall)

**Modify:**
- `src-tauri/src/lib.rs` — register reading commands
- `src-tauri/Cargo.toml` — add `uuid`, `chrono`
- `src/components/daily-vocab/DailyVocabTab.tsx` — add `'reading'` to VocabSection + QUICK_ACTIONS
- `src-tauri/capabilities/main.json` — add `core:webview:allow-internal-toggle-devtools` if needed for debugging
- `package.json` — add `pdfjs-dist`, `epubjs`
