# Study Buddy — Phân Tích Kiến Trúc & Kế Hoạch Tích Hợp

## 1. Bảo Mật D1: Có Thể Gọi Trực Tiếp Từ App/Web Không?

### Kết luận ngắn gọn: **KHÔNG. D1 không bao giờ gọi trực tiếp từ client được.**

### Giải thích kiến trúc

```
Client (App/Web)
     │
     │  HTTPS  (Bearer Firebase ID token)
     ▼
Cloudflare Worker  ← db-wordai-community.hoangnguyen358888.workers.dev
     │
     │  verifyFirebaseToken(idToken)
     │  → POST https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=FIREBASE_API_KEY
     │
     │  D1 binding (native Cloudflare internal)
     ▼
Cloudflare D1 Database  (wordai_community)
```

**Tại sao không gọi D1 trực tiếp?**

| Lý do | Chi tiết |
|---|---|
| **Kiến trúc Cloudflare** | D1 chỉ accessible qua `env.DB` binding — một Cloudflare-internal protocol, không có HTTP endpoint công khai |
| **Không có SQL-over-HTTP** | Không giống Firebase Firestore/RTDB, D1 không expose REST API hay WebSocket |
| **Bảo mật token** | Nếu có HTTP API, cũng cần service account credentials — không thể embed an toàn vào client |
| **Authorization layer** | Worker là nơi duy nhất check `is_host`, `member status`, `squad visibility` — bỏ Worker = mất authorization |

### Flow Auth (Firebase → Worker → D1)

```
1. User login với Firebase Google OAuth
2. wordaiAuth.currentUser.getIdToken()  →  "eyJhbGciOi..."  (JWT, expires 1h)
3. Client → Worker: Authorization: Bearer eyJhbGciOi...
4. Worker → Firebase API:
   POST identitytoolkit.googleapis.com/v1/accounts:lookup?key=FIREBASE_API_KEY
   Body: { idToken: "eyJhbGciOi..." }
5. Firebase trả về: { users: [{ localId: "uid123", email: "...", displayName: "..." }] }
6. Worker xác nhận uid → query D1
7. Worker trả về JSON cho client
```

**Kết luận**: Vẫn phải dùng Firebase `getIdToken()` → gửi lên Worker. Không có shortcut.

---

## 2. "Gọi D1 từ Rust" — Phân Tích Khả Thi

### Yêu cầu gốc: "gọi đến DB1 tại Rust để khỏi cần liên quan đến backend"

**Interpret đúng**: Không cần `ai.wordai.pro` backend (Python FastAPI) — gọi thẳng Cloudflare Worker.
**Không phải**: Gọi D1 raw SQL từ Rust (không thể về mặt kỹ thuật).

### So sánh 3 cách gọi

| Cách | Mô tả | Ưu | Nhược |
|---|---|---|---|
| **A. TypeScript → Worker** | `fetch()` trong WebView JS | Đơn giản, Firebase token có sẵn, CORS cho phép `tauri://` | Token nằm trong WebView |
| **B. Rust → Worker** | Tauri command dùng `reqwest` | Token quản lý phía native | Firebase token **nằm trong WebView JS** — để lấy token sang Rust phải invoke TypeScript→Rust, thêm complexity |
| **C. Rust caching proxy** | Rust nhận token từ TS, cache, forward sang Worker | Có thể offline cache | Over-engineering cho use case này |

### Khuyến nghị: **Dùng cách A — TypeScript gọi thẳng Worker**

**Lý do:**
- CORS của Worker đã whitelist `tauri://` origin
- Firebase token (`getIdToken()`) có sẵn trong WebView JS context
- Không cần Rust command mới, không thêm dependency (`reqwest`) vào Cargo.toml
- Bảo mật tương đương — vẫn HTTPS, vẫn Firebase auth
- Cách B chỉ thêm complexity mà không tăng bảo mật thực sự (token vẫn từ WebView phát ra)

> **"Không cần backend"** = Không dùng `ai.wordai.pro/api/v1/squads` (Python FastAPI cũ).
> Dùng trực tiếp `db-wordai-community.hoangnguyen358888.workers.dev/api/squads` (Cloudflare Worker mới).

---

## 3. So Sánh Squad (Web) vs Study Buddy (Listen-Learn)

### 3.1 Kiến trúc hiện tại của Squad trên Web

```
wordai web (SquadClient.tsx)
    └── squadService.ts  →  https://ai.wordai.pro/api/v1/squads  ← Python FastAPI (CŨ)
```

**Vấn đề**: `squadService.ts` trên web đang dùng **backend cũ** (`ai.wordai.pro`), không phải D1 Worker mới.
Web Squad chưa được migrate sang D1. Study Buddy sẽ là **implement đầu tiên dùng D1 Squad API**.

### 3.2 So sánh Schema

| Trường | Old Web Squad | New D1 Squad (Study Buddy) |
|---|---|---|
| `category` | `social`, `sports`, `learning`, `travel`, `talk`, `others` | `listening`, `speaking`, `reading`, `writing`, `grammar`, `vocabulary`, `ielts`, `toeic`, `toefl`, `general` |
| Location | `city`, `country`, `isOnline` | **Không có** (tất cả online) |
| Cover | `coverGradient` + `coverEmoji` (emoji) | `cover_url` (real image URL) |
| Host | `hostName`, `hostAvatar` (emoji) | `host_nickname`, `host_avatar_url` (real URL) |
| Member count | `memberCount`, `pendingCount`, `spotsLeft` (computed) | `member_count`, `pending_count` (auto via trigger), `spots_left` (computed) |
| Messages | Không có | `squad_messages` bảng (broadcast + DM) |
| Notifications | Không có | `squad_notifications` bảng |
| Status | Không có | `active`, `cancelled`, `completed` |

### 3.3 HomeShell — Vấn đề "thiếu"

Web `SquadClient.tsx` **không** import `HomeShell` — nó tự render `min-h-screen` container.
Listen-Learn đã có `HomeShell.ts` stub (passthrough, không cần nav shell).
**Không có vấn đề HomeShell** khi port sang Listen-Learn.

---

## 4. Kế Hoạch Tích Hợp Study Buddy

### 4.1 Cấu trúc Files Mới

```
listen-learn/src/
  services/
    studyBuddyService.ts        ← NEW: API calls đến db-wordai-community worker
  components/
    study-buddy/
      StudyBuddyTab.tsx         ← NEW: UI chính (adapted từ SquadClient.tsx)
      SquadCard.tsx             ← NEW: Card component (adapted)
      SquadDetailModal.tsx      ← NEW: Detail modal (adapted)
      CreateSquadModal.tsx      ← NEW: Create form (simplified, no location)
      HistoryModal.tsx          ← NEW: My squads (hosted + joined)
      NotificationsPanel.tsx    ← NEW: In-app notifications
```

### 4.2 studyBuddyService.ts — API Mapping

```typescript
const WORKER_URL = 'https://db-wordai-community.hoangnguyen358888.workers.dev';
const API = `${WORKER_URL}/api/squads`;

// Auth: Firebase token (same pattern as all other services)
async function getToken(): Promise<string | null> {
    const { wordaiAuth } = await import('@/lib/wordai-firebase');  // hoặc listen-learn firebase
    return wordaiAuth.currentUser?.getIdToken() ?? null;
}
```

**Endpoints sẽ dùng** (tất cả từ Worker đã có sẵn):

| Chức năng | Endpoint |
|---|---|
| List squads | `GET /api/squads?category=&search=&sort=latest&limit=20` |
| Chi tiết squad | `GET /api/squads/:id` (auth optional) |
| Tạo squad | `POST /api/squads` (auth required) |
| Apply tham gia | `POST /api/squads/:id/apply` |
| Huỷ apply | `DELETE /api/squads/:id/apply` |
| Rời nhóm | `POST /api/squads/:id/leave` |
| Xem applicants (host) | `GET /api/squads/:id/applicants` |
| Accept/Reject (host) | `POST /api/squads/:id/applicants/:memberId/accept|reject` |
| Kick member (host) | `DELETE /api/squads/:id/members/:memberId` |
| My hosted squads | `GET /api/squads/my/hosted` |
| My joined squads | `GET /api/squads/my/joined` |
| Squad chat | `POST/GET /api/squads/:id/messages` |
| Notifications | `GET /api/squads/notifications` |
| Mark read | `PATCH /api/squads/notifications/:id/read` |

### 4.3 Types (D1 Schema Response)

```typescript
// Categories dùng cho Study Buddy (học tập only)
export type StudyCategory =
    | 'listening' | 'speaking' | 'reading' | 'writing'
    | 'grammar' | 'vocabulary' | 'ielts' | 'toeic' | 'toefl' | 'general';

export interface StudySquad {
    id: string;
    title: string;
    description: string;
    category: StudyCategory;
    host_id: string;
    host_nickname: string;
    host_avatar_url: string | null;
    cover_url: string | null;
    max_members: number;
    member_count: number;      // auto-updated by DB trigger
    pending_count: number;     // auto-updated by DB trigger
    spots_left: number;        // computed: max_members - member_count
    tags: string[];            // stored as JSON string in DB, parsed in service
    join_conditions: string;
    deadline: string | null;
    status: 'active' | 'cancelled' | 'completed';
    is_online: boolean;
    created_at: string;
    updated_at: string;
    // Injected by GET /api/squads/:id when auth present:
    my_status?: 'pending' | 'accepted' | 'rejected' | 'left' | null;
    is_host?: boolean;
}

export interface StudyMember {
    id: string;
    squad_id: string;
    user_id: string;
    nickname: string;
    avatar_url: string | null;
    status: 'host' | 'pending' | 'accepted' | 'rejected' | 'left';
    message: string | null;
    applied_at: string;
    joined_at: string | null;
}

export interface SquadNotification {
    id: string;
    squad_id: string;
    type: string;           // 'accepted' | 'rejected' | 'new_applicant' | 'cancelled' | 'kicked' | 'message'
    title: string;
    body: string;
    data: Record<string, unknown>;
    is_read: boolean;
    created_at: string;
}
```

### 4.4 StudyBuddyTab.tsx — Khác Biệt Với SquadClient.tsx

| Feature | Web SquadClient | Study Buddy |
|---|---|---|
| Categories | All (social, sports...) | **Chỉ học tập** (10 categories cố định) |
| Location picker | Có (city/country dropdown) | **Không** (all squads are online) |
| Category "all" | Có tab "Tất cả" | Có nhưng mặc định là `general` |
| Cover image upload | Gradient + emoji | Có thể giữ gradient/emoji hoặc dùng category emoji |
| Tags | Tự do | Tự do (liên quan đến học tập) |
| Chat | Không có | **Có** (`squad_messages`) |
| Notifications | Không có | **Có** (`squad_notifications` + badge) |
| Search | Có | Có |
| Sort | Theo city/country | Theo category + search |

### 4.5 Firebase Config trong Listen-Learn

Listen-Learn dùng Firebase project `wordai-6779e` (shared với wordai.pro).
File: `src/lib/wordai-firebase.ts` (đã có).
```typescript
import { wordaiAuth } from '@/lib/wordai-firebase';
const token = await wordaiAuth.currentUser?.getIdToken();
```

---

## 5. Checklist Implement

- [ ] **`studyBuddyService.ts`** — types + API calls → Worker (không dùng ai.wordai.pro)
- [ ] **`StudyBuddyTab.tsx`** — UI chính, categories filter, card grid
- [ ] **`SquadCard.tsx`** — card hiển thị squad info
- [ ] **`SquadDetailModal.tsx`** — chi tiết + apply + chat + applicants (host view)
- [ ] **`CreateSquadModal.tsx`** — form tạo squad (simplified, no location)
- [ ] **`HistoryModal.tsx`** — my hosted + my joined
- [ ] **`NotificationsPanel.tsx`** — in-app notifications với badge count
- [ ] **Thêm tab "Study Buddy"** vào `ListenLearnApp.tsx` / navigation

## 6. Rủi ro & Lưu ý

| Rủi ro | Giải pháp |
|---|---|
| Worker CORS `tauri://` | Đã whitelist trong db-wordai-community/src/index.ts |
| Firebase token expire (1h) | `getIdToken()` tự refresh — gọi mỗi request, không cache |
| Squad tags stored as TEXT | Cần `JSON.parse(row.tags ?? '[]')` trong service layer |
| Image upload cho squad cover | Dùng `POST /api/upload/image-token` → Cloudflare Images (đã có trong Worker) |
| Squad notifications không dùng Firebase Push | In-app only — cần poll `GET /api/squads/notifications` khi tab active, hoặc dùng interval |
