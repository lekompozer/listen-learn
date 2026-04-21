/**
 * janChatService.ts
 * Handles AI chat via local llama-server (Jan Mode)
 *
 * Features:
 * - Streams tokens via Tauri events
 * - Tool calling: web_search (Serper) + read_file + list_files
 * - Auto-injects local file content into context when provided
 * - Desktop-only: all invoke() calls are guarded
 */

'use client';

// ---------------------------------------------------------------------------
// Types (shared with Rust)
// ---------------------------------------------------------------------------

export interface HardwareInfo {
    os: string;
    arch: string;
    total_ram_mb: number;
    cpu_cores: number;
    gpus: Array<{ name: string; vram_mb: number; vendor: string }>;
    best_backend: string;
    backend_label: string;
}

export interface JanStatus {
    loaded: boolean;
    model_id: string;
    port: number;
}

export interface ModelInfo {
    id: string;
    name: string;
    path: string;
    size_mb: number;
    family: string;
}

export interface JanPaths {
    jan_data_dir: string | null;
    engines_dir: string | null;
    models_dir: string | null;
    llama_server_bin: string | null;
}

export interface SerperKeyStatus {
    has_key: boolean;
    masked: string;
}

export interface LoadModelRequest {
    model_path: string;
    n_gpu_layers?: number;
    ctx_size?: number;
    threads?: number;
    flash_attn?: boolean;
    cache_type_k?: string;
}

export interface LocalFileInfo {
    name: string;
    path: string;
    size_bytes: number;
    extension: string;
    is_dir: boolean;
}

// Chat message format (OpenAI-compatible)
export interface JanChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_calls?: ToolCallPayload[];
    tool_call_id?: string;
}

export interface ToolCallPayload {
    id: string;
    type: string;
    function: { name: string; arguments: string };
}

// ---------------------------------------------------------------------------
// Tool schemas sent to llama-server
// ---------------------------------------------------------------------------

const SERPER_TOOL = {
    type: 'function',
    function: {
        name: 'web_search',
        description:
            'Search Google for current information, news, recent events, prices, or any real-time data. Use when the user needs information that may have changed recently.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The search query. Be specific and concise.',
                },
                num_results: {
                    type: 'number',
                    description: 'Number of results (1–10). Default: 5.',
                    default: 5,
                },
            },
            required: ['query'],
        },
    },
};

function buildFileTools(folderPath: string) {
    return [
        {
            type: 'function',
            function: {
                name: 'list_files',
                description: `List files available in the local folder: ${folderPath}. Use this to see what documents are available before reading them.`,
                parameters: {
                    type: 'object',
                    properties: {
                        subfolder: {
                            type: 'string',
                            description: 'Optional subfolder path relative to the base folder',
                        },
                    },
                },
            },
        },
        {
            type: 'function',
            function: {
                name: 'read_file',
                description: `Read the content of a specific file from the local folder: ${folderPath}. Supports PDF, DOCX, TXT, MD, CSV.`,
                parameters: {
                    type: 'object',
                    properties: {
                        filename: {
                            type: 'string',
                            description: 'File name or relative path to read',
                        },
                    },
                    required: ['filename'],
                },
            },
        },
    ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Try to extract the intended search query the model wrote inside its <think> block.
 *  Falls back to the raw user question if no pattern is found. */
function extractQueryFromThinking(rawOutput: string, fallback: string): string {
    const thinkMatch = rawOutput.match(/<think>([\s\S]*?)<\/think>/i);
    const thinking = thinkMatch?.[1] ?? rawOutput;

    const patterns: RegExp[] = [
        // web_search("query") or web_search('query')
        /web_search\s*\(\s*["']([^"']{4,120})["']/i,
        // "query": "..."
        /"query"\s*:\s*"([^"]{4,120})"/i,
        // search for "..."
        /search(?:ing)?(?:\s+for)?\s+["']([^"']{4,120})["']/i,
        // tìm kiếm "..."
        /t[iì]m ki[eế]m\s+["']([^"']{4,120})["']/i,
    ];
    for (const pat of patterns) {
        const m = thinking.match(pat);
        if (m?.[1]) return m[1].trim();
    }
    return fallback;
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(opts: {
    folderPath: string | null;
    webSearchEnabled: boolean;
    activeFileContent?: string | null;
    activeFileName?: string | null;
}): string {
    // Inject today's date so model never answers from stale training data
    const now = new Date();
    const dateVi = now.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const dateIso = now.toISOString().split('T')[0]; // e.g. 2026-03-01
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    let prompt = `You are a helpful, knowledgeable AI assistant running locally on this computer. All processing is private — no data is sent to any external server.

Ngày hôm nay: ${dateVi} (${dateIso}, ${timeStr}). Luôn dùng ngày này khi người dùng hỏi về ngày/thời gian hiện tại.

## KIẾN THỨC ĐƠN VỊ VÀNG VIỆT NAM (ghi nhớ chính xác)
- 1 lượng vàng = 37.5 gram (KHÔNG phải 1 kg)
- 1 chỉ vàng = 3.75 gram = 1/10 lượng
- 1 lượng = 10 chỉ = 100 phân
- Trọng lượng này là chuẩn Việt Nam, khác với đơn vị troy ounce quốc tế (1 oz = 31.103g)

Respond in the same language the user writes in. Be concise but thorough.`;

    // If viewing a specific file, inject its content
    if (opts.activeFileContent && opts.activeFileName) {
        // Keep file content under ~2500 tokens (≈10,000 chars) so it fits in
        // a 4096-token context alongside system prompt + conversation + response.
        // Exceeding the llama-server ctx_size causes "error decoding response body".
        const maxChars = 10_000;
        const content =
            opts.activeFileContent.length > maxChars
                ? opts.activeFileContent.slice(0, maxChars) + '\n\n[... nội dung bị cắt ngắn do giới hạn context model]'
                : opts.activeFileContent;

        prompt += `\n\n## Tài liệu đang xem: ${opts.activeFileName}\n\`\`\`\n${content}\n\`\`\`\n\nUser is currently viewing this document. Answer questions about it directly using the content above.`;
    }

    if (opts.folderPath && !opts.activeFileContent) {
        prompt += `\n\n## Local Folder Access\nUser has selected local folder: **${opts.folderPath}**\n- Use \`list_files\` to see available documents\n- Use \`read_file\` to read a specific file's content\n- Only access files when relevant to the user's question`;
    }

    if (opts.webSearchEnabled) {
        prompt += `\n\n## Web Search — BẮT BUỘC dùng \`web_search\` khi:
- Bất kỳ câu hỏi nào về giá cả hôm nay (vàng, cổ phiếu, tiền tệ, xăng dầu, bất động sản...)
- Tin tức, sự kiện, kết quả thể thao, thời tiết năm ${new Date().getFullYear()}
- Thông tin "mới nhất", "hiện tại", "hôm nay", "tuần này", "tháng này"
- Bất kỳ dữ liệu nào có thể thay đổi theo thời gian
- Thông tin sau tháng 9/2024 (training cutoff của model)

KHÔNG được tự đoán hoặc trả lời từ bộ nhớ với những loại câu hỏi trên — PHẢI dùng web_search trước.
Sau khi có kết quả, tóm tắt ngắn gọn và trích dẫn nguồn.`;
    }

    return prompt;
}

// ---------------------------------------------------------------------------
// Main send function — full tool-call loop
// ---------------------------------------------------------------------------

export interface JanSendOptions {
    messages: JanChatMessage[];
    folderPath: string | null;
    webSearchEnabled: boolean;
    // Content of the currently open local file (pre-loaded by caller)
    activeFileContent?: string | null;
    activeFileName?: string | null;
    temperature?: number;
    maxTokens?: number;
    onChunk: (delta: string) => void;
    onToolStatus: (msg: string) => void; // e.g., "🔍 Đang tìm Google..."
    /** Called just before answer generation starts after a proactive search,
     *  so the UI can discard the thinking-only tokens and show a clean answer. */
    onClearStream?: () => void;
    onDone: () => void;
    onError: (err: string) => void;
}

export async function sendJanMessage(opts: JanSendOptions): Promise<void> {
    const { invoke, Channel } = await import('@tauri-apps/api/core');

    // Helper: write a trace message into the native app log (WordAI.log).
    // Visible in ~/Library/Logs/pro.wordai.desktop/WordAI.log without DevTools.
    const dbg = (msg: string) => {
        invoke('jan_debug_log', { msg }).catch(() => {/* ignore if not in Tauri */ });
    };

    dbg(`sendJanMessage START — webSearch=${opts.webSearchEnabled} msgs=${opts.messages.length}`);
    console.log(`[Jan] sendJanMessage — webSearch=${opts.webSearchEnabled} folder=${opts.folderPath} hasFile=${!!opts.activeFileContent} fileName=${opts.activeFileName ?? 'none'} msgs=${opts.messages.length}`);

    // Verify model is loaded
    const status = await invoke<JanStatus>('jan_get_status');
    if (!status.loaded) {
        opts.onError('Chưa load model. Mở Jan Mode panel → chọn model để bắt đầu.');
        return;
    }

    // Build tools list
    const tools: object[] = [];
    if (opts.webSearchEnabled) tools.push(SERPER_TOOL);
    if (opts.folderPath && !opts.activeFileContent) {
        tools.push(...buildFileTools(opts.folderPath));
    }

    // Build system message
    const systemMsg: JanChatMessage = {
        role: 'system',
        content: buildSystemPrompt({
            folderPath: opts.folderPath,
            webSearchEnabled: opts.webSearchEnabled,
            activeFileContent: opts.activeFileContent,
            activeFileName: opts.activeFileName,
        }),
    };

    let currentMessages: JanChatMessage[] = [systemMsg, ...opts.messages];
    const MAX_ITERATIONS = 8;
    // Set to true once we've done a proactive web search so we don't repeat it.
    let proactiveSearchDone = false;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        // ── Channel-based streaming (Tauri v2 recommended) ─────────────────
        // Channel avoids listen() race conditions when loading external URLs.
        // invoke() resolves AFTER Rust sends Done/Error through the channel.
        type JanStreamEvent =
            | { event: 'chunk'; data: { delta: string } }
            | { event: 'done'; data: { finishReason: string; toolCalls?: ToolCallPayload[] } }
            | { event: 'error'; data: { error: string } };

        let accumulatedDelta = '';
        let toolCalls: ToolCallPayload[] = [];
        let finishReason = 'stop';
        let chunkCount = 0;
        const tStart = Date.now();

        // Promise that resolves when channel sends Done/Error
        let resolveStream!: () => void;
        let rejectStream!: (e: Error) => void;
        const streamDone = new Promise<void>((res, rej) => {
            resolveStream = res;
            rejectStream = rej;
        });

        console.log(`[Jan] 🚀 iter=${iteration} — creating channel...`);

        const channel = new Channel<JanStreamEvent>();
        channel.onmessage = (msg) => {
            if (msg.event === 'chunk') {
                chunkCount++;
                if (chunkCount === 1) {
                    console.log(`[Jan] ⚡ First token at ${Date.now() - tStart}ms`);
                }
                accumulatedDelta += msg.data.delta;
                opts.onChunk(msg.data.delta);
            } else if (msg.event === 'done') {
                finishReason = msg.data.finishReason;
                toolCalls = msg.data.toolCalls ?? [];
                const tcLog = toolCalls.length > 0
                    ? `tc[0]="${toolCalls[0]?.function?.name}" args=${toolCalls[0]?.function?.arguments?.slice(0, 80)}`
                    : 'no_tool_calls';
                dbg(`Done iter=${iteration} finish=${finishReason} chunks=${chunkCount} chars=${accumulatedDelta.length} ${tcLog}`);
                console.log(
                    `[Jan] ✅ Done — ${Date.now() - tStart}ms | finish=${finishReason} | chunks=${chunkCount} | chars=${accumulatedDelta.length}`
                );
                resolveStream();
            } else if (msg.event === 'error') {
                console.error(`[Jan] ❌ Stream error: ${msg.data.error}`);
                rejectStream(new Error(msg.data.error));
            }
        };

        try {
            console.log(`[Jan] 📤 Invoking jan_stream_chat...`);
            // invoke() and streamDone both need to complete.
            // invoke resolves when Rust returns Ok(()).
            // streamDone resolves when the Done/Error channel message is processed.
            // Race both — whichever reflects completion last wins.
            await Promise.all([
                invoke('jan_stream_chat', {
                    channel,
                    messages: currentMessages,
                    tools: tools.length > 0 ? tools : null,
                    temperature: opts.temperature ?? 0.7,
                    maxTokens: opts.maxTokens ?? 12000,
                }),
                streamDone,
            ]);
            console.log(`[Jan] 📊 invoke + channel done — total ${Date.now() - tStart}ms`);
        } catch (err) {
            console.error(`[Jan] ❌ invoke failed:`, err);
            opts.onError(String(err));
            return;
        }

        // ── Model wants to call a tool ──────────────────────────────────
        if (finishReason === 'tool_calls' && toolCalls.length > 0) {
            const tc = toolCalls[0];
            dbg(`tool_calls branch: name="${tc.function.name}" args=${tc.function.arguments.slice(0, 100)}`);
            console.log(`[Jan] 🔧 Tool call: name="${tc.function.name}" args=${tc.function.arguments}`);
            let args: Record<string, unknown> = {};
            try {
                args = JSON.parse(tc.function.arguments || '{}');
            } catch (parseErr) {
                dbg(`tool arg parse error: ${String(parseErr)}`);
                console.error(`[Jan] ❌ Failed to parse tool args:`, tc.function.arguments, parseErr);
            }

            let toolResult = '';

            if (tc.function.name === 'web_search') {
                const searchQuery = String(args.query ?? '');
                // ✔ Show UI status BEFORE the await so user sees it immediately
                opts.onToolStatus(`🔍 AI đang tìm kiếm trên internet... / Searching the web...`);
                dbg(`web_search START query="${searchQuery.slice(0, 100)}"`);
                console.log(`[Jan Search] 🌐 web_search query="${searchQuery}" num_results=${args.num_results ?? 5}`);

                const searchStart = Date.now();
                const result = await invoke<string>('jan_web_search', {
                    query: searchQuery,
                    num_results: Number(args.num_results ?? 5),
                }).catch((e) => {
                    const errMsg = String(e);
                    dbg(`web_search ERROR: ${errMsg}`);
                    console.error(`[Jan Search] ❌ web_search error:`, errMsg);
                    return `Search failed: ${errMsg}. Please answer from your own knowledge instead.`;
                });

                dbg(`web_search DONE ${Date.now() - searchStart}ms — ${result.length} chars`);
                console.log(`[Jan Search] ✅ result in ${Date.now() - searchStart}ms — ${result.length} chars`);
                console.log(`[Jan Search] 📋 result preview:\n${result.slice(0, 500)}`);
                toolResult = result;
            } else if (tc.function.name === 'list_files') {
                const dir = opts.folderPath
                    ? args.subfolder
                        ? `${opts.folderPath}/${args.subfolder}`
                        : opts.folderPath
                    : '';
                console.log(`[Jan] 📁 list_files dir="${dir}"`);
                opts.onToolStatus(`📁 Đang liệt kê: ${dir.split('/').pop() ?? dir}...`);
                const files = await invoke<LocalFileInfo[]>('jan_list_files', {
                    folderPath: dir,
                    recursive: false,
                }).catch((e) => {
                    console.error(`[Jan] ❌ list_files error:`, e);
                    return [] as LocalFileInfo[];
                });
                console.log(`[Jan] ✅ list_files → ${files.length} files`);
                toolResult = JSON.stringify(files, null, 2);

            } else if (tc.function.name === 'read_file') {
                const filename = String(args.filename ?? '');
                const filePath = opts.folderPath
                    ? `${opts.folderPath}/${filename}`
                    : filename;
                console.log(`[Jan] 📄 read_file path="${filePath}"`);
                opts.onToolStatus(`📄 Đang đọc: ${filename}...`);
                toolResult = await invoke<string>('jan_read_file', {
                    filePath,
                }).catch((e) => {
                    const errMsg = String(e);
                    console.error(`[Jan] ❌ read_file error for "${filePath}":`, errMsg);
                    return `Lỗi đọc file "${filename}": ${errMsg}`;
                });
                console.log(`[Jan] ✅ read_file → ${toolResult.length} chars`);

            } else {
                console.warn(`[Jan] ⚠️ Unknown tool: ${tc.function.name}`, args);
                toolResult = `Tool "${tc.function.name}" is not available.`;
            }

            console.log(`[Jan] 🔧 Tool "${tc.function.name}" done. toolResult preview: ${toolResult.slice(0, 200)}`);

            // Cap tool results so the next iteration doesn't overflow the
            // llama-server context window. Search results can be verbose —
            // keep them short to leave ample tokens for the model's reply.
            const MAX_TOOL_RESULT = 6_000;
            if (toolResult.length > MAX_TOOL_RESULT) {
                console.warn(`[Jan] ⚠️ Tool result truncated from ${toolResult.length} → ${MAX_TOOL_RESULT} chars`);
                toolResult = toolResult.slice(0, MAX_TOOL_RESULT) + '\n\n[... kết quả bị rút gọn để nhường token cho câu trả lời]';
            }

            opts.onToolStatus('');

            // Append tool interaction to conversation and loop
            currentMessages = [
                ...currentMessages,
                { role: 'assistant', content: accumulatedDelta || '', tool_calls: [tc] },
                { role: 'tool', tool_call_id: tc.id, content: toolResult },
            ];
            console.log(`[Jan] 🔁 Looping iter=${iteration + 1} with ${currentMessages.length} msgs`);

            continue;
        }

        // ── Proactive-search fallback ──────────────────────────────────────
        // Jan-v3-4B (and most small models) don't emit OpenAI-format tool_calls.
        // They either think silently then stop, or output near-nothing.
        //
        // Flow:
        //   1. Model streams → finishes with stop + thin/no real answer
        //   2. We call jan_web_search with the user's question (or refined query
        //      extracted from the model's <think> block)
        //   3. We merge search results INTO the last user message in-place —
        //      this keeps context clean and avoids confusing the small model
        //      with extra assistant/user turns
        //   4. Clear stream UI (discard thinking tokens) + continue → iter N+1
        //   5. Model now has question + fresh search data → generates real answer
        //
        // Guard: only do this once per sendJanMessage call (proactiveSearchDone).
        if (opts.webSearchEnabled && !proactiveSearchDone) {
            const realContent = accumulatedDelta
                .replace(/<think>[\s\S]*?<\/think>/gi, '')
                .trim();
            // Trigger if real (non-thinking) output is too short to be an answer
            const isInsufficientResponse = realContent.length < 80;
            dbg(`proactive check iter=${iteration} realContent=${realContent.length} insufficient=${isInsufficientResponse}`);

            if (isInsufficientResponse) {
                proactiveSearchDone = true;

                // Try to extract the refined query the model wanted to use;
                // fall back to the raw user question
                const lastUserMsg = [...opts.messages].reverse().find((m) => m.role === 'user');
                const rawUserQuestion = lastUserMsg?.content ?? '';
                const searchQuery = extractQueryFromThinking(accumulatedDelta, rawUserQuestion);

                dbg(`proactive search START query="${searchQuery.slice(0, 100)}"`);
                console.log(
                    `[Jan] 🔄 Proactive search — thin response (${realContent.length} chars). query="${searchQuery.slice(0, 80)}"`
                );
                // ✔ Show UI status BEFORE the await so user sees it immediately
                opts.onToolStatus(`🔍 AI đang tìm kiếm trên internet... / Searching the web...`);

                const MAX_TOOL_RESULT = 10_000;
                const searchResult = await invoke<string>('jan_web_search', {
                    query: searchQuery,
                    num_results: 5,
                }).catch((e) => {
                    const errMsg = String(e);
                    dbg(`proactive search ERROR: ${errMsg}`);
                    console.error(`[Jan Search] ❌ proactive search error:`, e);
                    return `Search failed: ${errMsg}. Please answer from your own knowledge.`;
                });

                opts.onToolStatus('');
                dbg(`proactive search result ${searchResult.length} chars`);
                console.log(`[Jan Search] 📋 result preview:\n${searchResult.slice(0, 400)}`);

                const truncated =
                    searchResult.length > MAX_TOOL_RESULT
                        ? searchResult.slice(0, MAX_TOOL_RESULT) + '\n\n[... kết quả bị cắt ngắn]'
                        : searchResult;

                // ── Inject search results into the last user message in-place ──
                // This is cleaner for small models than adding assistant/user turns:
                // the conversation stays simple (system → ... → user+results → answer).
                const lastUserIdx = currentMessages
                    .map((m) => m.role)
                    .lastIndexOf('user');

                if (lastUserIdx !== -1) {
                    const updated = [...currentMessages];
                    updated[lastUserIdx] = {
                        ...updated[lastUserIdx],
                        content:
                            updated[lastUserIdx].content +
                            `\n\n---\n**Kết quả tìm kiếm Google:**\n${truncated}\n---\n` +
                            `Dựa vào kết quả tìm kiếm trên, hãy trả lời câu hỏi.`,
                    };
                    currentMessages = updated;
                }

                // Clear thinking tokens from the stream UI — fresh start for answer
                opts.onClearStream?.();

                console.log(
                    `[Jan] 🔁 Proactive-search loop → iter=${iteration + 1} msgs=${currentMessages.length}`
                );
                continue;
            }
        }

        // ── After proactive search: model still thin → strip tools, force answer ──
        // Rare edge case: model keeps thinking without answering even after having
        // search results. Remove tools from next call so it can't loop further.
        if (proactiveSearchDone) {
            const realContent = accumulatedDelta
                .replace(/<think>[\s\S]*?<\/think>/gi, '')
                .trim();
            if (realContent.length < 80) {
                console.warn(`[Jan] ⚠️ Still thin after search (${realContent.length} chars) — forcing answer without tools`);
                // Remove all tools and append a direct instruction
                tools.length = 0;
                currentMessages = [
                    ...currentMessages,
                    { role: 'assistant', content: accumulatedDelta || '' },
                    { role: 'user', content: 'Hãy trả lời câu hỏi ngay bây giờ dựa trên thông tin đã cung cấp.' },
                ];
                continue;
            }
        }

        // ── Done ─────────────────────────────────────────────────────────────
        opts.onDone();
        return;
    }

    opts.onError('Quá nhiều tool calls liên tiếp. Model có thể đang bị loop.');
}

// ---------------------------------------------------------------------------
// Convenience wrappers (used by components)
// ---------------------------------------------------------------------------

export async function getJanStatus(): Promise<JanStatus> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<JanStatus>('jan_get_status');
}

export async function detectHardware(): Promise<HardwareInfo> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<HardwareInfo>('jan_detect_hardware');
}

export async function listJanModels(): Promise<ModelInfo[]> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<ModelInfo[]>('jan_list_models');
}

export async function loadJanModel(request: LoadModelRequest): Promise<number> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<number>('jan_load_model', { request });
}

export async function unloadJanModel(): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<void>('jan_unload_model');
}

export async function getJanPaths(): Promise<JanPaths> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<JanPaths>('jan_find_paths');
}

export async function getSerperKeyStatus(): Promise<SerperKeyStatus> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<SerperKeyStatus>('jan_get_serper_key_status');
}

export async function setSerperKey(key: string): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<void>('jan_set_serper_key', { key });
}

export async function readLocalFile(filePath: string): Promise<string> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string>('jan_read_file', { filePath });
}

export async function openFolderDialog(): Promise<string | null> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string | null>('jan_open_folder_dialog');
}

export async function listLocalFiles(
    folderPath: string,
    recursive = false
): Promise<LocalFileInfo[]> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<LocalFileInfo[]>('jan_list_files', { folderPath, recursive });
}

// ---------------------------------------------------------------------------
// Model download helpers
// ---------------------------------------------------------------------------

export interface DownloadProgress {
    done: boolean;
    percent: number;
    downloaded_mb?: number;
    total_mb?: number;
    path?: string; // set when done = true
}

/**
 * checkDefaultModel — check if a specific quant is already downloaded.
 * @param quant e.g. "Q4_K_M" (default), "Q3_K_M", "Q5_K_M", "Q8_0"
 */
export async function checkDefaultModel(quant?: string): Promise<string | null> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string | null>('jan_check_default_model', { quant: quant ?? null });
}

export interface NanoQuantInfo {
    quant: string;          // e.g. "Q4_K_M"
    file_name: string;
    path: string | null;    // null = not downloaded yet
    size_mb: number;
    download_url: string;
}

/** List all Jan Nano 4B quants (downloaded + available to download) */
export async function listNanoQuants(): Promise<NanoQuantInfo[]> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<NanoQuantInfo[]>('jan_list_nano_quants');
}

/** Returns build number and app version baked in at compile time.
 *  Use to confirm the running app is the latest build.
 *  Also logs to console automatically on first call. */
export async function getAppBuildInfo(): Promise<{ build: string; version: string }> {
    const { invoke } = await import('@tauri-apps/api/core');
    const info = await invoke<{ build: string; version: string }>('get_app_build_info');
    console.log(`[WordAI Desktop] 🏗️ Version ${info.version} — Build #${info.build}`);
    return info;
}

/** Call once on desktop init to print build info and expose on window for DevTools. */
export function initBuildInfo(): void {
    if (typeof window === 'undefined') return;
    if (!(window as any).__TAURI_DESKTOP__) return;
    getAppBuildInfo()
        .then((info) => {
            (window as any).__WORDAI_BUILD__ = info;
            console.info(
                `%c[WordAI Desktop] v${info.version} build #${info.build}`,
                'color:#a78bfa;font-weight:bold;font-size:13px'
            );
        })
        .catch(() => {/* non-fatal */ });
}

/**
 * Download the default recommended model (or a custom URL).
 * Progress reported via the `jan-download-progress` Tauri event.
 * Also calls `onProgress` callback in-flight.
 *
 * @returns The local path to the downloaded .gguf file
 */
export async function downloadDefaultModel(opts: {
    url?: string;           // if omitted, uses DEFAULT_MODEL_URL in Rust
    quant?: string;         // e.g. "Q4_K_M" — Rust will build URL from this
    destDir?: string;       // custom download folder (full absolute path)
    destDirName?: string;   // subfolder name under ~/jan/models/ (e.g. "qwen3-4b-thinking-2507")
    destFilename?: string;  // custom filename (e.g. Qwen3-4B-Q4_K_M.gguf)
    onProgress?: (p: DownloadProgress) => void;
}): Promise<string> {
    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');

    return new Promise<string>((resolve, reject) => {
        let unlisten: (() => void) | null = null;

        listen<DownloadProgress>('jan-download-progress', (e) => {
            opts.onProgress?.(e.payload);
            if (e.payload.done) {
                unlisten?.();
                if (e.payload.path) resolve(e.payload.path);
                else reject(new Error('Download completed but path missing'));
            }
        }).then((fn) => {
            unlisten = fn;
        });

        invoke<string>('jan_download_model', {
            url: opts.url ?? null,
            destDir: opts.destDir ?? null,
            destDirName: opts.destDirName ?? null,
            destFilename: opts.destFilename ?? null,
        }).catch((err) => {
            unlisten?.();
            reject(new Error(String(err)));
        });
    });
}
