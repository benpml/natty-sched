/**
 * Autocomplete-specific normalization for matching
 * This normalizes inputs to a canonical form for comparison while preserving originals for display
 */

const { normalizeInput } = require('./tokenizer');

/**
 * Normalize input specifically for autocomplete matching
 * Handles format variations so "9am" matches "9:00 AM"
 */
function normalizeForMatching(input) {
    if (!input) return '';

    let normalized = input.toLowerCase().trim();

    // First apply standard tokenizer normalization (typos, abbrev, etc)
    normalized = normalizeInput(normalized);

    // Additional autocomplete-specific normalizations

    // 1. TIME FORMAT NORMALIZATION (root cause of "9am" not matching "9:00 AM")
    // Expand "9am" to "9:00 am", "3:30pm" to "3:30 pm", etc.
    normalized = normalized
        .replace(/\b(\d{1,2}):?(\d{2})?\s*(am|pm)\b/gi, (match, hour, min, period) => {
            const minutes = min || '00';
            return `${hour}:${minutes} ${period.toLowerCase()}`;
        })
        // Handle bare times like "9am" without colon
        .replace(/\b(\d{1,2})(am|pm)\b/gi, '$1:00 $2');

    // 2. NATURAL LANGUAGE ALTERNATIVES (root cause of "each day" not working)
    normalized = normalized
        .replace(/\beach\b/g, 'every')
        .replace(/\ball\b(?=\s+(day|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday))/g, 'every')
        .replace(/\bper\b/g, 'a')  // "once per week" → "once a week"
        .replace(/\bone time\b/g, 'once');

    // 3. TIME-OF-DAY PHRASES (root cause of "morning" not working)
    // Don't replace these with times, just normalize the wording
    normalized = normalized
        .replace(/\bin the (morning|afternoon|evening)\b/g, '$1')
        .replace(/\bearly in the morning\b/g, 'early morning');

    // 4. BETTER SEPARATOR HANDLING (already in tokenizer but ensure it's applied)
    normalized = normalized
        .replace(/\s*\/\s*/g, ' and ')
        .replace(/\s*\+\s*/g, ' and ');

    // 5. GRAMMAR FORGIVENESS (root cause of "every weeks" not working)
    // Handle plural errors - "every weeks" → "every week"
    normalized = normalized
        .replace(/\bevery\s+(\d+)?\s*(days|weeks|months|years)s\b/g, 'every $1 $2')  // "every weekss" → "every weeks"
        .replace(/\bevery\s+weeks?\b/g, 'every week')
        .replace(/\bevery\s+months?\b/g, 'every month')
        .replace(/\bevery\s+years?\b/g, 'every year');

    // 6. COMMON TYPOS NOT IN TOKENIZER
    normalized = normalized
        .replace(/\btommorow\b/g, 'tomorrow')
        .replace(/\btomorrow\b/g, 'tomorrow')
        .replace(/\bwedsday\b/g, 'wednesday')
        .replace(/\bwendsday\b/g, 'wednesday');

    // 7. ORDINAL NORMALIZATION FOR DATES
    // "the 1st" → "1st", "day 1" → "1"
    normalized = normalized
        .replace(/\bthe\s+(\d+(?:st|nd|rd|th)?)\b/g, '$1')
        .replace(/\bday\s+(\d+)\b/g, '$1');

    // 8. ARTICLE REMOVAL FOR CLEANER MATCHING
    // Remove "the" and "a" in certain contexts to improve matching
    normalized = normalized
        .replace(/\bat\s+the\s+(beginning|end|start)\s+of\b/g, 'at $1 of')
        .replace(/\bonce\s+a\s+(day|week|month|year)\b/g, 'once $1')  // Normalize but keep "once"
        .replace(/\btwice\s+a\s+(day|week|month|year)\b/g, 'twice $1');

    // 9. MULTIPLE SPACES
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
}

/**
 * Check if input ends with a word that shouldn't have time appended
 * (root cause of "first monday of at 9:00 AM" problem)
 */
function endsWithIncompletePhrase(input) {
    const incomplete = [
        /\bof$/,           // "first monday of"
        /\bthe$/,          // "first monday of the"
        /\beach$/,         // "at the beginning of each"
        /\bbeginning$/,    // "at the beginning"
        /\bend$/,          // "at the end"
        /\bstart$/,        // "start"
        /\bfrom$/,         // "3 weeks from"
        /\bfirst$/,        // "the first"
        /\blast$/,         // "the last"
        /\band$/,          // "monday and" (but we handle this separately)
        /\b,$/,            // "monday,"
    ];

    const trimmed = input.trim().toLowerCase();
    return incomplete.some(pattern => pattern.test(trimmed));
}

/**
 * Check if input already ends with "at" to prevent "at at" bug
 */
function endsWithAt(input) {
    return /\bat\s*$/i.test(input.trim());
}

/**
 * Check if input already ends with "on" to prevent "on on" bug
 */
function endsWithOn(input) {
    return /\bon\s*$/i.test(input.trim());
}

/**
 * Extract time pattern from input if present
 * Returns null if no time found, otherwise returns normalized time
 */
function extractTime(input) {
    const timePattern = /\b(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)?\b/;
    const match = input.match(timePattern);
    if (match) {
        const hour = match[1];
        const min = match[2] || '00';
        const period = match[3] ? match[3].toLowerCase() : '';
        return period ? `${hour}:${min} ${period}` : `${hour}:${min}`;
    }
    return null;
}

module.exports = {
    normalizeForMatching,
    endsWithIncompletePhrase,
    endsWithAt,
    endsWithOn,
    extractTime
};
