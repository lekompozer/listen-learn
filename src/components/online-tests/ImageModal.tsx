/**
 * ImageModal Component
 * Modal for viewing images in full size
 * November 12, 2025
 */

'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';

interface ImageModalProps {
    imageUrl: string;
    description?: string;
    onClose: () => void;
    isDark: boolean;
}

export const ImageModal: React.FC<ImageModalProps> = ({
    imageUrl,
    description,
    onClose,
    isDark,
}) => {
    // Close on ESC key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            {/* Close button */}
            <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
                aria-label="Close"
            >
                <X className="w-6 h-6" />
            </button>

            {/* Image container */}
            <div
                className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={imageUrl}
                    alt={description || 'Full size image'}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                />

                {/* Description */}
                {description && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-black/70 text-white text-sm rounded-b-lg">
                        {description}
                    </div>
                )}
            </div>

            {/* Click outside hint */}
            <div className="absolute bottom-4 text-white/60 text-sm">
                Press ESC or click outside to close
            </div>
        </div>
    );
};
