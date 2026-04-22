/**
 * Test Marketplace Categories
 * Shared constants for category selection across components
 */

export interface CategoryOption {
    value: string;
    labelVi: string;
    labelEn: string;
    icon?: string;
}

export const TEST_CATEGORIES: CategoryOption[] = [
    { value: 'programming', labelVi: 'Lập trình', labelEn: 'Programming', icon: '💻' },
    { value: 'language', labelVi: 'Ngoại ngữ', labelEn: 'Language', icon: '🗣️' },
    { value: 'math', labelVi: 'Toán học', labelEn: 'Mathematics', icon: '🔢' },
    { value: 'science', labelVi: 'Khoa học', labelEn: 'Science', icon: '🔬' },
    { value: 'business', labelVi: 'Kinh doanh', labelEn: 'Business', icon: '💼' },
    { value: 'technology', labelVi: 'Công nghệ', labelEn: 'Technology', icon: '⚡' },
    { value: 'self_development', labelVi: 'Phát triển bản thân', labelEn: 'Self-Development', icon: '🌱' },
    { value: 'exam_prep', labelVi: 'Luyện thi', labelEn: 'Exam Preparation', icon: '📝' },
    { value: 'certification', labelVi: 'Chứng chỉ', labelEn: 'Certification', icon: '🏆' },
    { value: 'other', labelVi: 'Khác', labelEn: 'Other', icon: '📋' },
];

/**
 * Get category display name
 */
export const getCategoryLabel = (categoryValue: string, language: 'vi' | 'en'): string => {
    const category = TEST_CATEGORIES.find(cat => cat.value === categoryValue);
    if (!category) {
        // Fallback for general or unknown categories
        return language === 'en' ? 'General' : 'Chung';
    }
    return language === 'en' ? category.labelEn : category.labelVi;
};

/**
 * Get category icon
 */
export const getCategoryIcon = (categoryValue: string): string => {
    const category = TEST_CATEGORIES.find(cat => cat.value === categoryValue);
    return category?.icon || '📚';
};

/**
 * Validate if category is one of the allowed 10 categories
 */
export const isValidCategory = (categoryValue: string): boolean => {
    return TEST_CATEGORIES.some(cat => cat.value === categoryValue);
};

/**
 * Get all valid category values
 */
export const getValidCategoryValues = (): string[] => {
    return TEST_CATEGORIES.map(cat => cat.value);
};

/**
 * Map internal category ID (e.g. 'self_development') → API-expected value (e.g. 'Self-Development').
 * The API is case-insensitive for simple names, but compound names with spaces/hyphens must match exactly.
 * Returns undefined when id is 'all' or unknown (caller omits the param).
 */
export const categoryToApiValue = (id: string): string | undefined => {
    if (!id || id === 'all') return undefined;
    const map: Record<string, string> = {
        language: 'Language',
        self_development: 'Self-Development',
        exam_prep: 'Exam Prep',
        math: 'Mathematics',
        programming: 'Programming',
        science: 'Science',
        business: 'Business',
        technology: 'Technology',
        certification: 'Certification',
        other: 'Other',
    };
    return map[id] ?? id; // fallback: pass as-is (API is case-insensitive for simple names)
};
