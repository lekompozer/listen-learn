/**
 * Dexie.js IndexedDB schema for Daily Vocab feature
 * All stores are browser-only — never call outside useEffect / client components
 */

import Dexie, { type Table } from 'dexie';
import type { VocabCard, GrammarCard, TopicTrack } from '@/components/daily-vocab/types';

// ─── Store record shapes ──────────────────────────────────────────────────────

export interface TodayFeedRecord {
    id?: number;          // auto-increment PK
    set_idx: number;
    cards: VocabCard[];
    grammar: GrammarCard[];
    cached_at: number;    // Date.now()
}

export interface ScrollPoolRecord {
    word_key: string;     // PK
    card: VocabCard;
    fetched_at: number;
}

export interface AnonLikedRecord {
    word_key: string;     // PK
    liked_at: number;
}

export interface AnonSavedRecord {
    word_key: string;     // PK
    saved_at: number;
}

export interface TopicAudioRecord {
    topic_slug: string;   // PK
    pool: TopicTrack[];
    cached_at: number;
}

export interface WordCacheRecord {
    word_key: string;     // PK
    data: VocabCard;
    fetched_at: number;
}

// ─── Database class ───────────────────────────────────────────────────────────

class VocabDatabase extends Dexie {
    today_feed!: Table<TodayFeedRecord, number>;
    scroll_pool!: Table<ScrollPoolRecord, string>;
    anon_liked!: Table<AnonLikedRecord, string>;
    anon_saved!: Table<AnonSavedRecord, string>;
    topic_audio!: Table<TopicAudioRecord, string>;
    word_cache!: Table<WordCacheRecord, string>;

    constructor() {
        super('VocabDB');
        this.version(1).stores({
            today_feed: '++id',
            scroll_pool: 'word_key',
            anon_liked: 'word_key',
            anon_saved: 'word_key',
            topic_audio: 'topic_slug',
            word_cache: 'word_key',
        });
        this.version(2)
            .stores({
                today_feed: '++id, cached_at',
                scroll_pool: 'word_key, fetched_at',
                anon_liked: 'word_key',
                anon_saved: 'word_key',
                topic_audio: 'topic_slug',
                word_cache: 'word_key, fetched_at',
            })
            .upgrade(async (tx) => {
                await tx.table('today_feed').clear();
                await tx.table('scroll_pool').clear();
            });
    }
}

// Singleton — safe to import in client components
export const vocabDB = new VocabDatabase();
