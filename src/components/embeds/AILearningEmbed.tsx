'use client';

import AILearningPageClient from '@/app/documents/components/AILearningPageClient';
import { useTheme } from '@/contexts/AppContext';

interface AILearningEmbedProps {
    isDark: boolean;
}

export function AILearningEmbed({ isDark }: AILearningEmbedProps) {
    return <AILearningPageClient />;
}
