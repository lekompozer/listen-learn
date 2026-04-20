// ─── Legacy type (kept for backward compat during migration) ─────────────────
export interface VocabWord {
    id: string;
    word: string;
    ipa: string;
    pos: string;
    definition_en: string;
    definition_vi: string;
    example_quote: string;
    podcast_title?: string;
    podcast_audio_url?: string;
    podcast_start_sec?: number;
    podcast_end_sec?: number;
    background_music_url?: string;
    sources: Source[];
    image_url: string;
    related_words: string[];
    tags: string[];
    like_count: number;
    save_count: number;
    video_url?: string;
    video_poster_url?: string;
    video_caption?: string;
    channel_name?: string;
    channel_handle?: string;
    channel_slug?: string;
    channel_category?: string;
    channel_verified?: boolean;
}

// ─── API types (from /api/v1/daily-vocab) ────────────────────────────────────

export interface Source {
    type: 'conversation' | 'podcast' | 'song';
    id?: string;
    title: string;
    text?: string;          // legacy quote from source
    example?: string;       // sentence from source
    audio_url?: string;
    start_sec?: number;     // podcast only — seek position
    duration_sec?: number;  // context clip length
    artist?: string;
    youtube_id?: string;
}

export interface RelatedWord {
    word_key: string;
    word: string;
    pos_tag: string;
    definition_en: string;
    definition_vi: string;
    example: string;
    image_url?: string;
    audio_url?: string;
}

export interface VocabCard {
    word_key: string;
    word: string;
    pos_tag: string;
    definition_en: string;
    definition_vi: string;
    example: string;
    topic_slug: string;
    topic_en: string;
    topic_category: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    image_url?: string;
    audio_url?: string;
    background_music_url?: string;
    sources: Source[];
    like_count: number;
    save_count: number;
    user_liked: boolean;
    user_saved: boolean;
    related: RelatedWord[];
}

export interface GrammarCard {
    id: string;
    pattern: string;
    explanation_vi: string;
    example: string;
    level: string;
    topic_slug: string;
}

export interface TopicTrack {
    title: string;
    hosted_url: string;
    duration_sec: number;
}

export interface FeedTodayResponse {
    set_idx: number;
    total: number;
    cards: VocabCard[];
    grammar: GrammarCard[];
}

export interface FeedNextResponse {
    cards: VocabCard[];
    has_more: boolean;
    next_cursor?: string;
}

/** Adapter: convert VocabCard (API) → VocabWord (legacy UI shape) */
export function toVocabWord(card: VocabCard): VocabWord {
    const podcastSource = card.sources?.find(s => s.type === 'podcast');
    return {
        id: card.word_key,
        word: card.word,
        ipa: '',                          // API doesn't provide IPA; TTS used instead
        pos: card.pos_tag,
        definition_en: card.definition_en,
        definition_vi: card.definition_vi,
        example_quote: card.example,
        podcast_title: podcastSource?.title,
        podcast_audio_url: podcastSource?.audio_url,
        podcast_start_sec: podcastSource?.start_sec,
        podcast_end_sec: podcastSource?.start_sec != null && podcastSource?.duration_sec != null
            ? podcastSource.start_sec + podcastSource.duration_sec
            : undefined,
        background_music_url: card.background_music_url || '',
        sources: card.sources ?? [],
        image_url: card.image_url || '',
        related_words: card.related?.map(r => r.word) ?? [],
        tags: card.topic_en ? [card.topic_en] : [],
        like_count: card.like_count ?? 0,
        save_count: card.save_count ?? 0,
    };
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export type SwipeDirection = 'left' | 'right' | 'up';

export interface SavedVocabEntry {
    wordId: string;
    word: string;
    definition_vi: string;
    savedAt: number;
}
