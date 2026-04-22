/**
 * Utility functions for handling question answers across old and new API formats
 * Migration: correct_answer_keys/correct_matches -> correct_answers
 * Date: December 13, 2025
 */

// Re-export types from onlineTestService for consistency
export type MatchPair = { left_key: string; right_key: string };
export type CompletionAnswer = { blank_key: string; answers: string[] }; // [{blank_key: "1", answers: ["text"]}]
export type MapLabelAnswer = { label_key: string; option_key: string };

/**
 * Get correct answers from question, supporting both old and new formats
 * Handles backward compatibility during migration period
 */
export function getCorrectAnswers(question: any): string[] | MatchPair[] | MapLabelAnswer[] | CompletionAnswer[] {
    // Try new unified field first (priority)
    if (question.correct_answers !== undefined && question.correct_answers !== null) {
        return question.correct_answers;
    }

    // Fallback to old fields based on question type
    switch (question.question_type) {
        case 'mcq':
        case 'short_answer':
            // Old: correct_answer_keys or correct_answer_key
            if (question.correct_answer_keys) {
                return question.correct_answer_keys;
            }
            if (question.correct_answer_key) {
                return [question.correct_answer_key];
            }
            break;

        case 'matching':
            // Old: correct_matches (object or array format)
            if (question.correct_matches) {
                if (Array.isArray(question.correct_matches)) {
                    return question.correct_matches;
                }
                // Convert object format to array: {"1": "A"} -> [{left_key: "1", right_key: "A"}]
                return Object.entries(question.correct_matches).map(([left_key, right_key]) => ({
                    left_key,
                    right_key: right_key as string
                }));
            }
            break;

        case 'map_labeling':
            // Old: correct_labels (object or array format)
            if (question.correct_labels) {
                if (Array.isArray(question.correct_labels)) {
                    return question.correct_labels;
                }
                // Convert object format to array: {"1": "C"} -> [{label_key: "1", option_key: "C"}]
                return Object.entries(question.correct_labels).map(([label_key, option_key]) => ({
                    label_key,
                    option_key: option_key as string
                }));
            }
            break;

        case 'completion':
            // Old and new both use correct_answers (no change needed)
            // Format: [{blank_key: "1", answers: ["AF123", "Flight AF123"]}]
            if (question.correct_answers) {
                return question.correct_answers;
            }
            break;

        case 'sentence_completion':
            // Sentence completion uses sentences[].correct_answers
            // This function doesn't handle it directly (handled at sentence level)
            break;

        case 'essay':
            // Essay questions don't have correct answers
            break;
    }

    return [];
}

/**
 * Check if user answer matches correct answer(s)
 * Handles multiple correct answers and case sensitivity
 */
export function isAnswerCorrect(
    userAnswer: string | string[] | Record<string, string>,
    correctAnswers: string[] | MatchPair[] | MapLabelAnswer[] | CompletionAnswer[],
    questionType: string,
    options?: { caseSensitive?: boolean }
): boolean {
    const caseSensitive = options?.caseSensitive ?? false;

    switch (questionType) {
        case 'mcq':
            // MCQ: check if user answer is in correct answers array
            const userMcqAnswer = Array.isArray(userAnswer) ? userAnswer : [userAnswer as string];
            const correctMcqAnswers = correctAnswers as string[];

            if (userMcqAnswer.length !== correctMcqAnswers.length) return false;

            return userMcqAnswer.every(ans =>
                correctMcqAnswers.some(correct => {
                    const ansStr = String(ans);
                    const correctStr = String(correct);
                    return caseSensitive
                        ? ansStr === correctStr
                        : ansStr.toLowerCase() === correctStr.toLowerCase();
                })
            ); case 'matching':
            // Matching: compare user matches with correct matches
            const userMatches = userAnswer as Record<string, string>;
            const correctMatches = correctAnswers as MatchPair[];

            return correctMatches.every(({ left_key, right_key }) =>
                userMatches[left_key] === right_key
            );

        case 'map_labeling':
            // Map labeling: compare user labels with correct labels
            const userLabels = userAnswer as Record<string, string>;
            const correctLabels = correctAnswers as MapLabelAnswer[];

            return correctLabels.every(({ label_key, option_key }) =>
                userLabels[label_key] === option_key
            );

        case 'completion':
            // Completion: check each blank
            // correct_answers format: [{blank_key: "1", answers: ["text"]}, {blank_key: "2", answers: ["text2"]}]
            const userCompletions = userAnswer as Record<string, string>;
            const correctCompletions = correctAnswers as CompletionAnswer[];

            return correctCompletions.every(blank => {
                const userValue = userCompletions[blank.blank_key];
                const correctValues = blank.answers || [];
                return correctValues.some(correctValue =>
                    caseSensitive
                        ? userValue === correctValue
                        : userValue?.toLowerCase() === correctValue?.toLowerCase()
                );
            });

        case 'short_answer':
            // Short answer: accept any of the correct answers
            const userShortAnswer = typeof userAnswer === 'string'
                ? userAnswer
                : Array.isArray(userAnswer) ? userAnswer[0] : String(userAnswer);
            const correctShortAnswers = correctAnswers as string[];

            return correctShortAnswers.some(correct =>
                caseSensitive
                    ? userShortAnswer === correct
                    : userShortAnswer?.toLowerCase() === correct?.toLowerCase()
            );

        case 'sentence_completion':
            // Handled at sentence level, not here
            return false;

        case 'essay':
            // Essays don't have correct/incorrect answers
            return false;

        default:
            return false;
    }
}

/**
 * Normalize question data for API submission
 * Converts old format to new format
 */
export function normalizeQuestionForAPI(question: any): any {
    const normalized = { ...question };

    // If question already has correct_answers, use it
    if (normalized.correct_answers) {
        return normalized;
    }

    // Convert old formats to new correct_answers format
    switch (question.question_type) {
        case 'mcq':
        case 'short_answer':
            if (question.correct_answer_keys) {
                normalized.correct_answers = question.correct_answer_keys;
                delete normalized.correct_answer_keys;
                delete normalized.correct_answer_key;
            } else if (question.correct_answer_key) {
                normalized.correct_answers = [question.correct_answer_key];
                delete normalized.correct_answer_key;
            }
            break;

        case 'matching':
            if (question.correct_matches) {
                // If already array format, use it
                if (Array.isArray(question.correct_matches)) {
                    normalized.correct_answers = question.correct_matches;
                } else {
                    // Convert object to array
                    normalized.correct_answers = Object.entries(question.correct_matches).map(
                        ([left_key, right_key]) => ({ left_key, right_key })
                    );
                }
                delete normalized.correct_matches;
            }
            break;

        case 'map_labeling':
            if (question.correct_labels) {
                // If already array format, use it
                if (Array.isArray(question.correct_labels)) {
                    normalized.correct_answers = question.correct_labels;
                } else {
                    // Convert object to array
                    normalized.correct_answers = Object.entries(question.correct_labels).map(
                        ([label_key, option_key]) => ({ label_key, option_key })
                    );
                }
                delete normalized.correct_labels;
            }
            break;

        case 'completion':
            // Already uses correct_answers, no change needed
            break;

        case 'sentence_completion':
            // Sentences have their own correct_answers at sentence level
            break;

        case 'essay':
            // No correct answers
            break;
    }

    return normalized;
}

/**
 * Get correct answers for MCQ specifically (returns string array)
 * Helper for MCQ components
 */
export function getMCQCorrectAnswers(question: any): string[] {
    const answers = getCorrectAnswers(question);
    return Array.isArray(answers) && typeof answers[0] === 'string'
        ? answers as string[]
        : [];
}

/**
 * Get correct matches for Matching questions
 * Returns both array and object formats for compatibility
 */
export function getMatchingCorrectAnswers(question: any): {
    array: MatchPair[];
    object: Record<string, string>;
} {
    const answers = getCorrectAnswers(question);

    if (Array.isArray(answers) && answers.length > 0 && typeof answers[0] === 'object' && answers[0] !== null && 'left_key' in answers[0]) {
        const matchArray = answers as MatchPair[];
        const matchObject: Record<string, string> = {};
        matchArray.forEach(({ left_key, right_key }) => {
            matchObject[left_key] = right_key;
        });
        return { array: matchArray, object: matchObject };
    }

    return { array: [], object: {} };
}

/**
 * Get correct labels for Map Labeling questions
 * Returns both array and object formats for compatibility
 */
export function getMapLabelingCorrectAnswers(question: any): {
    array: MapLabelAnswer[];
    object: Record<string, string>;
} {
    const answers = getCorrectAnswers(question);

    if (Array.isArray(answers) && answers.length > 0 && typeof answers[0] === 'object' && answers[0] !== null && 'label_key' in answers[0]) {
        const labelArray = answers as MapLabelAnswer[];
        const labelObject: Record<string, string> = {};
        labelArray.forEach(({ label_key, option_key }) => {
            labelObject[label_key] = option_key;
        });
        return { array: labelArray, object: labelObject };
    }

    return { array: [], object: {} };
}

/**
 * Get correct answers for Completion questions
 * Returns CompletionAnswer[] format: [{blank_key: "1", answers: ["text"]}]
 */
export function getCompletionCorrectAnswers(question: any): CompletionAnswer[] {
    const answers = getCorrectAnswers(question);
    // If correct_answers is already CompletionAnswer[] format
    if (Array.isArray(answers) && answers.length > 0 && typeof answers[0] === 'object' && answers[0] !== null && 'blank_key' in answers[0]) {
        return answers as CompletionAnswer[];
    }
    return [];
}
