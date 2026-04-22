/**
 * HTML to LaTeX Converter
 * Converts HTML/MathML math notation to LaTeX format
 * December 19, 2025
 */

/**
 * Convert HTML math notation to LaTeX
 * Handles common cases from DeepSeek/ChatGPT copy-paste
 * ONLY converts math symbols, preserves regular text and spacing
 */
export function convertHtmlToLatex(html: string): string {
    let latex = html;

    // Remove zero-width spaces and other invisible characters
    latex = latex.replace(/[\u200B-\u200D\uFEFF]/g, '');

    // Remove HTML line breaks
    latex = latex.replace(/<br\s*\/?>/gi, '\n');

    // Convert subscripts: H<sub>2</sub> → H_2 or H₂ → H_2
    latex = latex.replace(/<sub>([^<]+)<\/sub>/gi, '_{$1}');
    // Unicode subscripts - match any position, not just after letter
    latex = latex.replace(/₀/g, '_0');
    latex = latex.replace(/₁/g, '_1');
    latex = latex.replace(/₂/g, '_2');
    latex = latex.replace(/₃/g, '_3');
    latex = latex.replace(/₄/g, '_4');
    latex = latex.replace(/₅/g, '_5');
    latex = latex.replace(/₆/g, '_6');
    latex = latex.replace(/₇/g, '_7');
    latex = latex.replace(/₈/g, '_8');
    latex = latex.replace(/₉/g, '_9');

    // Convert superscripts: x<sup>2</sup> → x^2 or x² → x^2
    latex = latex.replace(/<sup>([^<]+)<\/sup>/gi, '^{$1}');
    // Unicode superscripts - match any position
    latex = latex.replace(/⁰/g, '^0');
    latex = latex.replace(/¹/g, '^1');
    latex = latex.replace(/²/g, '^2');
    latex = latex.replace(/³/g, '^3');
    latex = latex.replace(/⁴/g, '^4');
    latex = latex.replace(/⁵/g, '^5');
    latex = latex.replace(/⁶/g, '^6');
    latex = latex.replace(/⁷/g, '^7');
    latex = latex.replace(/⁸/g, '^8');
    latex = latex.replace(/⁹/g, '^9');
    latex = latex.replace(/⁻/g, '^{-}');
    latex = latex.replace(/⁺/g, '^{+}');

    // Convert arrows
    latex = latex.replace(/→/g, '\\rightarrow');
    latex = latex.replace(/←/g, '\\leftarrow');
    latex = latex.replace(/⇌/g, '\\rightleftharpoons');
    latex = latex.replace(/⇄/g, '\\rightleftharpoons');
    latex = latex.replace(/⟶/g, '\\longrightarrow');

    // Convert Greek letters (common ones)
    latex = latex.replace(/Δ/g, '\\Delta');
    latex = latex.replace(/α/g, '\\alpha');
    latex = latex.replace(/β/g, '\\beta');
    latex = latex.replace(/γ/g, '\\gamma');
    latex = latex.replace(/δ/g, '\\delta');
    latex = latex.replace(/π/g, '\\pi');
    latex = latex.replace(/μ/g, '\\mu');
    latex = latex.replace(/σ/g, '\\sigma');
    latex = latex.replace(/θ/g, '\\theta');
    latex = latex.replace(/λ/g, '\\lambda');

    // Convert multiplication dot
    latex = latex.replace(/·/g, '\\cdot');
    latex = latex.replace(/×/g, '\\times');

    // Convert degree symbol
    latex = latex.replace(/°/g, '^\\circ');

    // Remove HTML tags
    latex = latex.replace(/<[^>]+>/g, '');

    // Clean up excessive newlines/spaces but preserve single spaces
    latex = latex.replace(/\n\s*\n\s*\n+/g, '\n\n'); // Multiple blank lines → double newline
    latex = latex.replace(/[ \t]+/g, ' '); // Multiple spaces/tabs → single space

    // Clean up spaces around subscripts/superscripts ONLY
    latex = latex.replace(/\s+(_\{?[\d+-]+\}?)/g, '$1'); // "H _2" → "H_2"
    latex = latex.replace(/(_\{?[\d+-]+\}?)\s+/g, '$1'); // "H_2 (g)" → "H_2(g)" - wait no, keep space before parentheses
    latex = latex.replace(/\s+(\^\{?[\d+-]+\}?)/g, '$1'); // "x ^2" → "x^2"
    latex = latex.replace(/(\^\{?[\d+-]+\}?)\s+/g, '$1 '); // Keep space after superscript

    // Detect chemical formulas and wrap with \mathrm{}
    // Match: Capital letter + optional lowercase + subscripts/superscripts + optional (state)
    // Only wrap if it has subscripts/superscripts or is followed by (g)/(l)/(aq)/(s)
    // Don't wrap standalone capital letters in normal text
    latex = latex.replace(/([A-Z][a-z]?)(_\d+|\^\{?[+-]?\d+\}?)+(\([a-zql]+\))?/g, (match) => {
        return `\\mathrm{${match}}`;
    });

    // Also wrap chemical formulas with state symbols: H(g), HI(g), etc.
    latex = latex.replace(/([A-Z][a-z]?)(\([agqlsAGQLs]+\))/g, (match) => {
        // Don't wrap if already wrapped
        if (latex.indexOf(`\\mathrm{${match}}`) !== -1) return match;
        return `\\mathrm{${match}}`;
    });

    // Wrap concentration brackets [X] with proper formatting
    latex = latex.replace(/\[([A-Za-z0-9_{}^\\]+)\]/g, (match, content) => {
        // Remove existing \mathrm if present to avoid double wrapping
        const cleaned = content.replace(/\\mathrm\{([^}]+)\}/g, '$1');
        return `[\\mathrm{${cleaned}}]`;
    });

    // Clean up double mathrm and nested braces
    let prevLatex = '';
    while (prevLatex !== latex) {
        prevLatex = latex;
        latex = latex.replace(/\\mathrm\{\\mathrm\{/g, '\\mathrm{');
        latex = latex.replace(/\}\}([^\}])/g, '}$1');
    }

    // Final cleanup - trim but preserve internal spacing
    latex = latex.trim();

    return latex;
}

/**
 * Detect if text looks like HTML math content
 */
export function isHtmlMath(text: string): boolean {
    return (
        text.includes('<sub>') ||
        text.includes('<sup>') ||
        text.includes('₀') || text.includes('₁') || text.includes('₂') ||
        text.includes('⁰') || text.includes('¹') || text.includes('²') ||
        text.includes('→') || text.includes('⇌') ||
        text.includes('Δ') || text.includes('α') || text.includes('π')
    );
}

/**
 * Smart convert: wrap ONLY math parts with $...$, keep regular text outside
 */
export function smartConvertHtmlToLatex(text: string): string {
    if (!isHtmlMath(text)) {
        return text;
    }

    const converted = convertHtmlToLatex(text);

    // Don't auto-wrap entire text in $...$
    // Instead, only wrap individual math expressions
    // Pattern: Find sequences with \mathrm{}, LaTeX commands, or subscripts/superscripts

    // Split text into math and non-math parts
    const parts: string[] = [];
    let currentPos = 0;

    // Find all math expressions (anything with LaTeX commands or chemical formulas)
    const mathPattern = /\\mathrm\{[^}]+\}|\\[a-z]+|[A-Z][a-z]?(_\d+|\^\{?[+-]?\d+\}?)+(\([a-z]+\))?|\[[^\]]+\]/g;
    let match;

    const regex = new RegExp(mathPattern);
    while ((match = regex.exec(converted)) !== null) {
        // Add text before match (regular text)
        if (match.index > currentPos) {
            parts.push(converted.substring(currentPos, match.index));
        }

        // Add match wrapped in $...$ if not already wrapped
        const matchedText = match[0];
        if (!matchedText.startsWith('$')) {
            parts.push(`$${matchedText}$`);
        } else {
            parts.push(matchedText);
        }

        currentPos = match.index + matchedText.length;
    }

    // Add remaining text
    if (currentPos < converted.length) {
        parts.push(converted.substring(currentPos));
    }

    // If no math found, just return converted
    if (parts.length === 0) {
        return converted;
    }

    return parts.join('');
}
