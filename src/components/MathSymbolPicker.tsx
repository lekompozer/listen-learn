/**
 * Math Symbol Picker Component
 * Floating palette for inserting common math symbols and LaTeX commands
 * December 17, 2025
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { MathRenderer } from './MathRenderer';

interface MathSymbol {
    display: string;
    latex: string;
    name: string;
    cursorOffset?: number; // Số ký tự cần lùi cursor sau khi insert (để đặt cursor vào đúng vị trí)
}

interface MathSymbolPickerProps {
    onInsert: (latex: string, cursorOffset?: number) => void;
    onClose: () => void;
    isDark: boolean;
    language: 'vi' | 'en';
    position?: { top: number; left: number }; // Position relative to trigger button
}

const MATH_SYMBOLS: Record<string, MathSymbol[]> = {
    basic: [
        { display: '\\pm', latex: '\\pm', name: 'Cộng/trừ / Plus-minus' },
        { display: '\\times', latex: '\\times', name: 'Nhân / Multiply' },
        { display: '\\div', latex: '\\div', name: 'Chia / Divide' },
        { display: '\\approx', latex: '\\approx', name: 'Xấp xỉ / Approximately' },
        { display: '\\neq', latex: '\\neq', name: 'Không bằng / Not equal' },
        { display: '\\leq', latex: '\\leq', name: 'Nhỏ hơn hoặc bằng / Less or equal' },
        { display: '\\geq', latex: '\\geq', name: 'Lớn hơn hoặc bằng / Greater or equal' },
        { display: '\\infty', latex: '\\infty', name: 'Vô cực / Infinity' },
    ],
    fraction: [
        { display: '\\frac{a}{b}', latex: '\\frac{|}{}', name: 'Phân số / Fraction', cursorOffset: 3 },
        { display: '\\frac{1}{2}', latex: '\\frac{1}{2}', name: '1/2' },
        { display: '\\frac{a}{b+c}', latex: '\\frac{a}{b+c}', name: 'Phân số phức / Complex fraction' },
    ],
    power: [
        { display: 'x^2', latex: 'x^2', name: 'Bình phương / Square' },
        { display: 'x^n', latex: 'x^{|}', name: 'Lũy thừa / Power', cursorOffset: 1 },
        { display: 'x^{-1}', latex: 'x^{-1}', name: 'Nghịch đảo / Inverse' },
        { display: 'x_1', latex: 'x_{|}', name: 'Chỉ số dưới / Subscript', cursorOffset: 1 },
    ],
    root: [
        { display: '\\sqrt{x}', latex: '\\sqrt{|}', name: 'Căn bậc 2 / Square root', cursorOffset: 1 },
        { display: '\\sqrt[3]{x}', latex: '\\sqrt[3]{|}', name: 'Căn bậc 3 / Cube root', cursorOffset: 1 },
        { display: '\\sqrt[n]{x}', latex: '\\sqrt[n]{|}', name: 'Căn bậc n / nth root', cursorOffset: 1 },
    ],
    calculus: [
        { display: '\\int', latex: '\\int ', name: 'Tích phân / Integral' },
        { display: '\\int_a^b', latex: '\\int_{|}^{} ', name: 'Tích phân xác định / Definite integral', cursorOffset: 4 },
        { display: '\\sum', latex: '\\sum ', name: 'Tổng / Sum' },
        { display: '\\sum_{i=1}^{n}', latex: '\\sum_{i=1}^{n} ', name: 'Tổng có giới hạn / Sum with limits' },
        { display: '\\prod', latex: '\\prod ', name: 'Tích / Product' },
        { display: '\\lim_{x \\to \\infty}', latex: '\\lim_{x \\to \\infty} ', name: 'Giới hạn / Limit' },
    ],
    greek: [
        { display: '\\alpha', latex: '\\alpha ', name: 'Alpha' },
        { display: '\\beta', latex: '\\beta ', name: 'Beta' },
        { display: '\\gamma', latex: '\\gamma ', name: 'Gamma' },
        { display: '\\delta', latex: '\\delta ', name: 'Delta' },
        { display: '\\theta', latex: '\\theta ', name: 'Theta' },
        { display: '\\pi', latex: '\\pi ', name: 'Pi' },
        { display: '\\sigma', latex: '\\sigma ', name: 'Sigma' },
        { display: '\\omega', latex: '\\omega ', name: 'Omega' },
        { display: '\\Delta', latex: '\\Delta ', name: 'Delta (hoa / uppercase)' },
        { display: '\\Sigma', latex: '\\Sigma ', name: 'Sigma (hoa / uppercase)' },
        { display: '\\Omega', latex: '\\Omega ', name: 'Omega (hoa / uppercase)' },
    ],
    set: [
        { display: '\\in', latex: '\\in ', name: 'Thuộc / Element of' },
        { display: '\\notin', latex: '\\notin ', name: 'Không thuộc / Not element of' },
        { display: '\\cup', latex: '\\cup ', name: 'Hợp / Union' },
        { display: '\\cap', latex: '\\cap ', name: 'Giao / Intersection' },
        { display: '\\subset', latex: '\\subset ', name: 'Tập con / Subset' },
        { display: '\\supset', latex: '\\supset ', name: 'Tập cha / Superset' },
        { display: '\\emptyset', latex: '\\emptyset ', name: 'Tập rỗng / Empty set' },
        { display: '\\mathbb{N}', latex: '\\mathbb{N} ', name: 'Số tự nhiên / Natural numbers' },
        { display: '\\mathbb{Z}', latex: '\\mathbb{Z} ', name: 'Số nguyên / Integers' },
        { display: '\\mathbb{Q}', latex: '\\mathbb{Q} ', name: 'Số hữu tỉ / Rational numbers' },
        { display: '\\mathbb{R}', latex: '\\mathbb{R} ', name: 'Số thực / Real numbers' },
    ],
};

const CATEGORY_NAMES: Record<string, { vi: string; en: string }> = {
    basic: { vi: 'Cơ bản', en: 'Basic' },
    fraction: { vi: 'Phân số', en: 'Fractions' },
    power: { vi: 'Lũy thừa', en: 'Powers' },
    root: { vi: 'Căn', en: 'Roots' },
    calculus: { vi: 'Giải tích', en: 'Calculus' },
    greek: { vi: 'Hy Lạp', en: 'Greek' },
    set: { vi: 'Tập hợp', en: 'Sets' },
};

export const MathSymbolPicker: React.FC<MathSymbolPickerProps> = ({
    onInsert,
    onClose,
    isDark,
    language,
    position
}) => {
    const t = (vi: string, en: string) => language === 'en' ? en : vi;
    const [activeTab, setActiveTab] = useState<string>('basic');
    const pickerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div
            ref={pickerRef}
            className={`absolute z-[60] w-[500px] rounded-lg shadow-2xl border ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
                }`}
            style={position ? { top: position.top + 10, left: position.left } : {}}
        >
            {/* Header */}
            <div className={`flex items-center justify-between p-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'
                }`}>
                <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {t('🔢 Ký hiệu toán học', '🔢 Math Symbols')}
                </h3>
                <button
                    onClick={onClose}
                    className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                        }`}
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Tabs */}
            <div className={`flex gap-1 px-2 py-2 border-b overflow-x-auto ${isDark ? 'border-gray-700' : 'border-gray-200'
                }`}>
                {Object.keys(MATH_SYMBOLS).map((category) => (
                    <button
                        key={category}
                        onClick={() => setActiveTab(category)}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${activeTab === category
                            ? isDark
                                ? 'bg-blue-600 text-white'
                                : 'bg-blue-500 text-white'
                            : isDark
                                ? 'text-gray-400 hover:bg-gray-700'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        {language === 'en' ? CATEGORY_NAMES[category].en : CATEGORY_NAMES[category].vi}
                    </button>
                ))}
            </div>

            {/* Symbols Grid */}
            <div className="p-3 max-h-[300px] overflow-y-auto">
                <div className="grid grid-cols-4 gap-2">
                    {MATH_SYMBOLS[activeTab].map((symbol, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                onInsert(symbol.latex, symbol.cursorOffset);
                                // Don't close automatically - let user insert multiple symbols
                            }}
                            className={`p-3 rounded border transition-all hover:scale-105 ${isDark
                                ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-blue-500'
                                : 'bg-gray-50 border-gray-200 hover:bg-white hover:border-blue-500'
                                }`}
                            title={symbol.name}
                        >
                            <div className="flex items-center justify-center min-h-[30px]">
                                <MathRenderer math={symbol.display} />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Footer with hint */}
            <div className={`px-3 py-2 text-xs border-t ${isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'
                }`}>
                💡 {t('Tip: Click vào ký hiệu để chèn vào văn bản. Bọc trong $ $ để hiển thị.',
                    'Tip: Click symbol to insert. Wrap in $ $ to display.')}
            </div>
        </div>
    );
};
