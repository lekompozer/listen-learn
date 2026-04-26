# Phân tích tích hợp Email/Password Auth — Listen & Learn Desktop

**Ngày**: 26/04/2026
**Trạng thái**: Phân tích & kế hoạch triển khai
**Firebase**: `wordai-6779e` — Email/Password provider **đã bật**

---

## 1. Bức tranh tổng thể

### Hiện tại
- Chỉ có **Google OAuth** qua system browser (Tauri invoke `open_google_auth`)
- WKWebView **không hỗ trợ** `signInWithPopup` → bắt buộc dùng system browser cho Google
- Email/Password **không** bị giới hạn bởi WKWebView → có thể xử lý **trực tiếp in-app**

### Sau khi triển khai
- Nút "Đăng nhập" trên LLHeader mở **LoginModal** in-app
- User chọn: **Google** (system browser, luồng cũ) hoặc **Email/Password** (in-app form)
- Luồng Register: email + password + display_name → `createUserWithEmailAndPassword` + `updateProfile`
- Token auto-refresh 50 phút (đã có trong `WordaiAuthContext`)
- Header `User-Agent: WynAI-Desktop/1.0` gửi kèm mọi request API

---

## 2. Thành phần cần tạo/sửa

### 2.1 File mới

| File | Mục đích |
|------|---------|
| `src/components/auth/LoginModal.tsx` | Modal in-app: tab Login / Register + Google button |
| `src/components/auth/EmailAuthForm.tsx` | Form email/password (dùng chung cho login & register) |

### 2.2 File cần sửa

| File | Thay đổi |
|------|---------|
| `src/contexts/WordaiAuthContext.tsx` | Thêm `signInWithEmail()`, `registerWithEmail()`, `signInWithEmailAndPassword` import |
| `src/components/LLHeader.tsx` | Nút "Đăng nhập" → mở `LoginModal` thay vì gọi `signIn()` trực tiếp |
| `src/lib/wordai-firebase.ts` | (Kiểm tra, không cần sửa nếu auth instance đã export) |

---

## 3. Chi tiết triển khai

### 3.1 `WordaiAuthContext.tsx` — Thêm email auth functions

```ts
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    // ... imports hiện có
} from 'firebase/auth';

// Interface cập nhật
interface WordaiAuthContextType {
    // ... các prop hiện có
    signInWithEmail: (email: string, password: string) => Promise<void>;
    registerWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
}

// Trong provider:
const signInWithEmail = async (email: string, password: string) => {
    setIsLoading(true);
    try {
        await persistenceReady;
        const result = await signInWithEmailAndPassword(wordaiAuth, email, password);
        setUser(result.user);
    } catch (err: any) {
        throw mapFirebaseAuthError(err); // helper trả về tiếng Việt
    } finally {
        setIsLoading(false);
    }
};

const registerWithEmail = async (email: string, password: string, displayName: string) => {
    setIsLoading(true);
    try {
        await persistenceReady;
        const result = await createUserWithEmailAndPassword(wordaiAuth, email, password);
        await updateProfile(result.user, { displayName: displayName.trim() });
        setUser({ ...result.user, displayName: displayName.trim() } as User);
    } catch (err: any) {
        throw mapFirebaseAuthError(err);
    } finally {
        setIsLoading(false);
    }
};
```

**Helper map lỗi Firebase → tiếng Việt:**

```ts
function mapFirebaseAuthError(err: any): Error {
    const code = err?.code || '';
    const messages: Record<string, string> = {
        'auth/email-already-in-use':    'Email này đã được đăng ký. Vui lòng đăng nhập.',
        'auth/invalid-email':           'Email không hợp lệ.',
        'auth/weak-password':           'Mật khẩu quá yếu (tối thiểu 6 ký tự).',
        'auth/user-not-found':          'Không tìm thấy tài khoản với email này.',
        'auth/wrong-password':          'Mật khẩu không đúng.',
        'auth/invalid-credential':      'Email hoặc mật khẩu không đúng.',
        'auth/too-many-requests':       'Quá nhiều lần thử. Vui lòng thử lại sau.',
        'auth/network-request-failed':  'Lỗi kết nối mạng. Kiểm tra internet.',
        'auth/user-disabled':           'Tài khoản này đã bị vô hiệu hóa.',
    };
    return new Error(messages[code] || `Lỗi: ${err?.message || code}`);
}
```

---

### 3.2 `LoginModal.tsx` — Modal in-app

**UI**: Giữ nguyên design system hiện tại (dark `bg-gray-800`, border `border-white/10`, v.v.)

```
┌─────────────────────────────────────────────┐
│  🔐  Đăng nhập / Register                  ×│
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  🌐 Đăng nhập với Google             │   │
│  └──────────────────────────────────────┘   │
│                                             │
│          ──── hoặc ────                     │
│                                             │
│  [Đăng nhập]      [Đăng ký]   ← tabs       │
│  ─────────────────────────────              │
│                                             │
│  Email                                      │
│  ┌──────────────────────────────────────┐   │
│  │ user@example.com                     │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  [Register only] Tên hiển thị              │
│  ┌──────────────────────────────────────┐   │
│  │ Nguyễn Văn A                         │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  Mật khẩu                                  │
│  ┌──────────────────────────────────────┐   │
│  │ ••••••••              👁             │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │        Đăng nhập / Đăng ký           │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  errorMessage (text-red-400)                │
└─────────────────────────────────────────────┘
```

**Props:**
```ts
interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    isDark: boolean;
}
```

**State:**
```ts
const [tab, setTab] = useState<'login' | 'register'>('login');
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [displayName, setDisplayName] = useState('');  // register only
const [showPassword, setShowPassword] = useState(false);
const [error, setError] = useState('');
const [isSubmitting, setIsSubmitting] = useState(false);
```

**Flow submit:**
```ts
const handleSubmit = async () => {
    setError('');
    setIsSubmitting(true);
    try {
        if (tab === 'login') {
            await signInWithEmail(email, password);
        } else {
            if (!displayName.trim()) { setError('Vui lòng nhập tên hiển thị'); return; }
            await registerWithEmail(email, password, displayName);
        }
        onClose();
    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsSubmitting(false);
    }
};
```

---

### 3.3 `LLHeader.tsx` — Sửa nút Đăng nhập

**Hiện tại** (line ~398–410):
```tsx
<button onClick={handleLogin} disabled={signingIn} ...>
    <LogIn className="w-3.5 h-3.5" />
    {signingIn ? 'Đang đăng nhập...' : 'Đăng nhập'}
</button>
```

**Sau khi sửa:**
```tsx
// State mới
const [showLoginModal, setShowLoginModal] = useState(false);

// Render
<button
    onClick={() => setShowLoginModal(true)}
    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500
               text-white text-xs font-medium rounded-lg transition-colors active:scale-95"
>
    <LogIn className="w-3.5 h-3.5" />
    {t('Đăng nhập', 'Login', isVietnamese)}
</button>

{/* Modal: createPortal để thoát overflow */}
<LoginModal
    isOpen={showLoginModal}
    onClose={() => setShowLoginModal(false)}
    isDark={isDark}
/>
```

> **Lưu ý**: `handleLogin` cũ (gọi `signIn()` → Google OAuth) được giữ lại bên trong `LoginModal` khi user click nút Google. Không xóa luồng Google.

---

### 3.4 User-Agent Header

Mọi request `fetch` đến `ai.wordai.pro` cần gửi kèm:
```
User-Agent: WynAI-Desktop/1.0
```

**Cách triển khai — thêm vào `wordai-firebase.ts` hoặc tạo `src/lib/apiClient.ts`:**

```ts
// src/lib/apiClient.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://ai.wordai.pro';

const isTauriDesktop = () =>
    typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

export function buildHeaders(token?: string): HeadersInit {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    if (isTauriDesktop()) {
        headers['User-Agent'] = 'WynAI-Desktop/1.0';
    }
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

export async function apiFetch(
    path: string,
    options: RequestInit & { token?: string } = {}
): Promise<Response> {
    const { token, ...rest } = options;
    return fetch(`${API_BASE}${path}`, {
        ...rest,
        headers: {
            ...buildHeaders(token),
            ...(rest.headers || {}),
        },
    });
}
```

**Áp dụng trong services:**
```ts
// conversationLearningService.ts
import { apiFetch } from '@/lib/apiClient';

// Thay fetch(`${API_BASE}/api/...`) bằng:
await apiFetch('/api/v1/conversations/...', {
    method: 'POST',
    token: await getToken(),
    body: JSON.stringify(data),
});
```

> ⚠️ **Lưu ý**: Browsers/WKWebView **không cho phép** override `User-Agent` header từ JS `fetch()` — header sẽ bị bỏ qua theo spec. Cách đúng là cấu hình trong Tauri `tauri.conf.json` → `app.windows[].userAgent` hoặc trong Rust `WebviewBuilder`. Xem mục 4.

---

### 3.5 User-Agent trong Tauri (cách đúng)

File `src-tauri/src/lib.rs` hoặc `tauri.conf.json`:

**Option A — `tauri.conf.json`:**
```json
{
    "app": {
        "windows": [{
            "title": "Listen & Learn",
            "userAgent": "WynAI-Desktop/1.0"
        }]
    }
}
```

**Option B — Rust `lib.rs`:**
```rust
tauri::Builder::default()
    .setup(|app| {
        let window = app.get_webview_window("main").unwrap();
        window.set_user_agent("WynAI-Desktop/1.0")?;
        Ok(())
    })
```

> Tauri v2 hỗ trợ `userAgent` trong config JSON — Option A sạch hơn, không cần Rust code.

---

## 4. Thứ tự triển khai

```
Bước 1: Thêm userAgent vào tauri.conf.json
        → file: src-tauri/tauri.conf.json

Bước 2: Thêm signInWithEmail + registerWithEmail vào WordaiAuthContext
        → file: src/contexts/WordaiAuthContext.tsx

Bước 3: Tạo LoginModal.tsx (Google + Email/Password tabs)
        → file: src/components/auth/LoginModal.tsx

Bước 4: Sửa LLHeader — nút Login mở LoginModal
        → file: src/components/LLHeader.tsx

Bước 5: (Tuỳ chọn) Tạo apiClient.ts helper cho User-Agent từ JS
        → file: src/lib/apiClient.ts
```

---

## 5. Validation rules

| Field | Rule |
|-------|------|
| `email` | `string.includes('@') && string.includes('.')` — basic, Firebase validate kỹ hơn |
| `password` | Tối thiểu 6 ký tự (Firebase yêu cầu) |
| `displayName` | Tối thiểu 2 ký tự, max 50, chỉ required khi register |

---

## 6. Token management (đã có, không cần thêm)

`WordaiAuthContext` đã có:
```ts
// Refresh mỗi 50 phút (token Firebase hết hạn sau 60 phút)
const tokenRefreshInterval = setInterval(async () => {
    if (wordaiAuth.currentUser) {
        await wordaiAuth.currentUser.getIdToken(true); // force=true
    }
}, 50 * 60 * 1000);
```

`getValidToken()` cũng đã có → các service gọi `await getValidToken()` là đủ.

---

## 7. Các điểm quan trọng cần nhớ

1. **WKWebView cho phép** `signInWithEmailAndPassword` — không cần mở browser ngoài
2. **Google OAuth vẫn cần** system browser (Tauri `open_google_auth`) — không thể làm in-app
3. **`createPortal`** bắt buộc cho `LoginModal` vì nó render bên trong `LLHeader` (sticky header với stacking context riêng)
4. **`data-tauri-drag-region` / `WebkitAppRegion: no-drag`** — Modal không cần lo, `fixed inset-0` thoát ra ngoài header
5. **`updateProfile`** phải gọi sau `createUserWithEmailAndPassword` để set `displayName` — Firebase không có field này trong create
6. **Error handling**: Firebase trả `auth/invalid-credential` (không phải `auth/wrong-password`) từ phiên bản Firebase SDK mới → cần handle cả hai
