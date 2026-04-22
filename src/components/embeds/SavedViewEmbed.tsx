'use client';

import { Bookmark } from 'lucide-react';

export function SavedViewEmbed({ isDark }: { isDark: boolean }) {
    return (
        <div className={`h-full flex flex-col items-center justify-center gap-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <Bookmark className="w-12 h-12 opacity-30" />
            <p className="text-sm font-medium">Saved — Coming soon</p>
        </div>
    );
}
