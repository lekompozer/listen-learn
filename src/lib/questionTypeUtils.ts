/**
 * Question Type Utilities
 * Helper functions for displaying and handling 8 question types
 * December 9, 2025 - IELTS Question Types Support
 * UPDATED: December 12, 2025 - Added 'mcq_multiple' for multi-answer MCQ
 */

export type QuestionType = 'mcq' | 'mcq_multiple' | 'essay' | 'matching' | 'map_labeling' | 'completion' | 'sentence_completion' | 'short_answer' | 'listening' | 'true_false_multiple';

export interface QuestionTypeInfo {
    type: QuestionType;
    label: string;
    labelVi: string;
    icon: string; // Emoji or icon identifier
    description: string;
    descriptionVi: string;
    color: string; // Tailwind color class
}

export const QUESTION_TYPE_INFO: Record<QuestionType, QuestionTypeInfo> = {
    mcq: {
        type: 'mcq',
        label: 'Multiple Choice',
        labelVi: 'Trắc nghiệm',
        icon: '✓',
        description: 'Select one correct answer',
        descriptionVi: 'Chọn 1 đáp án đúng',
        color: 'text-blue-600'
    },
    mcq_multiple: {
        type: 'mcq_multiple',
        label: 'Multiple Choice (Multiple Answers)',
        labelVi: 'Trắc nghiệm (Nhiều đáp án)',
        icon: '☑',
        description: 'Select multiple correct answers',
        descriptionVi: 'Chọn nhiều đáp án đúng',
        color: 'text-blue-600'
    },
    essay: {
        type: 'essay',
        label: 'Essay',
        labelVi: 'Tự luận',
        icon: '✍',
        description: 'Write a detailed response',
        descriptionVi: 'Viết câu trả lời chi tiết',
        color: 'text-purple-600'
    },
    matching: {
        type: 'matching',
        label: 'Matching',
        labelVi: 'Nối đáp án',
        icon: '⇄',
        description: 'Match items from two lists',
        descriptionVi: 'Nối các mục tương ứng',
        color: 'text-green-600'
    },
    map_labeling: {
        type: 'map_labeling',
        label: 'Map/Diagram Labeling',
        labelVi: 'Gắn nhãn bản đồ',
        icon: '🗺',
        description: 'Label positions on a diagram',
        descriptionVi: 'Gắn nhãn vào sơ đồ',
        color: 'text-orange-600'
    },
    completion: {
        type: 'completion',
        label: 'Form Completion',
        labelVi: 'Điền thông tin',
        icon: '📝',
        description: 'Fill in blanks with words or phrases',
        descriptionVi: 'Điền vào chỗ trống',
        color: 'text-teal-600'
    },
    sentence_completion: {
        type: 'sentence_completion',
        label: 'Sentence Completion',
        labelVi: 'Hoàn thành câu',
        icon: '✏',
        description: 'Complete sentences with appropriate words',
        descriptionVi: 'Hoàn thiện các câu',
        color: 'text-indigo-600'
    },
    short_answer: {
        type: 'short_answer',
        label: 'Short Answer',
        labelVi: 'Trả lời ngắn',
        icon: '💬',
        description: 'Answer questions with short responses',
        descriptionVi: 'Trả lời câu hỏi ngắn gọn',
        color: 'text-pink-600'
    },
    listening: {
        type: 'listening',
        label: 'Listening',
        labelVi: 'Nghe hiểu',
        icon: '🎧',
        description: 'Listen to audio and answer questions',
        descriptionVi: 'Nghe và trả lời câu hỏi',
        color: 'text-red-600'
    },
    true_false_multiple: {
        type: 'true_false_multiple',
        label: 'True/False Multiple',
        labelVi: 'Đúng/Sai Nhiều Ý',
        icon: '☑',
        description: 'Multiple true/false statements',
        descriptionVi: 'Nhiều khẳng định đúng/sai',
        color: 'text-purple-600'
    }
};

/**
 * Get label for question type
 */
export function getQuestionTypeLabel(type: QuestionType | undefined, language: 'en' | 'vi' = 'vi'): string {
    if (!type) return language === 'vi' ? 'Trắc nghiệm' : 'Multiple Choice';
    const info = QUESTION_TYPE_INFO[type];
    return language === 'vi' ? info.labelVi : info.label;
}

/**
 * Get icon for question type
 */
export function getQuestionTypeIcon(type: QuestionType | undefined): string {
    if (!type) return '✓';
    return QUESTION_TYPE_INFO[type]?.icon || '?';
}

/**
 * Get color class for question type
 */
export function getQuestionTypeColor(type: QuestionType | undefined): string {
    if (!type) return 'text-blue-600';
    return QUESTION_TYPE_INFO[type]?.color || 'text-gray-600';
}

/**
 * Get description for question type
 */
export function getQuestionTypeDescription(type: QuestionType | undefined, language: 'en' | 'vi' = 'vi'): string {
    if (!type) return '';
    const info = QUESTION_TYPE_INFO[type];
    return language === 'vi' ? info.descriptionVi : info.description;
}

/**
 * Check if question type is auto-gradable
 */
export function isAutoGradable(type: QuestionType | undefined): boolean {
    if (!type) return true; // Default MCQ is auto-gradable
    return type !== 'essay';
}

/**
 * Check if question type requires text input
 */
export function requiresTextInput(type: QuestionType | undefined): boolean {
    return type === 'essay' || type === 'completion' || type === 'sentence_completion' || type === 'short_answer';
}

/**
 * Check if question type uses proportional scoring
 */
export function usesProportionalScoring(type: QuestionType | undefined): boolean {
    return type === 'matching' || type === 'map_labeling' || type === 'completion' ||
        type === 'sentence_completion' || type === 'short_answer';
}

/**
 * Count questions by type
 */
export function countQuestionsByType(questions: { question_type?: string }[]): Record<string, number> {
    const counts: Record<string, number> = {};

    questions.forEach(q => {
        const type = q.question_type || 'mcq';
        counts[type] = (counts[type] || 0) + 1;
    });

    return counts;
}

/**
 * Format question type breakdown for display
 * Example: "5 MCQ, 3 Matching, 2 Completion"
 */
export function formatQuestionTypeBreakdown(questions: { question_type?: string }[], language: 'en' | 'vi' = 'vi'): string {
    const counts = countQuestionsByType(questions);
    const parts: string[] = [];

    Object.entries(counts).forEach(([type, count]) => {
        const label = getQuestionTypeLabel(type as QuestionType, language);
        parts.push(`${count} ${label}`);
    });

    return parts.join(', ') || (language === 'vi' ? 'Không có câu hỏi' : 'No questions');
}

/**
 * Get max word count for text input types
 */
export function getWordLimit(question: any, blankKey?: string): number | undefined {
    const type = question.question_type;

    if (type === 'completion' && blankKey && question.blanks) {
        const blank = question.blanks.find((b: any) => b.key === blankKey);
        return blank?.word_limit;
    }

    if (type === 'sentence_completion' && blankKey && question.sentences) {
        const sentence = question.sentences.find((s: any) => s.key === blankKey);
        return sentence?.word_limit;
    }

    if (type === 'short_answer' && blankKey && question.questions) {
        const q = question.questions.find((sq: any) => sq.key === blankKey);
        return q?.word_limit;
    }

    return undefined;
}

/**
 * Validate answer format for question type
 */
export function validateAnswerFormat(questionType: QuestionType | undefined, answer: any): boolean {
    if (!answer) return false;

    switch (questionType) {
        case 'mcq':
        case 'mcq_multiple':
            return typeof answer === 'object' &&
                (typeof answer.selected_answer_key === 'string' || Array.isArray(answer.selected_answer_keys));

        case 'essay':
            return typeof answer === 'object' && typeof answer.essay_answer === 'string';

        case 'matching':
        case 'map_labeling':
            return typeof answer === 'object' &&
                (typeof answer.matches === 'object' || typeof answer.labels === 'object');

        case 'completion':
        case 'sentence_completion':
        case 'short_answer':
            return typeof answer === 'object' && typeof answer.answers === 'object';

        default:
            return true; // Fallback for unknown types
    }
}
