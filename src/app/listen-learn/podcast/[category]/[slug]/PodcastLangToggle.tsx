'use client';

import { useLanguage } from '@/contexts/AppContext';

export default function PodcastLangToggle() {
    const { isVietnamese, toggleLanguage } = useLanguage();
    return (
        <button
            onClick={toggleLanguage}
            className="ml-auto flex-shrink-0 text-xs px-2.5 py-1 rounded-full border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all"
        >
            {isVietnamese ? 'EN' : 'VI'}
        </button>
    );
}
