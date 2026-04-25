# GitHub Copilot Instructions — Listen & Learn

## Project Overview
`listen-learn` is a **standalone Tauri v2 desktop app** (macOS/Windows/Linux) for language learning.
Built with Next.js 15 (static export) + React 19 + TypeScript + Tailwind CSS.

- **Production URL**: `https://learn.wynai.pro`
- **Tauri identifier**: `pro.wynai.listenlearn`
- **App name**: `Listen & Learn`
- **Dev port**: `3001` (Next.js)
- **GitHub**: sibling to `wordai`, `wordai-music`, `wyncode-ai`

## Tech Stack
- **Desktop**: Tauri v2, Rust
- **Frontend**: Next.js 15 (static export `output: 'export'`), React 19, TypeScript
- **Styling**: Tailwind CSS (dark mode first)
- **Auth**: Firebase + Google OAuth (Tauri system browser via `google_auth.rs`)
- **Backend API**: `https://ai.wordai.pro`
- **Speech**: Cloudflare Workers AI (Whisper), Google Gemini 2.5 Flash Lite (premium STT)
- **AI Chat**: DeepSeek + Gemma4 + full ChatSidebar (system-wide AI Chat component)

## Critical Rules

### ⚠️ Version Bump — MANDATORY on every push
```bash
# Edit both files — keep them in sync:
# 1. src-tauri/tauri.conf.json  →  "version": "0.1.X"
# 2. src-tauri/Cargo.toml       →  version = "0.1.X"
```

### Tauri API — ALWAYS dynamic import
```ts
if (isTauriDesktop()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('some_command');
}
// NEVER: import { invoke } from '@tauri-apps/api/core';
```

## App Structure

### Entry Point
```
src/app/page.tsx → ListenLearnApp (dynamic, no SSR)
src/components/ListenLearnApp.tsx → root shell: header + tab router
```

### Top-Level Navigation Tabs (`TabType`)
| Tab | Component | Description |
|-----|-----------|-------------|
| `daily-vocab` | `DailyVocabTab` | Main vocab tab with sidebar (see below) |
| `songs` | Song player | Listen to songs |
| `conversations` | Conversation practice | AI conversation training |
| `podcast` | Podcast player | Listen to podcasts |
| `videos` | Video feed | Educational videos |

Tab state is persisted in `localStorage` key `ll_active_tab`.

---

## DailyVocabTab — Sidebar Structure

**File**: `src/components/daily-vocab/DailyVocabTab.tsx`

`DailyVocabTab` has a **left nav rail** (`VocabNavRail`) with sections (`VocabSection` type):

```ts
type VocabSection = 'daily-vocab' | 'usage-plan' | 'ai-chat' | 'wynai-music'
                  | 'wyncode' | 'ai-learning' | 'online-tests' | 'saved'
                  | 'speak' | 'study-buddy';
```

### Nav Rail Groups

**Quick Actions:**
| Section | Icon | Component |
|---------|------|-----------|
| `online-tests` | Award | Online Tests |
| `ai-chat` | MessageCircle | `AIChatEmbed` (full ChatSidebar) |
| `saved` | Bookmark | Saved vocabulary |

**Practice:**
| Section | Icon | Component |
|---------|------|-----------|
| `speak` | Volume2 | `SpeakWithAITab` — pronunciation + speaking practice |
| `study-buddy` | Users | Study group |
| FreeTalk | Mic | (not yet implemented, `null` id) |

**Discover:**
| Section | Icon | Component |
|---------|------|-----------|
| `ai-learning` | GraduationCap | WynAI Tutor — math/problem solving |
| `wynai-music` | Music | Embedded WynAI Music player |
| `wyncode` | Code2 | Embedded WynCode AI |

**System:**
| Section | Icon | Component |
|---------|------|-----------|
| `usage-plan` | FileText | Plan & Usage stats |

**Default section**: `daily-vocab` (vocab card feed with For You / topic lists)

---

## SpeakWithAITab (`section === 'speak'`)

**File**: `src/components/speak-with-ai/SpeakWithAITab.tsx`

Full-featured spoken English practice. Features:
- **Mic recording** with STT: Cloudflare Whisper (free, 10k/month) + Gemini STT (premium)
- **AI conversation** with DeepSeek / Gemma4
- **Topic-based practice**: set a topic, AI gives contextual responses
- **Pronunciation feedback**: listen to AI voice, compare pronunciation
- **Grammar check**: AI grades user responses
- **Conversation history**: persistent, stored in IndexedDB via `useSpeakConversations`
- **Free/Premium quota**: `FREE_LIMIT` messages/day, `PREMIUM_MONTHLY_LIMIT`
- **AI Chat Widget**: floating `AIChatEmbed` (isWidget mode) for phrase prep during conversation

### AI Chat Widget in SpeakWithAITab

The widget uses the **full system `ChatSidebar`** (not a custom mini-chat) via `AIChatEmbed`:
```tsx
// State
const [isAIChatMinimized, setIsAIChatMinimized] = useState(false);

// Render (fixed bottom-right, no portal needed — ChatSidebar handles positioning)
<AIChatEmbed
    isDark={isDark}
    isWidget={!isAIChatMinimized}
    isMinimized={isAIChatMinimized}
    onToggleMinimize={() => setIsAIChatMinimized(prev => !prev)}
/>
```
- `isWidget=true` → floating popup (`fixed bottom-6 right-6`, 425×600px, glassmorphism)
- `isMinimized=true` → floating round button (`fixed bottom-6 right-6`)
- Both rendered directly in JSX (no `createPortal` needed — `position:fixed` escapes overflow naturally)

---

## AIChatEmbed Component

**File**: `src/components/embeds/AIChatEmbed.tsx`

Wraps `ChatSidebar` for use outside the documents page.

```ts
interface AIChatEmbedProps {
    isDark: boolean;
    isMinimized?: boolean;   // true → floating button mode
    isWidget?: boolean;       // true → floating popup mode (425×600px)
    initialRequirements?: string;
    onToggleMinimize?: () => void;  // callback to toggle minimized ↔ widget
}
```

**Behavior:**
- `isWidget || isMinimized` → renders `ChatSidebar` directly (no wrapper div), since it's `fixed` positioned
- Normal mode → renders inside a `div` container with `ResizeObserver` for width tracking

**Features via ChatSidebar:**
- Full AI provider selection (GPT-4o, Claude, Gemini, DeepSeek...)
- Conversation history with sidebar
- Quote/template system
- Document analysis mode

---

## ChatSidebar Component

**File**: `src/app/documents/components/ChatSidebar.tsx`

The **system-wide AI chat** component. Key props:
```ts
isMinimized?: boolean     // renders floating button (fixed bottom-6 right-6 z-50)
isWidget?: boolean        // renders floating popup (fixed bottom-6 right-6 z-50)
onToggleMinimize?: () => void  // toggles between minimized ↔ widget
```

Used in:
- Documents page (full sidebar, non-widget)
- AI Chat section (`ai-chat` nav item) via `AIChatEmbed`
- Speak with AI floating widget via `AIChatEmbed`

---

## File Structure
```
src/
  app/
    layout.tsx              ← Root layout
    page.tsx                ← Loads ListenLearnApp dynamically
    globals.css
    documents/
      components/
        ChatSidebar.tsx     ← System AI chat (isWidget/isMinimized modes)
        AILearningPageClient.tsx  ← Math/problem solving tutor
    community/              ← Community features
    login/                  ← Login page
    desktop-auth/           ← OAuth callback (Tauri)
    usage/                  ← Usage stats page
  components/
    ListenLearnApp.tsx      ← Shell: header + tab router (TabType)
    LLHeader.tsx            ← App header (sticky, includes tab nav)
    daily-vocab/
      DailyVocabTab.tsx     ← Main tab with VocabNavRail sidebar
    speak-with-ai/
      SpeakWithAITab.tsx    ← Speaking practice + AIChatEmbed widget
    study-buddy/            ← Study group
    songs/                  ← Songs player
    conversations/          ← Conversation practice
    podcast/                ← Podcast player
    videos/                 ← Video feed
    embeds/
      AIChatEmbed.tsx       ← Wrapper for ChatSidebar (widget/minimized/inline)
    online-tests/           ← Online test runner
  contexts/
    AppContext.tsx           ← ThemeProvider + LanguageProvider
    AppProviders.tsx         ← All providers
    WordaiAuthContext.tsx    ← Firebase auth
  hooks/
    useSpeechRecognition.ts
    useSpeakConversations.ts ← Conversation history (IndexedDB)
    useDeepSeekChat.ts      ← DeepSeek + Gemma4 AI calls
    useEdgeTTS.ts           ← Text-to-speech
  services/
    musicService.ts
  lib/
    wordai-firebase.ts

src-tauri/
  src/
    lib.rs                  ← run(), window setup
    google_auth.rs          ← Google OAuth via system browser
    main.rs
  tauri.conf.json           ← identifier: pro.wynai.listenlearn
  Cargo.toml
```

## Development

```bash
# Install
npm install

# Dev (Tauri hot reload)
npm run dev:desktop  # or bash scripts/dev.sh

# Production build
bash scripts/build-desktop.sh
```

`.env.local` required. Required vars:
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=wordai-6779e
NEXT_PUBLIC_API_URL=https://ai.wordai.pro
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID=...
NEXT_PUBLIC_VERTEX_API_KEY=...  # Gemini STT
```

## Color / UI Conventions
Dark palette: `bg-gray-800`, `bg-gray-900`, `bg-[#0b0f19]`, `text-white`.
Accent: teal (`teal-500/600`) for speaking features, purple (`purple-600`) for AI chat.

## Audio Patterns

### STT (Speech-to-Text) — Two tiers
1. **Flash (free)**: Cloudflare Workers AI → `@cf/openai/whisper-large-v3-turbo` (10k/month)
2. **Premium**: Gemini 2.5 Flash Lite via Vertex AI (requires `NEXT_PUBLIC_VERTEX_API_KEY`)
- User can toggle via `usePremiumMode` (saved in `localStorage`)

### TTS (Text-to-Speech)
- `playBase64Audio` via Edge TTS API at `ai.wordai.pro`
- `speakWithSynthesis` — browser Web Speech API fallback

## Modal Pattern (same as wordai)
- Backdrop: `fixed inset-0 ... flex items-center justify-center` — NO `overflow-y-auto`
- Card: `max-h-[90vh] flex flex-col`
- Body: `flex-1 overflow-y-auto`
- Always use `createPortal(content, document.body)`

## Commit & Push
```bash
git add -A && git commit -m "feat: ..." && git push
```
