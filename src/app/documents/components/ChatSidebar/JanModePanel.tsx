'use client';

/**
 * JanModePanel — shown inside ChatSidebar when aiProvider === 'jan'
 *
 * Responsibilities:
 * 1. On first open: check if any model is loaded / downloaded
 * 2. If no model found locally → offer 1-click download of Jan-v3-4B Q4_K_M (~2.7 GB)
 * 3. Once model present → load it into llama-server (hardware-optimised)
 * 4. Show status indicator + Unload button
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Cpu, Download, Play, Square, RefreshCw, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import {
    getJanStatus,
    detectHardware,
    listJanModels,
    loadJanModel,
    unloadJanModel,
    checkDefaultModel,
    downloadDefaultModel,
    initBuildInfo,
    type JanStatus,
    type ModelInfo,
    type HardwareInfo,
    type DownloadProgress,
} from '@/services/jan/janChatService';

const isTauriDesktop = (): boolean => {
    if (typeof window === 'undefined') return false;
    return !!(window as any).__TAURI_DESKTOP__;
};

export type JanModelFamily = 'jan-v3-4b' | 'qwen3-4b' | 'qwen3-1.7b' | 'jan-v3-4b-q3' | 'qwen3.5-4b' | 'flux2-klein-4b' | 'phi3-mini-4k';

/** Returns true if the given family is an image-generation model (not a chat LLM) */
export const isImageModelFamily = (f: JanModelFamily): boolean => f === 'flux2-klein-4b';

export interface JanCustomModelData {
    id: string;
    label: string;
    url: string;
}

interface JanModePanelProps {
    isDark: boolean;
    language?: 'vi' | 'en';
    preferredFamily?: JanModelFamily;
    preferredCustomModel?: JanCustomModelData | null;
    onFamilyChange?: (f: JanModelFamily) => void;
    /** Called when an image-generation model (FLUX.2) finishes loading or is detected as ready */
    onImageModelReady?: (modelDir: string | null) => void;
}

type PanelState =
    | 'checking'        // initial check
    | 'no-model'        // no GGUF found anywhere
    | 'downloading'     // auto-download in progress
    | 'model-ready'     // model present, not yet loaded into llama-server
    | 'loading'         // loading model into llama-server
    | 'loaded'          // server running
    | 'error';          // something failed

export const JanModePanel: React.FC<JanModePanelProps> = ({ isDark, language = 'vi', preferredFamily, preferredCustomModel, onFamilyChange, onImageModelReady }) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    // Log build number once on mount so DevTools shows which build is running
    useEffect(() => { initBuildInfo(); }, []);
    const [panelState, setPanelState] = useState<PanelState>('checking');
    const [janStatus, setJanStatus] = useState<JanStatus | null>(null);
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [selectedModelPath, setSelectedModelPath] = useState<string>('');
    const [hardware, setHardware] = useState<HardwareInfo | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [isExpanded, setIsExpanded] = useState(true);
    const [selectedFamily, setSelectedFamily] = useState<JanModelFamily>(preferredFamily ?? 'jan-v3-4b');

    // Sync preferred family from parent (model picker in provider dropdown)
    // Also re-evaluate whether the new family's model exists locally.
    useEffect(() => {
        if (!preferredFamily) return;
        setSelectedFamily(preferredFamily);
        // Don't interrupt active operations
        if (['checking', 'loading', 'downloading'].includes(panelState)) return;

        const meta = FAMILY_META[preferredFamily];

        // If a model of this family is already loaded, nothing to do
        if (panelState === 'loaded') {
            const loadedId = janStatus?.model_id ?? '';
            const matchesFamily =
                loadedId.includes(meta.destDirName ?? '') ||
                loadedId.toLowerCase().includes(meta.name.toLowerCase().replace('.gguf', ''));
            if (!matchesFamily) {
                // Different family loaded — let user know they need to switch.
                // Check if that family's model is already on disk; if not → no-model so user can download.
                const diskModel = models.find(m =>
                    m.path.includes(meta.destDirName ?? '') ||
                    m.name.toLowerCase() === meta.name.toLowerCase()
                );
                if (diskModel) {
                    setSelectedModelPath(diskModel.path);
                    setPanelState('model-ready');
                } else {
                    setPanelState('no-model');
                }
            }
            return;
        }

        // For model-ready / no-model / error states: check if this family's model is on disk
        const diskModel = models.find(m =>
            m.path.includes(meta.destDirName ?? '') ||
            m.name.toLowerCase() === meta.name.toLowerCase()
        );
        if (diskModel) {
            setSelectedModelPath(diskModel.path);
            setPanelState('model-ready');
        } else if (models.length > 0 || panelState === 'model-ready') {
            // We have other models but not this family → show download UI for this family
            setPanelState('no-model');
        }
        // If models === [] and panelState is already no-model: selectedFamily update is enough,
        // the download button label will re-render automatically.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preferredFamily]);

    // Model metadata for each family (Q4_K_M quant)
    const FAMILY_META = {
        'jan-v3-4b': {
            name: 'Jan-v3-4b-base-instruct-Q4_K_M.gguf',
            label: 'Jan-v3-4B',
            url: null as string | null, // uses Rust default
            destDirName: 'jan-v3-4b' as string | null,
            destFilename: null as string | null,
            size_mb: 2720,
            family: 'Jan-v3',
            ram: '>8 GB',
            desc: 'Đa năng, cân bằng tốc độ/chất lượng',
            modelType: 'llm' as 'llm' | 'image',
        },
        'qwen3-4b': {
            name: 'Qwen3-4B-Q4_K_M.gguf',
            label: 'Qwen3-4B Thinking',
            // unsloth repo — public, no auth required (bartowski/Qwen3-4B-Thinking-2507-GGUF returns 401)
            url: 'https://huggingface.co/unsloth/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf?download=true',
            destDirName: 'qwen3-4b' as string | null,
            destFilename: 'Qwen3-4B-Q4_K_M.gguf' as string | null,
            size_mb: 2500,
            family: 'Qwen3',
            ram: '>12 GB',
            desc: 'Reasoning mạnh, thinking model',
            modelType: 'llm' as 'llm' | 'image',
        },
        'qwen3-1.7b': {
            name: 'Qwen3-1.7B-Q4_K_M.gguf',
            label: 'Qwen3-1.7B',
            // unsloth repo — public, no auth required (bartowski/Qwen3-1.7B-GGUF returns 401)
            url: 'https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf?download=true',
            destDirName: 'qwen3-1.7b' as string | null,
            destFilename: 'Qwen3-1.7B-Q4_K_M.gguf' as string | null,
            size_mb: 1100,
            family: 'Qwen3',
            ram: '8–12 GB',
            desc: 'Nhỏ gọn, chạy nhanh trên RAM thấp',
            modelType: 'llm' as 'llm' | 'image',
        },
        'jan-v3-4b-q3': {
            name: 'Jan-v3-4b-base-instruct-Q3_K_L.gguf',
            label: 'Jan-v3-4B Q3_K_L',
            // Use the official janhq repo (same pattern as Q4_K_M default — avoids gated bartowski repo)
            url: 'https://huggingface.co/janhq/Jan-v3-4B-base-instruct-gguf/resolve/main/Jan-v3-4b-base-instruct-Q3_K_L.gguf?download=true',
            destDirName: 'jan-v3-4b-q3' as string | null,
            destFilename: 'Jan-v3-4b-base-instruct-Q3_K_L.gguf' as string | null,
            size_mb: 2200,
            family: 'Jan-v3',
            ram: '6–8 GB',
            desc: 'Tiết kiệm RAM nhất, tối ưu chạy máy yếu',
            modelType: 'llm' as 'llm' | 'image',
        },
        'qwen3.5-4b': {
            name: 'Qwen3.5-4B-Q4_K_M.gguf',
            label: 'Qwen3.5-4B 🆕',
            // unsloth repo — public, confirmed HTTP 302 (no auth required)
            url: 'https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf?download=true',
            destDirName: 'qwen3.5-4b' as string | null,
            destFilename: 'Qwen3.5-4B-Q4_K_M.gguf' as string | null,
            size_mb: 2740,
            family: 'Qwen3.5',
            ram: '>10 GB',
            desc: 'Mới nhất Qwen3.5 — multimodal, reasoning, 262K ctx',
            modelType: 'llm' as 'llm' | 'image',
        },
        'phi3-mini-4k': {
            name: 'Phi-3-mini-4k-instruct-q4.gguf',
            label: 'Phi-3 Mini 4K 🆕',
            // microsoft/Phi-3-mini-4k-instruct-gguf — MIT license, public
            url: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf?download=true',
            destDirName: 'phi3-mini-4k' as string | null,
            destFilename: 'Phi-3-mini-4k-instruct-q4.gguf' as string | null,
            size_mb: 2200,   // Q4_K_M = 2.2 GB
            family: 'Phi-3',
            ram: '4–6 GB',
            desc: 'Microsoft Phi-3 Mini — nhỏ gọn nhất, 4K ctx, MIT license',
            modelType: 'llm' as 'llm' | 'image',
        },
        'flux2-klein-4b': {
            name: 'FLUX.2-klein-base-4B-Q4_K_M.gguf',
            label: 'FLUX.2 Klein 4B 🎨',
            // unsloth/FLUX.2-klein-base-4B-GGUF — Apache 2.0, public
            url: 'https://huggingface.co/unsloth/FLUX.2-klein-base-4B-GGUF/resolve/main/FLUX.2-klein-base-4B-Q4_K_M.gguf?download=true',
            destDirName: 'flux2-klein-4b' as string | null,
            destFilename: 'FLUX.2-klein-base-4B-Q4_K_M.gguf' as string | null,
            size_mb: 2600,   // transformer only ~2.6 GB; full model dir ~16 GB (needs VAE + Qwen3-4B encoder)
            family: 'FLUX.2',
            ram: '>16 GB',
            desc: 'Tạo ảnh từ text/ảnh — cần ~16 GB RAM, dùng iris.c',
            modelType: 'image' as 'llm' | 'image',
        },
    } as const;

    /** Extract a friendly short label from a model path/filename.
     *  e.g. ~/jan/models/qwen3-1.7b/Qwen3-1.7B-Q4_K_M.gguf → "Qwen3-1.7B" */
    const getModelLabel = (modelIdOrPath: string | undefined): string => {
        if (!modelIdOrPath) return 'Local AI';
        const filename = modelIdOrPath.split('/').pop() || modelIdOrPath;
        for (const meta of Object.values(FAMILY_META)) {
            if (meta.name === filename || meta.destFilename === filename) return meta.label;
        }
        // Fallback: strip quant suffix + .gguf
        return filename.replace(/[-_](Q[0-9]|q[0-9]).*\.gguf$/i, '').replace(/\.gguf$/i, '') || 'Local AI';
    };

    // ── Initial probe ────────────────────────────────────────────────────────
    const probe = useCallback(async () => {
        if (!isTauriDesktop()) return;
        setPanelState('checking');
        try {
            const [status, hw, modelList] = await Promise.all([
                getJanStatus(),
                detectHardware(),
                listJanModels(),
            ]);

            setJanStatus(status);
            setHardware(hw);
            setModels(modelList);

            if (status.loaded) {
                setPanelState('loaded');
                setSelectedModelPath(status.model_id);
                return;
            }

            if (modelList.length > 0) {
                // Auto-select the first model
                setSelectedModelPath(modelList[0].path);
                setPanelState('model-ready');
                return;
            }

            // Check if default model file is present (maybe in a dir not scanned)
            const defaultPath = await checkDefaultModel();
            if (defaultPath) {
                setModels([{
                    id: defaultPath, name: 'Jan-v3-4b-base-instruct-Q4_K_M.gguf',
                    path: defaultPath, size_mb: 2720, family: 'Jan-v3',
                }]);
                setSelectedModelPath(defaultPath);
                setPanelState('model-ready');
                return;
            }

            setPanelState('no-model');
        } catch (e: any) {
            setErrorMsg(String(e));
            setPanelState('error');
        }
    }, []);

    useEffect(() => { probe(); }, [probe]);

    // ── Download recommended model ───────────────────────────────────────────
    const handleDownload = async (overrideUrl?: string, overrideName?: string, overrideSizeMb?: number) => {
        const meta = FAMILY_META[selectedFamily];
        const sizeMb = overrideSizeMb ?? meta.size_mb;
        setPanelState('downloading');
        setDownloadProgress({ done: false, percent: 0, downloaded_mb: 0, total_mb: sizeMb });
        try {
            const modelPath = await downloadDefaultModel({
                url: overrideUrl ?? meta.url ?? undefined,
                destDirName: meta.destDirName ?? undefined,
                destFilename: overrideName ?? meta.destFilename ?? undefined,
                onProgress: (p) => setDownloadProgress(p),
            });
            const newModel: ModelInfo = {
                id: modelPath,
                name: overrideName ?? meta.name,
                path: modelPath,
                size_mb: sizeMb,
                family: meta.family,
            };
            setModels([newModel]);
            setSelectedModelPath(modelPath);
            setPanelState('model-ready');
        } catch (e: any) {
            setErrorMsg(String(e));
            setPanelState('error');
        }
    };

    // ── Load model into llama-server ─────────────────────────────────────────
    const handleLoad = async (modelPath?: string) => {
        const path = modelPath ?? selectedModelPath;
        if (!path) return;
        if (modelPath) setSelectedModelPath(modelPath);
        setPanelState('loading');
        setErrorMsg('');
        try {
            await loadJanModel({ model_path: path });
            const status = await getJanStatus();
            setJanStatus(status);
            setPanelState('loaded');
        } catch (e: any) {
            setErrorMsg(String(e));
            setPanelState('error');
        }
    };

    // ── Unload model ─────────────────────────────────────────────────────────
    const handleUnload = async () => {
        try {
            await unloadJanModel();
            setJanStatus(null);
            setPanelState('model-ready');
        } catch (e: any) {
            setErrorMsg(String(e));
        }
    };

    if (!isTauriDesktop()) return null;

    // ── Colors ───────────────────────────────────────────────────────────────
    const bg = isDark ? 'bg-gray-800' : 'bg-gray-50';
    const border = isDark ? 'border-gray-700' : 'border-gray-200';
    const textMain = isDark ? 'text-white' : 'text-gray-900';
    const textSub = isDark ? 'text-gray-400' : 'text-gray-500';
    const btnBase = 'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95';

    // ── Render states ────────────────────────────────────────────────────────
    const renderContent = () => {
        if (panelState === 'checking') {
            return (
                <div className={`flex items-center gap-2 ${textSub} text-xs`}>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    {t('Đang kiểm tra Jan...', 'Checking Jan...')}
                </div>
            );
        }

        // Family selector — always visible (except 'checking')
        const familyList = (['jan-v3-4b', 'qwen3.5-4b', 'qwen3-4b', 'qwen3-1.7b', 'jan-v3-4b-q3', 'phi3-mini-4k', 'flux2-klein-4b'] as const);

        const familySelector = (
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-0.5">
                {familyList.map((family) => {
                    const meta = FAMILY_META[family];
                    const isSelected = selectedFamily === family;
                    const diskModel = models.find(m =>
                        m.path.includes(meta.destDirName ?? '') ||
                        m.name.toLowerCase() === meta.name.toLowerCase()
                    );
                    const isLoaded = !!janStatus && panelState === 'loaded' && (
                        janStatus.model_id.includes(meta.destDirName ?? '') ||
                        janStatus.model_id.toLowerCase().includes(meta.name.toLowerCase().replace('.gguf', ''))
                    );
                    return (
                        <button
                            key={family}
                            onClick={() => { setSelectedFamily(family); onFamilyChange?.(family); }}
                            className={`w-full text-left rounded-lg p-2.5 text-xs transition-all border ${isSelected
                                ? isDark
                                    ? 'bg-purple-900/40 border-purple-500 text-white'
                                    : 'bg-purple-50 border-purple-400 text-gray-900'
                                : isDark
                                    ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-650'
                                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-medium">{meta.label}</span>
                                <div className="flex items-center gap-1">
                                    {isLoaded && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    )}
                                    {diskModel && !isLoaded && (
                                        <span className={`text-[10px] px-1 py-0.5 rounded ${isDark ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>✓</span>
                                    )}
                                    {meta.modelType === 'image' && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-pink-900/60 text-pink-300' : 'bg-pink-100 text-pink-700'}`}>🎨 {t('Ảnh', 'Image')}</span>
                                    )}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>{meta.ram}</span>
                                </div>
                            </div>
                            <div className={`mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {(meta.size_mb / 1024).toFixed(1)} GB · {meta.desc}
                            </div>
                        </button>
                    );
                })}
            </div>
        );

        // Action section based on selectedFamily + panelState
        const meta = FAMILY_META[selectedFamily];
        const selectedDiskModel = models.find(m =>
            m.path.includes(meta.destDirName ?? '') ||
            m.name.toLowerCase() === meta.name.toLowerCase()
        );
        const isSelectedLoaded = !!janStatus && panelState === 'loaded' && (
            janStatus.model_id.includes(meta.destDirName ?? '') ||
            janStatus.model_id.toLowerCase().includes(meta.name.toLowerCase().replace('.gguf', ''))
        );

        const actionSection = (() => {
            if (panelState === 'downloading') {
                const pct = downloadProgress?.percent ?? 0;
                const dlMb = downloadProgress?.downloaded_mb ?? 0;
                const totalMb = downloadProgress?.total_mb ?? 0;
                const isIndeterminate = pct === 0 && dlMb > 0;
                const destDir = meta.destDirName ?? selectedFamily;
                return (
                    <div className="space-y-2.5">
                        <div className={`flex justify-between text-xs ${textSub}`}>
                            <span>{t('Đang tải model...', 'Downloading model...')}</span>
                            <span>{isIndeterminate ? `${dlMb} MB` : pct > 0 ? `${pct}%` : t('Đang bắt đầu...', 'Starting...')}</span>
                        </div>
                        <div className={`w-full rounded-full h-2 overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            {isIndeterminate ? (
                                <div className="h-2 w-full rounded-full bg-purple-500/70 animate-pulse" />
                            ) : pct > 0 ? (
                                <div className="h-2 rounded-full bg-purple-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                            ) : (
                                <div className="h-2 w-[4%] rounded-full bg-purple-500/50" />
                            )}
                        </div>
                        <div className={`text-xs ${textSub}`}>
                            {isIndeterminate
                                ? t(`${dlMb} MB đã tải (đang tính tổng...)`, `${dlMb} MB downloaded (calculating total...)`)
                                : totalMb > 0
                                    ? `${dlMb} MB / ${totalMb} MB`
                                    : t('Đang kết nối...', 'Connecting...')}
                        </div>
                        <div className={`flex items-start gap-1.5 p-2 rounded-lg text-[10px] ${isDark ? 'bg-blue-900/20 border border-blue-800/40 text-blue-300' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
                            <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            <span>
                                {t('File đang tải về: ', 'File saving to: ')}
                                <span className="font-mono break-all">~/jan/models/{destDir}/</span>
                                <br />
                                {t('Mở Finder để kiểm tra khi nào tải xong.', 'Open Finder to check when download completes.')}
                            </span>
                        </div>
                    </div>
                );
            }

            if (panelState === 'loading') {
                return (
                    <div className={`flex items-center gap-2 ${textSub} text-xs`}>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        {t('Đang tải model vào RAM...', 'Loading model into RAM...')}
                    </div>
                );
            }

            if (panelState === 'error') {
                return (
                    <div className="space-y-2">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                            <p className={`text-xs ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                                {errorMsg || t('Lỗi không xác định', 'Unknown error')}
                            </p>
                        </div>
                        <button onClick={probe} className={`${btnBase} text-xs ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>
                            <RefreshCw className="w-3 h-3" />
                            {t('Thử lại', 'Retry')}
                        </button>
                    </div>
                );
            }

            if (isSelectedLoaded) {
                return (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            <span className={`text-xs font-medium ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                                {getModelLabel(janStatus?.model_id)} {t('đang chạy', 'running')}
                                {janStatus?.port ? ` · :${janStatus.port}` : ''}
                            </span>
                        </div>
                        <button onClick={handleUnload} className={`${btnBase} text-xs ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>
                            <Square className="w-3 h-3" />
                            {t(`Dừng ${getModelLabel(janStatus?.model_id)}`, `Stop ${getModelLabel(janStatus?.model_id)}`)}
                        </button>
                    </div>
                );
            }

            if (selectedDiskModel) {
                return (
                    <button
                        onClick={() => handleLoad(selectedDiskModel.path)}
                        className={`${btnBase} w-full justify-center bg-emerald-600 hover:bg-emerald-700 text-white`}
                    >
                        <Play className="w-4 h-4" />
                        {t(`Khởi động ${meta.label}`, `Start ${meta.label}`)}
                    </button>
                );
            }

            // Not downloaded — show download button
            return (
                <>
                    {selectedFamily === 'flux2-klein-4b' && (
                        <div className={`text-[10px] p-2 rounded-lg border ${isDark ? 'bg-yellow-900/30 border-yellow-700 text-yellow-300' : 'bg-yellow-50 border-yellow-300 text-yellow-800'}`}>
                            ⚠️ {t(
                                'Model tạo ảnh cần ~16 GB download (transformer + VAE + Qwen3-4B encoder) và công cụ iris.c. Chỉ tải được file transformer (~2.6 GB) ở đây, quá trình sử dụng sẽ hướng dẫn tải phần còn lại.',
                                'Image model requires ~16 GB total (transformer + VAE + Qwen3-4B encoder) and iris.c tool. Only the transformer (~2.6 GB) is downloaded here; usage will guide you to download the rest.'
                            )}
                        </div>
                    )}
                    <button
                        onClick={() => handleDownload()}
                        className={`${btnBase} w-full justify-center ${selectedFamily === 'flux2-klein-4b' ? 'bg-pink-600 hover:bg-pink-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                    >
                        <Download className="w-4 h-4" />
                        {t(`Tải ${meta.label}`, `Download ${meta.label}`)}
                    </button>
                    {preferredCustomModel && (
                        <button
                            onClick={() => handleDownload(preferredCustomModel!.url, preferredCustomModel!.label + '.gguf', undefined)}
                            className={`${btnBase} w-full justify-center border ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                        >
                            <Download className="w-4 h-4" />
                            {t(`Tải ${preferredCustomModel!.label}`, `Download ${preferredCustomModel!.label}`)}
                        </button>
                    )}
                </>
            );
        })();

        return (
            <div className="space-y-3">
                <p className={`text-xs ${textSub}`}>
                    {t('Chọn model để dùng offline:', 'Choose a model to use offline:')}
                </p>
                {familySelector}
                <div className={`text-[10px] ${textSub}`}>
                    🖥️ {hardware?.backend_label || 'CPU'} · {hardware?.total_ram_mb ? Math.round(hardware.total_ram_mb / 1024) + ' GB RAM' : ''}
                </div>
                {actionSection}
            </div>
        );
    };

    return (
        <div className={`border-t ${border} ${bg}`}>
            {/* Header row */}
            <button
                onClick={() => setIsExpanded(p => !p)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium ${textSub} hover:${isDark ? 'bg-gray-700' : 'bg-gray-100'} transition-colors`}
            >
                <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    {panelState === 'loaded'
                        ? getModelLabel(janStatus?.model_id)
                        : panelState === 'model-ready' || panelState === 'loading'
                            ? getModelLabel(selectedModelPath)
                            : 'Local AI'}
                    {panelState === 'loaded' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block ml-1 animate-pulse" />
                    )}
                </span>
                <span>{isExpanded ? '▲' : '▼'}</span>
            </button>

            {isExpanded && (
                <div className="px-4 pb-[3px] pt-1">
                    {renderContent()}
                </div>
            )}
        </div>
    );
};
