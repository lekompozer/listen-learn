'use client';

import dynamic from 'next/dynamic';

const DailyVocabClient = dynamic(
    () => import('@/components/daily-vocab/DailyVocabClient'),
    { ssr: false, loading: () => null }
);

interface DailyVocabTabProps {
    isDark: boolean;
}

export function DailyVocabTab({ isDark }: DailyVocabTabProps) {
    return (
        <div className="h-full w-full overflow-hidden">
            <DailyVocabClient embedMode forYouMode="vocab-only" />
        </div>
    );
}
