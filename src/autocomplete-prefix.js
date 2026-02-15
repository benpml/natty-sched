/**
 * Prefix-preserving autocomplete generator
 * Completes user input by appending to it, not rewriting it
 */

const { normalizeInput } = require('./tokenizer');
const { parseNaturalSchedule } = require('./parser');
const { endsWithIncompletePhrase, endsWithAt, endsWithOn } = require('./autocomplete-normalizer');

const COMMON_TIMES = [
    '9:00 AM', '10:00 AM', '2:00 PM', '5:00 PM',
    '9:30 AM', '11:00 AM', '3:00 PM', '6:00 PM'
];

/**
 * Generate completions that START with the user's input
 * Preserves the user's exact text and appends to complete it
 */
function generatePrefixCompletions(userInput) {
    const normalized = normalizeInput(userInput);
    const completions = [];

    // Pattern 1: Incomplete day/week/month pattern needing time
    // "every day", "every monday", "weekdays", "every week on monday", etc.
    // BUT only if it doesn't already end with "at" and isn't an incomplete phrase
    if (isIncompleteSchedule(normalized) && !endsWithAt(userInput) && !endsWithIncompletePhrase(userInput)) {
        COMMON_TIMES.slice(0, 6).forEach(time => {
            completions.push({
                input: `${userInput} at ${time}`,
                source: 'dynamic',
                pattern: 'append_time'
            });
        });
    }

    // Pattern 2: Partial time completion
    // "every day at 3", "tomorrow at 5", etc.
    const timeMatch = userInput.match(/\s+at\s+(\d{1,2})$/i);
    if (timeMatch) {
        const hour = parseInt(timeMatch[1]);
        if (hour >= 1 && hour <= 12) {
            ['00', '15', '30', '45'].forEach(min => {
                completions.push({
                    input: `${userInput}:${min} AM`,
                    source: 'dynamic',
                    pattern: 'complete_time'
                });
                completions.push({
                    input: `${userInput}:${min} PM`,
                    source: 'dynamic',
                    pattern: 'complete_time'
                });
            });
        }
    }

    // Pattern 3: Incomplete "and" pattern for multiple days
    // "every monday and", "every week on monday and", etc.
    const andMatch = userInput.match(/\s+(and|,)\s*$/i);
    if (andMatch && !endsWithAt(userInput)) {
        // Extract already mentioned days to avoid suggesting them again
        const alreadyMentioned = new Set();
        const dayPattern = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
        let dayMatch;
        while ((dayMatch = dayPattern.exec(userInput)) !== null) {
            alreadyMentioned.add(dayMatch[1].toLowerCase());
        }

        const allWeekdays = ['Wednesday', 'Friday', 'Thursday', 'Tuesday', 'Monday', 'Saturday', 'Sunday'];
        const availableWeekdays = allWeekdays.filter(day => !alreadyMentioned.has(day.toLowerCase()));

        // First suggest just adding the weekday (without time)
        availableWeekdays.slice(0, 3).forEach(day => {
            completions.push({
                input: `${userInput} ${day}`,
                source: 'dynamic',
                pattern: 'append_weekday'
            });
        });
    }

    // Pattern 4: Incomplete "on" pattern
    // "on tuesday", "on the", "monthly on", etc.
    const onMatch = userInput.match(/\b(on|every\s+week\s+on|monthly\s+on)\s+([a-z]*)?$/i);
    if (onMatch && !endsWithIncompletePhrase(userInput)) {
        const prefix = onMatch[0];
        const partial = onMatch[2] || '';

        // If it's a weekday pattern and doesn't already end with "at"
        if (partial && /^[a-z]{2,}/i.test(partial) && !endsWithAt(userInput)) {
            COMMON_TIMES.slice(0, 4).forEach(time => {
                completions.push({
                    input: `${userInput} at ${time}`,
                    source: 'dynamic',
                    pattern: 'complete_on'
                });
            });
        }
        // If it's "on the" (monthly pattern) - don't append time yet, it's incomplete
        else if (/on\s+the\s*$/i.test(userInput)) {
            ['1st', '15th', 'last day'].forEach(day => {
                completions.push({
                    input: `${userInput} ${day}`,
                    source: 'dynamic',
                    pattern: 'complete_monthly_day'
                });
            });
        }
    }

    // Pattern 5: Partial "every N [unit]" - complete the unit or add time
    const everyNMatch = userInput.match(/^every\s+(\d+)\s+([a-z]+)?$/i);
    if (everyNMatch) {
        const count = everyNMatch[1];
        const partialUnit = everyNMatch[2] || '';

        // If unit is incomplete, complete it
        if (partialUnit.length > 0 && partialUnit.length < 4) {
            ['days', 'weeks', 'months', 'hours'].forEach(unit => {
                if (unit.startsWith(partialUnit.toLowerCase())) {
                    COMMON_TIMES.slice(0, 4).forEach(time => {
                        completions.push({
                            input: `Every ${count} ${unit} at ${time}`,
                            source: 'dynamic',
                            pattern: 'complete_unit'
                        });
                    });
                }
            });
        }
    }

    return completions;
}

/**
 * Check if the input is an incomplete schedule that needs a time
 */
function isIncompleteSchedule(normalized) {
    // Has schedule pattern but no time
    const hasPattern = /\b(every|daily|weekly|monthly|weekdays?|weekends?|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(normalized);
    const hasTime = /\bat\s+\d+:?\d*\s*(am|pm)?$/i.test(normalized);
    return hasPattern && !hasTime;
}

/**
 * Validate and parse completions
 */
function validatePrefixCompletions(completions) {
    return completions.map(comp => {
        try {
            const parsed = parseNaturalSchedule(comp.input);
            return {
                ...comp,
                label: comp.input,
                value: parsed,
                valid: true
            };
        } catch (error) {
            return null;
        }
    }).filter(c => c !== null);
}

module.exports = {
    generatePrefixCompletions,
    validatePrefixCompletions
};
