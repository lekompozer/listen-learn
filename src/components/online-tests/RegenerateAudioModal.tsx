'use client';

/**
 * RegenerateAudioModal Component
 * Modal for regenerating listening test audio with custom voice configuration
 *
 * Layout: 2-column
 * - Left: Transcript editor with Save button
 * - Right: Voice config + Generate button → Loading (300s timeout) → Audio player + Apply/Re-generate
 *
 * API Flow:
 * 1. User edits transcript → PATCH /tests/{id}/transcript (optional)
 * 2. Click Generate → POST /tests/{id}/audio/generate (saves to Library, 300s timeout)
 * 3. Preview audio → User can listen
 * 4. Click Apply → PATCH /tests/{id}/audio/apply (updates test)
 */

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Play, Pause, Volume2, VolumeX, RotateCcw, Sparkles } from 'lucide-react';
import { logger } from '@/lib/logger';
import { firebaseTokenManager } from '@/services/firebaseTokenManager';

interface RegenerateAudioModalProps {
    isOpen: boolean;
    onClose: () => void;
    testId: string;
    sectionNumber: number;
    currentTranscript: string;
    currentAudioUrl: string;
    isDark: boolean;
    language: 'vi' | 'en';
    onSuccess: () => void; // Callback to refresh test data
}

interface GenerateResponse {
    library_file_id: string;
    audio_url: string;
    duration_seconds: number;
    voice_names: string[] | null;
    num_speakers: number;
}

// Available voices from Gemini TTS
// Gender Distribution: MALE (12), FEMALE (13), NEUTRAL (5)
const AVAILABLE_VOICES_MALE = [
    'Puck', 'Charon', 'Fenrir', 'Orus', 'Enceladus', 'Iapetus',
    'Algieba', 'Algenib', 'Rasalgethi', 'Alnilam', 'Gacrux', 'Zubenelgenubi',
    'Sadaltager'
];

const AVAILABLE_VOICES_FEMALE = [
    'Kore', 'Leda', 'Aoede', 'Callirrhoe', 'Autonoe', 'Despina',
    'Erinome', 'Laomedeia', 'Achernar', 'Pulcherrima', 'Vindemiatrix',
    'Sadachbia', 'Sulafat'
];

const AVAILABLE_VOICES_NEUTRAL = [
    'Zephyr', 'Umbriel', 'Schedar', 'Achird'
];

const ALL_VOICES = [...AVAILABLE_VOICES_MALE, ...AVAILABLE_VOICES_FEMALE, ...AVAILABLE_VOICES_NEUTRAL].sort();

export const RegenerateAudioModal: React.FC<RegenerateAudioModalProps> = ({
    isOpen,
    onClose,
    testId,
    sectionNumber,
    currentTranscript,
    currentAudioUrl,
    isDark,
    language,
    onSuccess
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;

    // Transcript state
    const [transcript, setTranscript] = useState(currentTranscript);
    const [transcriptModified, setTranscriptModified] = useState(false);
    const [savingTranscript, setSavingTranscript] = useState(false);

    // Voice config state
    const [voiceSelectionMode, setVoiceSelectionMode] = useState<'auto' | 'manual'>('auto');
    const [selectedVoices, setSelectedVoices] = useState<string[]>([]);
    const [speakingRate, setSpeakingRate] = useState(1.0);
    const [useProModel, setUseProModel] = useState(false);

    // Generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [generatedData, setGeneratedData] = useState<GenerateResponse | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0); // Countdown timer (seconds)
    const [isTimeout, setIsTimeout] = useState(false); // Flag for timeout

    // Apply state
    const [isApplying, setIsApplying] = useState(false);

    // Timer ref for countdown
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Audio player state
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTranscript(currentTranscript);
            setTranscriptModified(false);
            setGeneratedData(null);
            setGenerationError(null);
            setElapsedTime(0);
            setIsTimeout(false);
        } else {
            // Cleanup timer when modal closes
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    }, [isOpen, currentTranscript]);

    // Audio player effects
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => setCurrentTime(audio.currentTime);
        const updateDuration = () => setDuration(audio.duration);
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [generatedData]);

    const handleSaveTranscript = async () => {
        try {
            setSavingTranscript(true);
            const token = await firebaseTokenManager.getValidToken();

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ai.wordai.pro'}/api/v1/tests/${testId}/transcript`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        section_number: sectionNumber,
                        transcript: transcript
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to save transcript');
            }

            logger.info('✅ Transcript saved successfully');
            setTranscriptModified(false);
            alert(t('Đã lưu transcript thành công!', 'Transcript saved successfully!'));
        } catch (error: any) {
            logger.error('❌ Failed to save transcript:', error);
            alert(t('Không thể lưu transcript', 'Failed to save transcript'));
        } finally {
            setSavingTranscript(false);
        }
    };

    const handleGenerate = async () => {
        try {
            setIsGenerating(true);
            setGenerationError(null);
            setGeneratedData(null);
            setElapsedTime(0);
            setIsTimeout(false);

            // Start countdown timer
            timerRef.current = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);

            const token = await firebaseTokenManager.getValidToken();

            const requestBody: any = {
                section_number: sectionNumber,
                speaking_rate: speakingRate,
                use_pro_model: useProModel,
            };

            if (voiceSelectionMode === 'manual' && selectedVoices.length > 0) {
                requestBody.voice_names = selectedVoices;
            }

            logger.info('🎤 Generating audio...', requestBody);

            // Set 300s (5 minutes) timeout for audio generation
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000);

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ai.wordai.pro'}/api/v1/tests/${testId}/audio/generate`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal,
                }
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to generate audio');
            }

            const data: GenerateResponse = await response.json();
            logger.info('✅ Audio generated:', data);
            setGeneratedData(data);
        } catch (error: any) {
            logger.error('❌ Failed to generate audio:', error);
            if (error.name === 'AbortError') {
                setIsTimeout(true);
                setGenerationError(null); // Don't show error, show timeout UI instead
            } else {
                setGenerationError(error.message || t('Không thể tạo audio', 'Failed to generate audio'));
            }
        } finally {
            setIsGenerating(false);
            // Stop timer
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    };

    const handleCheckAgain = async () => {
        try {
            setIsGenerating(true);
            setGenerationError(null);
            setIsTimeout(false);

            const token = await firebaseTokenManager.getValidToken();

            // Try to fetch the last generated audio from backend
            // This is a simplified approach - you might need to poll or check Library
            logger.info('🔄 Checking for generated audio...');

            // For now, just show message to check Library
            setIsGenerating(false);
            alert(t(
                'Vui lòng kiểm tra trong Library (mục Audio) để xem file audio mới được tạo.',
                'Please check your Library (Audio section) for the newly generated audio file.'
            ));
        } catch (error: any) {
            logger.error('❌ Failed to check audio:', error);
            setGenerationError(error.message);
            setIsGenerating(false);
        }
    };

    const handleOpenLibrary = () => {
        // Open Library in new tab
        window.open('/library?category=audio', '_blank');
    };

    const handleApply = async () => {
        if (!generatedData) return;

        try {
            setIsApplying(true);
            const token = await firebaseTokenManager.getValidToken();

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ai.wordai.pro'}/api/v1/tests/${testId}/audio/apply`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        section_number: sectionNumber,
                        library_file_id: generatedData.library_file_id,
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to apply audio');
            }

            logger.info('✅ Audio applied to test');
            alert(t('Đã áp dụng audio thành công!', 'Audio applied successfully!'));
            onSuccess(); // Refresh test data
            onClose();
        } catch (error: any) {
            logger.error('❌ Failed to apply audio:', error);
            alert(t('Không thể áp dụng audio', 'Failed to apply audio'));
        } finally {
            setIsApplying(false);
        }
    };

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleRestart = () => {
        const audio = audioRef.current;
        if (!audio) return;

        audio.currentTime = 0;
        setCurrentTime(0);
        if (!isPlaying) {
            audio.play();
            setIsPlaying(true);
        }
    };

    const toggleMute = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isMuted) {
            audio.volume = volume;
            setIsMuted(false);
        } else {
            audio.volume = 0;
            setIsMuted(true);
        }
    };

    const formatTime = (seconds: number): string => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const addVoice = () => {
        if (selectedVoices.length < 5) {
            setSelectedVoices([...selectedVoices, ALL_VOICES[0]]);
        }
    };

    const removeVoice = (index: number) => {
        setSelectedVoices(selectedVoices.filter((_, i) => i !== index));
    };

    const updateVoice = (index: number, voice: string) => {
        const updated = [...selectedVoices];
        updated[index] = voice;
        setSelectedVoices(updated);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className={`w-full max-w-6xl max-h-[90vh] flex flex-col rounded-lg ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        🎤 {t('Tạo lại Audio', 'Regenerate Audio')} - {t('Phần', 'Section')} {sectionNumber}
                    </h2>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content - 2 columns */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-4 p-6">
                    {/* Left Column: Transcript Editor */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t('Transcript', 'Transcript')}
                            </h3>
                            {transcriptModified && (
                                <button
                                    onClick={handleSaveTranscript}
                                    disabled={savingTranscript}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isDark
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-700'
                                        : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300'
                                        }`}
                                >
                                    {savingTranscript ? t('Đang lưu...', 'Saving...') : t('Lưu', 'Save')}
                                </button>
                            )}
                        </div>
                        <textarea
                            value={transcript}
                            onChange={(e) => {
                                setTranscript(e.target.value);
                                setTranscriptModified(e.target.value !== currentTranscript);
                            }}
                            className={`flex-1 p-4 rounded-lg border resize-none font-mono text-sm ${isDark
                                ? 'bg-gray-800 border-gray-700 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                                }`}
                            placeholder={t('Nhập transcript...', 'Enter transcript...')}
                        />
                        <p className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {transcript.length} {t('ký tự', 'characters')}
                        </p>
                    </div>

                    {/* Right Column: Voice Config & Audio Generation */}
                    <div className="flex-1 flex flex-col min-h-0">
                        {!generatedData ? (
                            // Voice Configuration
                            <div className="space-y-4">
                                <h3 className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t('Cấu hình giọng nói', 'Voice Configuration')}
                                </h3>

                                {/* Voice Selection Mode */}
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t('Chọn giọng nói', 'Voice Selection')}
                                    </label>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setVoiceSelectionMode('auto')}
                                            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${voiceSelectionMode === 'auto'
                                                ? isDark
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-blue-500 text-white'
                                                : isDark
                                                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            {t('Tự động', 'Auto')}
                                        </button>
                                        <button
                                            onClick={() => setVoiceSelectionMode('manual')}
                                            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${voiceSelectionMode === 'manual'
                                                ? isDark
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-blue-500 text-white'
                                                : isDark
                                                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            {t('Tự chọn', 'Manual')}
                                        </button>
                                    </div>
                                </div>

                                {/* Manual Voice Selection */}
                                {voiceSelectionMode === 'manual' && (
                                    <div>
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {t('Giọng nói', 'Voices')} ({selectedVoices.length}/5)
                                        </label>
                                        <div className="space-y-2">
                                            {selectedVoices.map((voice, index) => (
                                                <div key={index} className="flex gap-2">
                                                    <select
                                                        value={voice}
                                                        onChange={(e) => updateVoice(index, e.target.value)}
                                                        className={`flex-1 px-3 py-2 rounded-lg border text-sm ${isDark
                                                            ? 'bg-gray-800 border-gray-700 text-white'
                                                            : 'bg-white border-gray-300 text-gray-900'
                                                            }`}
                                                    >
                                                        <optgroup label={t('Giọng Nam', 'Male Voices')}>
                                                            {AVAILABLE_VOICES_MALE.map(v => (
                                                                <option key={v} value={v}>{v}</option>
                                                            ))}
                                                        </optgroup>
                                                        <optgroup label={t('Giọng Nữ', 'Female Voices')}>
                                                            {AVAILABLE_VOICES_FEMALE.map(v => (
                                                                <option key={v} value={v}>{v}</option>
                                                            ))}
                                                        </optgroup>
                                                        <optgroup label={t('Giọng Trung Tính', 'Neutral Voices')}>
                                                            {AVAILABLE_VOICES_NEUTRAL.map(v => (
                                                                <option key={v} value={v}>{v}</option>
                                                            ))}
                                                        </optgroup>
                                                    </select>
                                                    <button
                                                        onClick={() => removeVoice(index)}
                                                        className={`px-3 py-2 rounded-lg ${isDark ? 'bg-red-900/20 text-red-400 hover:bg-red-900/30' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                            {selectedVoices.length < 5 && (
                                                <button
                                                    onClick={addVoice}
                                                    className={`w-full px-4 py-2 rounded-lg border-2 border-dashed text-sm ${isDark
                                                        ? 'border-gray-700 text-gray-400 hover:border-gray-600'
                                                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                                                        }`}
                                                >
                                                    + {t('Thêm giọng', 'Add Voice')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Speaking Rate */}
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t('Tốc độ', 'Speaking Rate')}: {speakingRate}x
                                    </label>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="2"
                                        step="0.1"
                                        value={speakingRate}
                                        onChange={(e) => setSpeakingRate(parseFloat(e.target.value))}
                                        className="w-full"
                                    />
                                </div>

                                {/* Pro Model Toggle */}
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="proModel"
                                        checked={useProModel}
                                        onChange={(e) => setUseProModel(e.target.checked)}
                                        className="w-4 h-4"
                                    />
                                    <label htmlFor="proModel" className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {t('Sử dụng Pro Model (chất lượng cao hơn)', 'Use Pro Model (higher quality)')}
                                    </label>
                                </div>

                                {/* Generate Button */}
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || transcript.length < 50}
                                    className={`w-full px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${isDark
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-700'
                                        : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300'
                                        }`}
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span className="flex flex-col items-center">
                                                <span>{t('Đang tạo audio...', 'Generating audio...')}</span>
                                                <span className="text-xs mt-1">
                                                    {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')} / 4:00
                                                </span>
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-5 h-5" />
                                            {t('Tạo Audio', 'Generate Audio')}
                                        </>
                                    )}
                                </button>

                                {/* Info message during generation */}
                                {isGenerating && (
                                    <div className={`p-3 rounded-lg text-xs ${isDark ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>
                                        <p className="font-medium mb-1">ℹ️ {t('Lưu ý', 'Note')}:</p>
                                        <p>{t(
                                            'Quá trình tạo audio có thể mất vài phút. Audio sẽ tự động được lưu trong Library (mục Audio) để bạn có thể nghe thử và áp dụng sau.',
                                            'Audio generation may take a few minutes. The audio will be automatically saved to your Library (Audio section) for preview and application.'
                                        )}</p>
                                    </div>
                                )}

                                {/* Timeout UI */}
                                {isTimeout && (
                                    <div className={`p-4 rounded-lg border ${isDark ? 'bg-yellow-900/20 border-yellow-500/50' : 'bg-yellow-50 border-yellow-200'}`}>
                                        <p className={`text-sm mb-3 ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                                            ⏱️ {t(
                                                'Đã hết thời gian chờ (4 phút). Audio có thể vẫn đang được tạo và sẽ lưu trong Library.',
                                                'Timeout reached (4 minutes). Audio may still be generating and will be saved to Library.'
                                            )}
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleCheckAgain}
                                                disabled={isGenerating}
                                                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${isDark
                                                    ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-700'
                                                    : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300'
                                                    }`}
                                            >
                                                🔄 {t('Kiểm tra lại', 'Check Again')}
                                            </button>
                                            <button
                                                onClick={handleOpenLibrary}
                                                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${isDark
                                                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                                    : 'bg-purple-500 hover:bg-purple-600 text-white'
                                                    }`}
                                            >
                                                📚 {t('Mở Library', 'Open Library')}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Regular error (not timeout) */}
                                {generationError && !isTimeout && (
                                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500 text-red-500 text-sm">
                                        {generationError}
                                    </div>
                                )}
                            </div>
                        ) : (
                            // Generated Audio Player
                            <div className="space-y-4">
                                <h3 className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    ✅ {t('Audio đã tạo', 'Generated Audio')}
                                </h3>

                                <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                    <audio ref={audioRef} src={generatedData.audio_url} preload="metadata" />

                                    {/* Progress bar */}
                                    <div className="mb-3">
                                        <input
                                            type="range"
                                            min="0"
                                            max={duration || 0}
                                            value={currentTime}
                                            onChange={(e) => {
                                                const audio = audioRef.current;
                                                if (audio) {
                                                    audio.currentTime = parseFloat(e.target.value);
                                                    setCurrentTime(audio.currentTime);
                                                }
                                            }}
                                            className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                        <div className="flex items-center justify-between mt-1">
                                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                {formatTime(currentTime)}
                                            </span>
                                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                {formatTime(duration)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Controls */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={togglePlay}
                                                className={`p-2 rounded-lg ${isDark ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                                            >
                                                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                                            </button>
                                            <button
                                                onClick={handleRestart}
                                                className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <button
                                            onClick={toggleMute}
                                            className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                                        >
                                            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    <p>🎤 {t('Giọng nói', 'Voices')}: {(generatedData.voice_names ?? []).join(', ')}</p>
                                    <p>👥 {t('Số người nói', 'Speakers')}: {generatedData.num_speakers}</p>
                                    <p>⏱️ {t('Thời lượng', 'Duration')}: ~{generatedData.duration_seconds}s</p>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setGeneratedData(null)}
                                        className={`flex-1 px-4 py-2 rounded-lg font-medium ${isDark
                                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                            : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                            }`}
                                    >
                                        {t('Tạo lại', 'Re-generate')}
                                    </button>
                                    <button
                                        onClick={handleApply}
                                        disabled={isApplying}
                                        className={`flex-1 px-4 py-2 rounded-lg font-medium ${isDark
                                            ? 'bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-700'
                                            : 'bg-green-500 hover:bg-green-600 text-white disabled:bg-gray-300'
                                            }`}
                                    >
                                        {isApplying ? t('Đang áp dụng...', 'Applying...') : t('Áp dụng', 'Apply')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
