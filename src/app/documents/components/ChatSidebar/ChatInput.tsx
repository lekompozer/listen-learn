import React from 'react';
import { Loader2, Send, ImagePlus, X } from 'lucide-react';

export interface ImageGenParams {
    prompt: string;
    inputImages: string[];  // base64 data URLs
    width: number;
    height: number;
    steps: number;
    seed?: number;
}

interface ChatInputProps {
    requirements: string;
    setRequirements: (value: string) => void;
    loading: boolean;
    isStreaming: boolean;
    isDark: boolean;
    language: 'vi' | 'en';
    selectedTemplateId: string;
    availableTemplates: any[];
    currentFile?: {
        fileId: string;
        fileName: string;
        fileType: 'docx' | 'pdf' | 'txt' | 'md';
        filePath?: string;
    };
    handleSendMessage: () => void;
    /** When true the input switches to image-generation mode (FLUX.2 / iris.c) */
    isImageMode?: boolean;
    onGenerateImage?: (params: ImageGenParams) => void;
}

export const ChatInput = React.memo<ChatInputProps>(({
    requirements,
    setRequirements,
    loading,
    isStreaming,
    isDark,
    language,
    selectedTemplateId,
    availableTemplates,
    currentFile,
    handleSendMessage,
    isImageMode = false,
    onGenerateImage,
}) => {
    const t = (viText: string, enText: string) => language === 'en' ? enText : viText;
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const imgFileRef = React.useRef<HTMLInputElement>(null);

    // ── Image-generation state ──
    const [imgPrompt, setImgPrompt] = React.useState('');
    const [imgWidth, setImgWidth] = React.useState(512);
    const [imgHeight, setImgHeight] = React.useState(512);
    const [imgSteps, setImgSteps] = React.useState(50);
    const [imgSeed, setImgSeed] = React.useState('');
    const [imgRefs, setImgRefs] = React.useState<{ name: string; dataUrl: string }[]>([]);

    const handleAddRefImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setImgRefs(prev => [...prev, { name: file.name, dataUrl: ev.target?.result as string }]);
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    const handleGenerate = () => {
        if (!imgPrompt.trim() || loading) return;
        onGenerateImage?.({
            prompt: imgPrompt.trim(),
            inputImages: imgRefs.map(r => r.dataUrl),
            width: imgWidth,
            height: imgHeight,
            steps: imgSteps,
            seed: imgSeed ? parseInt(imgSeed, 10) : undefined,
        });
    };

    // Auto-resize textarea based on content
    React.useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            // Reset height to auto to get correct scrollHeight
            textarea.style.height = 'auto';

            // Calculate new height (min 3 rows, max 10 rows)
            const minHeight = 3 * 24; // 3 rows * ~24px per row
            const maxHeight = 10 * 24; // 10 rows * ~24px per row
            const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);

            textarea.style.height = `${newHeight}px`;
        }
    }, [requirements]);

    // Force clear textarea when requirements becomes empty
    React.useEffect(() => {
        if (requirements === '' && textareaRef.current) {
            textareaRef.current.value = '';
            // Also reset height
            textareaRef.current.style.height = 'auto';
        }
    }, [requirements]);

    // ✅ FIX: Handle send with immediate textarea clear
    const handleSendClick = React.useCallback(() => {
        if (requirements.trim() && !loading && !isStreaming) {
            // Force clear textarea immediately
            if (textareaRef.current) {
                textareaRef.current.value = '';
                textareaRef.current.style.height = 'auto';
            }
            // Call parent handler
            handleSendMessage();
        }
    }, [requirements, loading, isStreaming, handleSendMessage]);

    // ── If in image-generation mode, render a different UI ──
    if (isImageMode) {
        const sizeOptions = [256, 512, 768, 1024] as const;
        const inputBase = `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`;
        return (
            <div className="space-y-3">
                {/* Prompt */}
                <textarea
                    value={imgPrompt}
                    onChange={e => setImgPrompt(e.target.value)}
                    placeholder={t('Mô tả hình ảnh bạn muốn tạo...', 'Describe the image you want to generate...')}
                    className={`${inputBase} resize-none`}
                    rows={3}
                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleGenerate(); } }}
                />

                {/* Size + Steps */}
                <div className="flex gap-2 items-center">
                    <div className="flex-1">
                        <label className={`block text-[10px] mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('Rộng', 'Width')}</label>
                        <select value={imgWidth} onChange={e => setImgWidth(Number(e.target.value))} className={`${inputBase} py-1 text-xs`}>
                            {sizeOptions.map(s => <option key={s} value={s}>{s}px</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className={`block text-[10px] mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('Cao', 'Height')}</label>
                        <select value={imgHeight} onChange={e => setImgHeight(Number(e.target.value))} className={`${inputBase} py-1 text-xs`}>
                            {sizeOptions.map(s => <option key={s} value={s}>{s}px</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className={`block text-[10px] mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('Bước', 'Steps')}</label>
                        <select value={imgSteps} onChange={e => setImgSteps(Number(e.target.value))} className={`${inputBase} py-1 text-xs`}>
                            <option value={4}>4 {t('(nhanh)', '(fast)')}</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className={`block text-[10px] mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Seed</label>
                        <input
                            type="number"
                            value={imgSeed}
                            onChange={e => setImgSeed(e.target.value)}
                            placeholder={t('Ngẫu nhiên', 'Random')}
                            className={`${inputBase} py-1 text-xs`}
                        />
                    </div>
                </div>

                {/* Ref images */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <span className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {t('Ảnh tham khảo (img2img)', 'Reference images (img2img)')} {imgRefs.length > 0 && `(${imgRefs.length})`}
                        </span>
                        <button
                            onClick={() => imgFileRef.current?.click()}
                            className={`text-[10px] flex items-center gap-1 px-2 py-1 rounded transition-colors ${isDark ? 'text-pink-400 hover:bg-pink-900/30' : 'text-pink-600 hover:bg-pink-50'
                                }`}
                        >
                            <ImagePlus className="w-3 h-3" />
                            {t('Thêm ảnh', 'Add image')}
                        </button>
                        <input ref={imgFileRef} type="file" accept="image/*" multiple hidden onChange={handleAddRefImage} />
                    </div>
                    {imgRefs.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {imgRefs.map((ref, i) => (
                                <div key={i} className="relative group">
                                    <img src={ref.dataUrl} alt={ref.name} className="w-12 h-12 object-cover rounded border border-gray-600" />
                                    <button
                                        onClick={() => setImgRefs(prev => prev.filter((_, idx) => idx !== i))}
                                        className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-4 h-4 bg-red-600 text-white rounded-full"
                                    >
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Generate button */}
                <button
                    onClick={handleGenerate}
                    disabled={!imgPrompt.trim() || loading}
                    className="w-full py-2 flex items-center justify-center gap-2 text-sm font-medium rounded-lg transition-all active:scale-95 bg-pink-600 hover:bg-pink-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />{t('Đang tạo ảnh...', 'Generating...')}</>
                    ) : (
                        <>{t('🎨 Tạo ảnh', '🎨 Generate')}</>
                    )}
                </button>
                <p className={`text-center text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Ctrl+Enter {t('để tạo ảnh', 'to generate')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Template Info */}
            {selectedTemplateId && availableTemplates.length > 0 && (
                <div className={`p-2 rounded-lg text-xs ${isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                    <div className="flex items-center">
                        {(() => {
                            const template = availableTemplates.find(t => (t._id || t.id) === selectedTemplateId);
                            const isSystemTemplate = template?.user_id === 'system' || template?.is_system_template;
                            return (
                                <>
                                    <span className="mr-2">{isSystemTemplate ? '🌟' : '📄'}</span>
                                    <span>
                                        {t('Đang sử dụng template: ', 'Using template: ')}<strong>
                                            {template?.name || t('Template mặc định', 'Default template')}
                                        </strong>
                                        <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${isSystemTemplate
                                            ? isDark ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-700'
                                            : isDark ? 'bg-purple-900/50 text-purple-400' : 'bg-purple-100 text-purple-700'
                                            }`}>
                                            {isSystemTemplate ? t('Hệ thống', 'System') : t('Cá nhân', 'Personal')}
                                        </span>
                                    </span>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="flex items-end space-x-2">
                <div className="flex-1">
                    <textarea
                        ref={textareaRef}
                        id="chat-requirements-input"
                        name="requirements"
                        value={requirements}
                        onChange={(e) => setRequirements(e.target.value)}
                        placeholder={t('Mô tả yêu cầu tài liệu của bạn hoặc yêu cầu AI chỉnh sửa...', 'Describe your document requirements or ask AI to edit...')}
                        className={`w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${isDark
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                            }`}
                        style={{ minHeight: '72px', maxHeight: '140px', overflow: 'auto' }}
                        maxLength={10000}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                // ✅ FIX: Force clear textarea immediately before sending
                                if (textareaRef.current && requirements.trim() && !loading && !isStreaming) {
                                    textareaRef.current.value = '';
                                    textareaRef.current.style.height = 'auto';
                                    handleSendMessage();
                                }
                            }
                        }}
                    />
                </div>
                <button
                    onClick={handleSendClick}
                    disabled={loading || isStreaming || !requirements.trim()}
                    className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title={currentFile ? t('Gửi yêu cầu AI', 'Send AI request') : t('Vui lòng mở file để chỉnh sửa', 'Please open a file to edit')}
                >
                    {(loading || isStreaming) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                </button>
            </div>
        </div>
    );
});

ChatInput.displayName = 'ChatInput';
