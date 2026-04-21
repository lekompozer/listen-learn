'use client';

/**
 * PointsBadge Component
 * Displays current points balance in header
 * Auto-refreshes after AI operations
 */

import { usePointsBalance, usePointsUpdateListener } from '@/hooks/useSubscription';
import { Zap, Loader2 } from 'lucide-react';

interface PointsBadgeProps {
    isDark?: boolean;
    showLabel?: boolean;
    autoRefresh?: boolean;
}

export default function PointsBadge({
    isDark = false,
    showLabel = true,
    autoRefresh = false
}: PointsBadgeProps) {
    const { data, isLoading, error, refetch } = usePointsBalance({
        autoRefresh,
        refreshInterval: 30000 // 30s
    });

    // Listen for points update events (after AI operations)
    usePointsUpdateListener(() => {
        refetch();
    });

    if (error) {
        return null; // Quietly fail, don't show error in header
    }

    if (isLoading && !data) {
        return (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'
                }`}>
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                {showLabel && (
                    <span className="text-sm text-gray-400">
                        Loading...
                    </span>
                )}
            </div>
        );
    }

    if (!data) return null;

    // Determine color based on remaining points
    const getPointsColor = () => {
        const percentage = (data.points_remaining / data.points_total) * 100;
        if (percentage <= 10) return 'text-red-500';
        if (percentage <= 30) return 'text-yellow-500';
        return isDark ? 'text-blue-400' : 'text-blue-600';
    };

    const getBackgroundColor = () => {
        const percentage = (data.points_remaining / data.points_total) * 100;
        if (percentage <= 10) {
            return isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-100 border-red-200';
        }
        if (percentage <= 30) {
            return isDark ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-100 border-yellow-200';
        }
        return isDark ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-100 border-blue-200';
    };

    return (
        <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${getBackgroundColor()}`}
            title={`${data.points_used} / ${data.points_total} points used`}
        >
            <Zap className={`w-4 h-4 ${getPointsColor()}`} />
            <div className="flex items-baseline gap-1">
                <span className={`text-sm font-bold ${getPointsColor()}`}>
                    {data.points_remaining}
                </span>
                {showLabel && (
                    <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        pts
                    </span>
                )}
            </div>
        </div>
    );
}
