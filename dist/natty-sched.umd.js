(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.NattySched = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/**
 * Natural Scheduler - Convert natural language to JSON schedule format
 */

const { parseNaturalSchedule } = require('./src/parser');
const { getNextScheduledTime } = require('./src/calculator');
const { getSuggestions, getSuggestionsByCategory, getPopularSuggestions } = require('./src/autocomplete');
const { getTemplatesByCategory, getCategories } = require('./src/autocomplete-templates');

module.exports = {
    // Core parsing and calculation
    parse: parseNaturalSchedule,
    parseNaturalSchedule,
    getNextScheduledTime,
    nextRun: getNextScheduledTime, // Alias

    // Autocomplete functionality
    getSuggestions,
    autocomplete: getSuggestions, // Alias
    getSuggestionsByCategory,
    getPopularSuggestions,
    getTemplatesByCategory,
    getCategories
};

},{"./src/autocomplete":5,"./src/autocomplete-templates":4,"./src/calculator":7,"./src/parser":10}],2:[function(require,module,exports){
/**
 * Pattern detection and dynamic generation engine for autocomplete
 */

const { parseNaturalSchedule } = require('./parser');

// Common value sets for dynamic generation
const COMMON_TIMES = [
    '9:00 AM', '9:30 AM', '10:00 AM', '11:00 AM', '12:00 PM',
    '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM',
    '8:00 AM', '7:00 PM', '8:00 PM', '9:00 PM'
];

const WEEKDAY_NAMES = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
    'Saturday', 'Sunday'
];

const WEEKDAY_GROUPS = [
    { name: 'weekdays', label: 'weekdays', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
    { name: 'weekends', label: 'weekend', days: ['Saturday', 'Sunday'] }
];

const MONTH_DAYS = [1, 5, 10, 15, 20, 25];
const ORDINALS = ['first', 'second', 'third', 'fourth', 'last'];

/**
 * Pattern definitions with detection and generation logic
 */
const PATTERNS = [
    {
        id: 'every_weekday',
        detect: (input) => /^every\s+(mon|tue|wed|thu|fri|sat|sun)/i.test(input),
        priority: 8,
        generate: (input) => {
            const match = input.match(/^every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
            if (!match) return [];

            const weekday = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
            return COMMON_TIMES.slice(0, 8).map(time => ({
                input: `Every ${weekday} at ${time}`,
                source: 'dynamic',
                pattern: 'every_weekday'
            }));
        }
    },
    {
        id: 'every_unit',
        detect: (input) => /^every\s+(\d+\s+)?(day|hour|minute|week|month|year)/i.test(input),
        priority: 7,
        generate: (input) => {
            const match = input.match(/^every\s+(\d+\s+)?(day|hour|minute|week|month|year)/i);
            if (!match) return [];

            const count = match[1] ? match[1].trim() : '';
            const unit = match[2].toLowerCase();
            const suggestions = [];

            if (unit === 'day') {
                COMMON_TIMES.slice(0, 6).forEach(time => {
                    suggestions.push({
                        input: count ? `Every ${count} days at ${time}` : `Every day at ${time}`,
                        source: 'dynamic',
                        pattern: 'every_unit'
                    });
                });
            } else if (unit === 'week') {
                COMMON_TIMES.slice(0, 4).forEach(time => {
                    suggestions.push({
                        input: count ? `Every ${count} weeks on Monday at ${time}` : `Every week on Monday at ${time}`,
                        source: 'dynamic',
                        pattern: 'every_unit'
                    });
                });
            } else if (unit === 'month') {
                COMMON_TIMES.slice(0, 4).forEach(time => {
                    suggestions.push({
                        input: count ? `Every ${count} months on the 1st at ${time}` : `Every month on the 1st at ${time}`,
                        source: 'dynamic',
                        pattern: 'every_unit'
                    });
                });
            } else if (unit === 'hour') {
                [':00', ':15', ':30', ':45'].forEach(min => {
                    suggestions.push({
                        input: count ? `Every ${count} hours at ${min}` : `Every hour at ${min}`,
                        source: 'dynamic',
                        pattern: 'every_unit'
                    });
                });
            } else if (unit === 'minute') {
                suggestions.push({
                    input: count ? `Every ${count} minutes` : `Every 15 minutes`,
                    source: 'dynamic',
                    pattern: 'every_unit'
                });
            } else if (unit === 'year') {
                suggestions.push({
                    input: count ? `Every ${count} years on January 1st at 12:00 PM` : `Every year on January 1st at 12:00 PM`,
                    source: 'dynamic',
                    pattern: 'every_unit'
                });
            }

            return suggestions;
        }
    },
    {
        id: 'weekday_at',
        detect: (input) => /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at/i.test(input),
        priority: 9,
        generate: (input) => {
            const match = input.match(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at/i);
            if (!match) return [];

            const weekday = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
            return COMMON_TIMES.slice(0, 10).map(time => ({
                input: `Every ${weekday} at ${time}`,
                source: 'dynamic',
                pattern: 'weekday_at'
            }));
        }
    },
    {
        id: 'daily_at',
        detect: (input) => /^(daily|every\s+day)\s+at/i.test(input),
        priority: 9,
        generate: (input) => {
            return COMMON_TIMES.slice(0, 10).map(time => ({
                input: `Every day at ${time}`,
                source: 'dynamic',
                pattern: 'daily_at'
            }));
        }
    },
    {
        id: 'monthly_on',
        detect: (input) => /^(monthly|every\s+month)\s+on/i.test(input),
        priority: 8,
        generate: (input) => {
            const suggestions = [];

            // Numbered days
            MONTH_DAYS.forEach(day => {
                const suffix = getDaySuffix(day);
                COMMON_TIMES.slice(0, 4).forEach(time => {
                    suggestions.push({
                        input: `Every month on the ${day}${suffix} at ${time}`,
                        source: 'dynamic',
                        pattern: 'monthly_on'
                    });
                });
            });

            // Weekday positions
            ORDINALS.slice(0, 3).forEach(ordinal => {
                WEEKDAY_NAMES.slice(0, 3).forEach(weekday => {
                    suggestions.push({
                        input: `Every month on the ${ordinal} ${weekday} at 9:00 AM`,
                        source: 'dynamic',
                        pattern: 'monthly_on'
                    });
                });
            });

            return suggestions.slice(0, 15);
        }
    },
    {
        id: 'weekdays_at',
        detect: (input) => /^weekdays?\s+at/i.test(input),
        priority: 9,
        generate: (input) => {
            return COMMON_TIMES.slice(0, 8).map(time => ({
                input: `Weekdays at ${time}`,
                source: 'dynamic',
                pattern: 'weekdays_at'
            }));
        }
    },
    {
        id: 'ordinal_weekday',
        detect: (input) => /^(first|second|third|fourth|fifth|last)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(input),
        priority: 8,
        generate: (input) => {
            const match = input.match(/^(first|second|third|fourth|fifth|last)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
            if (!match) return [];

            const ordinal = match[1].toLowerCase();
            const weekday = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();

            return COMMON_TIMES.slice(0, 6).map(time => ({
                input: `${ordinal.charAt(0).toUpperCase() + ordinal.slice(1)} ${weekday} of the month at ${time}`,
                source: 'dynamic',
                pattern: 'ordinal_weekday'
            }));
        }
    },
    {
        id: 'at_time',
        detect: (input) => /\s+at\s+\d{1,2}$/i.test(input) || /^at\s+\d{1,2}$/i.test(input),
        priority: 10, // High priority - user is typing specific time
        generate: (input) => {
            // Match pattern: [anything] at [digit(s)]
            const match = input.match(/^(.*?)\s*at\s+(\d{1,2})$/i);
            if (!match) return [];

            let prefix = match[1].trim();
            const hour = parseInt(match[2]);
            const suggestions = [];

            // If no prefix, default to "Every day"
            if (!prefix) {
                prefix = 'Every day';
            }

            // Capitalize first letter of prefix for consistency
            if (prefix.length > 0) {
                prefix = prefix.charAt(0).toUpperCase() + prefix.slice(1);
            }

            // Generate time completions
            if (hour >= 1 && hour <= 12) {
                ['00', '15', '30', '45'].forEach(min => {
                    suggestions.push({
                        input: `${prefix} at ${hour}:${min} AM`,
                        source: 'dynamic',
                        pattern: 'at_time'
                    });
                    suggestions.push({
                        input: `${prefix} at ${hour}:${min} PM`,
                        source: 'dynamic',
                        pattern: 'at_time'
                    });
                });
            } else if (hour >= 0 && hour <= 23) {
                ['00', '15', '30', '45'].forEach(min => {
                    suggestions.push({
                        input: `${prefix} at ${hour}:${min}`,
                        source: 'dynamic',
                        pattern: 'at_time'
                    });
                });
            }

            return suggestions.slice(0, 10);
        }
    },
    {
        id: 'in_duration',
        detect: (input) => /^in\s+\d/i.test(input),
        priority: 7,
        generate: (input) => {
            const match = input.match(/^in\s+(\d+)/i);
            if (!match) return [];

            const count = match[1];
            return [
                { input: `In ${count} minutes`, source: 'dynamic', pattern: 'in_duration' },
                { input: `In ${count} hours`, source: 'dynamic', pattern: 'in_duration' },
                { input: `In ${count} days`, source: 'dynamic', pattern: 'in_duration' },
                { input: `In ${count} weeks`, source: 'dynamic', pattern: 'in_duration' }
            ];
        }
    },
    {
        id: 'next_relative',
        detect: (input) => /^next\s+(mon|tue|wed|thu|fri|sat|sun|week|month|year)/i.test(input),
        priority: 8,
        generate: (input) => {
            const suggestions = [];

            if (/^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(input)) {
                const match = input.match(/^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
                const weekday = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();

                COMMON_TIMES.slice(0, 6).forEach(time => {
                    suggestions.push({
                        input: `Next ${weekday} at ${time}`,
                        source: 'dynamic',
                        pattern: 'next_relative'
                    });
                });
            } else if (/^next\s+week/i.test(input)) {
                suggestions.push(
                    { input: 'Next week on Monday at 9:00 AM', source: 'dynamic', pattern: 'next_relative' },
                    { input: 'Next week on Friday at 5:00 PM', source: 'dynamic', pattern: 'next_relative' }
                );
            } else if (/^next\s+month/i.test(input)) {
                suggestions.push(
                    { input: 'Next month on the 1st at 9:00 AM', source: 'dynamic', pattern: 'next_relative' },
                    { input: 'Next month on the 15th at 2:00 PM', source: 'dynamic', pattern: 'next_relative' }
                );
            } else if (/^next\s+year/i.test(input)) {
                suggestions.push(
                    { input: 'Next year on January 1st at 12:00 PM', source: 'dynamic', pattern: 'next_relative' }
                );
            }

            return suggestions;
        }
    }
];

/**
 * Get day suffix (1st, 2nd, 3rd, etc.)
 */
function getDaySuffix(day) {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

/**
 * Detect which patterns match the input
 */
function detectPatterns(input) {
    const normalized = input.trim().toLowerCase();
    const matchedPatterns = [];

    for (const pattern of PATTERNS) {
        if (pattern.detect(normalized)) {
            matchedPatterns.push(pattern);
        }
    }

    // Sort by priority (higher first)
    return matchedPatterns.sort((a, b) => b.priority - a.priority);
}

/**
 * Generate suggestions from detected patterns
 */
function generateFromPatterns(input, limit = 15) {
    const matchedPatterns = detectPatterns(input);
    const suggestions = [];

    for (const pattern of matchedPatterns) {
        const generated = pattern.generate(input);
        suggestions.push(...generated);

        if (suggestions.length >= limit) {
            break;
        }
    }

    return suggestions.slice(0, limit);
}

/**
 * Parse and validate generated suggestions
 */
function validateSuggestions(suggestions) {
    return suggestions.map(suggestion => {
        try {
            const parsed = parseNaturalSchedule(suggestion.input);
            return {
                ...suggestion,
                label: suggestion.input,
                value: parsed,
                valid: true
            };
        } catch (error) {
            return {
                ...suggestion,
                label: suggestion.input,
                value: null,
                valid: false,
                error: error.message
            };
        }
    }).filter(s => s.valid);
}

/**
 * Get common values for a specific type
 */
function getCommonValues(type) {
    switch (type) {
        case 'times':
            return COMMON_TIMES;
        case 'weekdays':
            return WEEKDAY_NAMES;
        case 'month_days':
            return MONTH_DAYS;
        case 'ordinals':
            return ORDINALS;
        case 'weekday_groups':
            return WEEKDAY_GROUPS;
        default:
            return [];
    }
}

module.exports = {
    detectPatterns,
    generateFromPatterns,
    validateSuggestions,
    getCommonValues,
    PATTERNS
};

},{"./parser":10}],3:[function(require,module,exports){
/**
 * Prefix-preserving autocomplete generator
 * Completes user input by appending to it, not rewriting it
 */

const { normalizeInput } = require('./tokenizer');
const { parseNaturalSchedule } = require('./parser');

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
    if (isIncompleteSchedule(normalized)) {
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
    if (andMatch) {
        // Extract already mentioned days to avoid suggesting them again
        const alreadyMentioned = new Set();
        const dayPattern = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
        let dayMatch;
        while ((dayMatch = dayPattern.exec(userInput)) !== null) {
            alreadyMentioned.add(dayMatch[1].toLowerCase());
        }

        const allWeekdays = ['Wednesday', 'Friday', 'Thursday', 'Tuesday', 'Monday', 'Saturday', 'Sunday'];
        const availableWeekdays = allWeekdays.filter(day => !alreadyMentioned.has(day.toLowerCase()));

        availableWeekdays.slice(0, 3).forEach(day => {
            COMMON_TIMES.slice(0, 3).forEach(time => {
                completions.push({
                    input: `${userInput} ${day} at ${time}`,
                    source: 'dynamic',
                    pattern: 'append_weekday'
                });
            });
        });
    }

    // Pattern 4: Incomplete "on" pattern
    // "on tuesday", "on the", "monthly on", etc.
    const onMatch = userInput.match(/\b(on|every\s+week\s+on|monthly\s+on)\s+([a-z]*)?$/i);
    if (onMatch) {
        const prefix = onMatch[0];
        const partial = onMatch[2] || '';

        // If it's a weekday pattern
        if (partial && /^[a-z]{2,}/i.test(partial)) {
            COMMON_TIMES.slice(0, 4).forEach(time => {
                completions.push({
                    input: `${userInput} at ${time}`,
                    source: 'dynamic',
                    pattern: 'complete_on'
                });
            });
        }
        // If it's "on the" (monthly pattern)
        else if (/on\s+the\s*$/i.test(userInput)) {
            ['1st', '15th', 'last day'].forEach(day => {
                completions.push({
                    input: `${userInput} ${day} at 9:00 AM`,
                    source: 'dynamic',
                    pattern: 'complete_monthly'
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

},{"./parser":10,"./tokenizer":11}],4:[function(require,module,exports){
/**
 * Autocomplete Templates - Pre-defined common schedule patterns
 * Organized by category with popularity scores for ranking
 */

const { parseNaturalSchedule } = require('./parser');

/**
 * Template structure:
 * {
 *   label: string,              // Human-readable label
 *   input: string,              // The natural language input to parse
 *   category: string,           // Category for grouping
 *   keywords: string[],         // Keywords for matching
 *   popularity: number,         // 1-10, higher = more common
 *   description: string         // Optional description
 * }
 */

const DAILY_TEMPLATES = [
    { label: "Every day at 9:00 AM", input: "Every day at 9:00 AM", category: "Daily", keywords: ["every", "day", "daily", "morning"], popularity: 10 },
    { label: "Every day at 2:00 PM", input: "Every day at 2:00 PM", category: "Daily", keywords: ["every", "day", "daily", "afternoon"], popularity: 8 },
    { label: "Every day at 5:00 PM", input: "Every day at 5:00 PM", category: "Daily", keywords: ["every", "day", "daily", "evening"], popularity: 8 },
    { label: "Every day at midnight", input: "Every day at midnight", category: "Daily", keywords: ["every", "day", "daily", "midnight"], popularity: 6 },
    { label: "Every day at noon", input: "Every day at noon", category: "Daily", keywords: ["every", "day", "daily", "noon", "12pm"], popularity: 7 },
    { label: "Weekdays at 9:00 AM", input: "Weekdays at 9:00 AM", category: "Daily", keywords: ["weekdays", "business", "mon-fri", "morning"], popularity: 10 },
    { label: "Weekdays at 6:00 PM", input: "Weekdays at 6:00 PM", category: "Daily", keywords: ["weekdays", "business", "mon-fri", "evening"], popularity: 8 },
    { label: "Weekends at 10:00 AM", input: "Weekends at 10:00 AM", category: "Daily", keywords: ["weekends", "saturday", "sunday"], popularity: 7 },
    { label: "Every 2 days at 9:00 AM", input: "Every 2 days at 9:00 AM", category: "Daily", keywords: ["every", "2", "days", "other"], popularity: 6 },
    { label: "Every 3 days at 9:00 AM", input: "Every 3 days at 9:00 AM", category: "Daily", keywords: ["every", "3", "days"], popularity: 5 },
    { label: "Every other day at 9:00 AM", input: "Every other day at 9:00 AM", category: "Daily", keywords: ["every", "other", "day", "alternate"], popularity: 7 },
    { label: "Business days at 9:00 AM", input: "Business days at 9:00 AM", category: "Daily", keywords: ["business", "weekdays", "work"], popularity: 9 },
    { label: "Every weekday at 8:00 AM", input: "Every weekday at 8:00 AM", category: "Daily", keywords: ["weekday", "morning", "early"], popularity: 8 },
    { label: "Every weekend at 9:00 AM", input: "Every weekend at 9:00 AM", category: "Daily", keywords: ["weekend", "saturday", "sunday"], popularity: 6 },
    { label: "Daily at 6:00 AM", input: "Daily at 6:00 AM", category: "Daily", keywords: ["daily", "early", "morning"], popularity: 5 }
];

const WEEKLY_TEMPLATES = [
    { label: "Every Monday at 9:00 AM", input: "Every Monday at 9:00 AM", category: "Weekly", keywords: ["every", "monday", "mon", "weekly"], popularity: 9 },
    { label: "Every Monday at 2:00 PM", input: "Every Monday at 2:00 PM", category: "Weekly", keywords: ["every", "monday", "mon", "afternoon"], popularity: 7 },
    { label: "Every Tuesday at 10:00 AM", input: "Every Tuesday at 10:00 AM", category: "Weekly", keywords: ["every", "tuesday", "tue"], popularity: 8 },
    { label: "Every Wednesday at 2:00 PM", input: "Every Wednesday at 2:00 PM", category: "Weekly", keywords: ["every", "wednesday", "wed"], popularity: 8 },
    { label: "Every Thursday at 3:00 PM", input: "Every Thursday at 3:00 PM", category: "Weekly", keywords: ["every", "thursday", "thu", "thurs"], popularity: 7 },
    { label: "Every Friday at 5:00 PM", input: "Every Friday at 5:00 PM", category: "Weekly", keywords: ["every", "friday", "fri", "end"], popularity: 9 },
    { label: "Every Saturday at 10:00 AM", input: "Every Saturday at 10:00 AM", category: "Weekly", keywords: ["every", "saturday", "sat", "weekend"], popularity: 7 },
    { label: "Every Sunday at 10:00 AM", input: "Every Sunday at 10:00 AM", category: "Weekly", keywords: ["every", "sunday", "sun", "weekend"], popularity: 7 },
    { label: "Mondays and Wednesdays at 9:00 AM", input: "Mondays and Wednesdays at 9:00 AM", category: "Weekly", keywords: ["monday", "wednesday", "multiple"], popularity: 8 },
    { label: "Mondays and Fridays at 10:00 AM", input: "Mondays and Fridays at 10:00 AM", category: "Weekly", keywords: ["monday", "friday", "multiple"], popularity: 8 },
    { label: "Tuesdays and Thursdays at 2:00 PM", input: "Tuesdays and Thursdays at 2:00 PM", category: "Weekly", keywords: ["tuesday", "thursday", "multiple"], popularity: 8 },
    { label: "Every Monday, Wednesday and Friday at 9:00 AM", input: "Monday, Wednesday and Friday at 9:00 AM", category: "Weekly", keywords: ["monday", "wednesday", "friday", "mwf"], popularity: 7 },
    { label: "Weekdays except Friday at 9:00 AM", input: "Weekdays except Friday at 9:00 AM", category: "Weekly", keywords: ["weekdays", "except", "not", "friday"], popularity: 6 },
    { label: "Weekends at 11:00 AM", input: "Weekends at 11:00 AM", category: "Weekly", keywords: ["weekends", "saturday", "sunday"], popularity: 6 },
    { label: "Every other Monday at 10:00 AM", input: "Every other Monday at 10:00 AM", category: "Weekly", keywords: ["every", "other", "monday", "biweekly"], popularity: 6 },
    { label: "Every other week on Monday at 9:00 AM", input: "Every other week on Monday at 9:00 AM", category: "Weekly", keywords: ["every", "other", "week", "biweekly"], popularity: 6 },
    { label: "Every 2 weeks on Friday at 3:00 PM", input: "Every 2 weeks on Friday at 3:00 PM", category: "Weekly", keywords: ["every", "2", "weeks", "biweekly", "friday"], popularity: 5 },
    { label: "Weekly on Tuesday at 1:00 PM", input: "Weekly on Tuesday at 1:00 PM", category: "Weekly", keywords: ["weekly", "tuesday"], popularity: 7 },
    { label: "Mon/Wed/Fri at 8:00 AM", input: "Mon/Wed/Fri at 8:00 AM", category: "Weekly", keywords: ["monday", "wednesday", "friday", "mwf"], popularity: 7 },
    { label: "Tuesday + Thursday at 10:30 AM", input: "Tuesday + Thursday at 10:30 AM", category: "Weekly", keywords: ["tuesday", "thursday", "multiple"], popularity: 6 }
];

const MONTHLY_TEMPLATES = [
    { label: "Monthly on the 1st at 9:00 AM", input: "Monthly on the 1st at 9:00 AM", category: "Monthly", keywords: ["monthly", "1st", "first", "beginning"], popularity: 10 },
    { label: "Monthly on the 15th at noon", input: "Monthly on the 15th at noon", category: "Monthly", keywords: ["monthly", "15th", "fifteenth", "middle"], popularity: 9 },
    { label: "On the 1st and 15th at 9:00 AM", input: "On the 1st and 15th at 9:00 AM", category: "Monthly", keywords: ["1st", "15th", "twice", "bimonthly"], popularity: 8 },
    { label: "Monthly on the last day at 5:00 PM", input: "Monthly on the last day at 5:00 PM", category: "Monthly", keywords: ["monthly", "last", "end"], popularity: 9 },
    { label: "Every month on the 5th at 10:00 AM", input: "Every month on the 5th at 10:00 AM", category: "Monthly", keywords: ["every", "month", "5th"], popularity: 7 },
    { label: "Every month on the 10th at 2:00 PM", input: "Every month on the 10th at 2:00 PM", category: "Monthly", keywords: ["every", "month", "10th"], popularity: 6 },
    { label: "On the 20th of each month at 3:00 PM", input: "On the 20th of each month at 3:00 PM", category: "Monthly", keywords: ["20th", "each", "month"], popularity: 6 },
    { label: "Monthly on the 25th at 9:00 AM", input: "Monthly on the 25th at 9:00 AM", category: "Monthly", keywords: ["monthly", "25th"], popularity: 5 },
    { label: "First Monday of the month at 9:00 AM", input: "First Monday of the month at 9:00 AM", category: "Monthly", keywords: ["first", "monday", "month"], popularity: 8 },
    { label: "Last Friday of the month at 5:00 PM", input: "Last Friday of the month at 5:00 PM", category: "Monthly", keywords: ["last", "friday", "month", "end"], popularity: 9 },
    { label: "First Wednesday of every month at 10:00 AM", input: "First Wednesday of every month at 10:00 AM", category: "Monthly", keywords: ["first", "wednesday", "month"], popularity: 7 },
    { label: "Second Tuesday of the month at 2:00 PM", input: "Second Tuesday of the month at 2:00 PM", category: "Monthly", keywords: ["second", "tuesday", "month"], popularity: 6 },
    { label: "Third Thursday of every month at 1:00 PM", input: "Third Thursday of every month at 1:00 PM", category: "Monthly", keywords: ["third", "thursday", "month"], popularity: 5 },
    { label: "Last day of each month at midnight", input: "Last day of each month at midnight", category: "Monthly", keywords: ["last", "day", "month", "midnight"], popularity: 6 },
    { label: "Monthly on the 31st when it exists", input: "Monthly on the 31st when it exists", category: "Monthly", keywords: ["monthly", "31st", "when", "exists"], popularity: 4 },
    { label: "Every 2 months on the 1st at 9:00 AM", input: "Every 2 months on the 1st at 9:00 AM", category: "Monthly", keywords: ["every", "2", "months", "bimonthly"], popularity: 6 },
    { label: "Every 3 months on the 1st at 9:00 AM", input: "Every 3 months on the 1st at 9:00 AM", category: "Monthly", keywords: ["every", "3", "months", "quarterly"], popularity: 7 },
    { label: "Every 6 months on the 1st at 10:00 AM", input: "Every 6 months on the 1st at 10:00 AM", category: "Monthly", keywords: ["every", "6", "months", "biannual"], popularity: 5 },
    { label: "On the 1st, 10th, and 20th at 9:00 AM", input: "On the 1st, 10th, and 20th at 9:00 AM", category: "Monthly", keywords: ["1st", "10th", "20th", "multiple"], popularity: 4 },
    { label: "Monthly on day one at 8:00 AM", input: "Monthly on day one at 8:00 AM", category: "Monthly", keywords: ["monthly", "day", "one", "first"], popularity: 6 }
];

const QUARTERLY_TEMPLATES = [
    { label: "Quarterly on the 1st at 9:00 AM", input: "Quarterly on the 1st at 9:00 AM", category: "Quarterly", keywords: ["quarterly", "quarter", "1st"], popularity: 9 },
    { label: "Every quarter on the 1st at 10:00 AM", input: "Every quarter on the 1st at 10:00 AM", category: "Quarterly", keywords: ["every", "quarter", "quarterly"], popularity: 8 },
    { label: "Quarterly at midnight", input: "Quarterly at midnight", category: "Quarterly", keywords: ["quarterly", "quarter", "midnight"], popularity: 5 },
    { label: "Every 3 months on the 15th at noon", input: "Every 3 months on the 15th at noon", category: "Quarterly", keywords: ["every", "3", "months", "quarterly", "15th"], popularity: 7 },
    { label: "Every quarter on day one at 9:00 AM", input: "Every quarter on day one at 9:00 AM", category: "Quarterly", keywords: ["every", "quarter", "day", "one"], popularity: 6 }
];

const YEARLY_TEMPLATES = [
    { label: "Annually on January 1st at 9:00 AM", input: "Annually on January 1st at 9:00 AM", category: "Yearly", keywords: ["annually", "yearly", "january", "1st", "new year"], popularity: 8 },
    { label: "Every year on March 1st at 9:00 AM", input: "Every year on March 1st at 9:00 AM", category: "Yearly", keywords: ["every", "year", "yearly", "march"], popularity: 7 },
    { label: "Every year on December 31st at 11:59 PM", input: "Every year on December 31st at 11:59 PM", category: "Yearly", keywords: ["every", "year", "december", "31st", "end"], popularity: 7 },
    { label: "Annually on June 15th at 10:00 AM", input: "Annually on June 15th at 10:00 AM", category: "Yearly", keywords: ["annually", "june", "15th"], popularity: 5 },
    { label: "Yearly on September 1st at 9:00 AM", input: "Yearly on September 1st at 9:00 AM", category: "Yearly", keywords: ["yearly", "september", "1st"], popularity: 5 },
    { label: "Every year on the last day of February", input: "Every year on the last day of February", category: "Yearly", keywords: ["every", "year", "last", "february"], popularity: 4 },
    { label: "Annually on April 1st at noon", input: "Annually on April 1st at noon", category: "Yearly", keywords: ["annually", "april", "1st"], popularity: 4 },
    { label: "Every year on July 4th at 10:00 AM", input: "Every year on July 4th at 10:00 AM", category: "Yearly", keywords: ["every", "year", "july", "4th"], popularity: 4 },
    { label: "Yearly on October 31st at midnight", input: "Yearly on October 31st at midnight", category: "Yearly", keywords: ["yearly", "october", "31st", "halloween"], popularity: 4 },
    { label: "Annually on December 25th at 9:00 AM", input: "Annually on December 25th at 9:00 AM", category: "Yearly", keywords: ["annually", "december", "25th", "christmas"], popularity: 5 }
];

const ONETIME_TEMPLATES = [
    { label: "Tomorrow at 9:00 AM", input: "Tomorrow at 9:00 AM", category: "One-time", keywords: ["tomorrow", "next", "day"], popularity: 10 },
    { label: "Tomorrow at 2:00 PM", input: "Tomorrow at 2:00 PM", category: "One-time", keywords: ["tomorrow", "afternoon"], popularity: 8 },
    { label: "Next Monday at 9:00 AM", input: "Next Monday at 9:00 AM", category: "One-time", keywords: ["next", "monday"], popularity: 9 },
    { label: "Next Tuesday at 10:00 AM", input: "Next Tuesday at 10:00 AM", category: "One-time", keywords: ["next", "tuesday"], popularity: 8 },
    { label: "Next Friday at 5:00 PM", input: "Next Friday at 5:00 PM", category: "One-time", keywords: ["next", "friday", "end"], popularity: 8 },
    { label: "In 7 days at 9:00 AM", input: "In 7 days at 9:00 AM", category: "One-time", keywords: ["in", "7", "days", "week"], popularity: 7 },
    { label: "In 30 days at 10:00 AM", input: "In 30 days at 10:00 AM", category: "One-time", keywords: ["in", "30", "days", "month"], popularity: 6 },
    { label: "3 days from now at 2:00 PM", input: "3 days from now at 2:00 PM", category: "One-time", keywords: ["3", "days", "from", "now"], popularity: 7 },
    { label: "5 fridays from now at 3:00 PM", input: "5 fridays from now at 3:00 PM", category: "One-time", keywords: ["5", "fridays", "from", "now"], popularity: 4 },
    { label: "Next week at 9:00 AM", input: "Next week at 9:00 AM", category: "One-time", keywords: ["next", "week"], popularity: 7 },
    { label: "Next month at midnight", input: "Next month at midnight", category: "One-time", keywords: ["next", "month"], popularity: 5 },
    { label: "Next quarter at 9:00 AM", input: "Next quarter at 9:00 AM", category: "One-time", keywords: ["next", "quarter"], popularity: 4 },
    { label: "End of the year at midnight", input: "End of the year at midnight", category: "One-time", keywords: ["end", "year"], popularity: 4 },
    { label: "Later today at 4:00 PM", input: "Later today at 4:00 PM", category: "One-time", keywords: ["later", "today"], popularity: 6 },
    { label: "This Friday at 6:00 PM", input: "This Friday at 6:00 PM", category: "One-time", keywords: ["this", "friday"], popularity: 7 }
];

const ADVANCED_TEMPLATES = [
    { label: "Every 15 minutes", input: "Every 15 minutes", category: "Advanced", keywords: ["every", "15", "minutes", "frequent"], popularity: 8 },
    { label: "Every 30 minutes", input: "Every 30 minutes", category: "Advanced", keywords: ["every", "30", "minutes", "half", "hour"], popularity: 7 },
    { label: "Every hour at :30", input: "Every hour at :30", category: "Advanced", keywords: ["every", "hour", "30", "half"], popularity: 6 },
    { label: "Every 2 hours at 9:00 AM", input: "Every 2 hours at 9:00 AM", category: "Advanced", keywords: ["every", "2", "hours"], popularity: 6 },
    { label: "Every 4 hours", input: "Every 4 hours", category: "Advanced", keywords: ["every", "4", "hours"], popularity: 5 },
    { label: "Every 6 hours", input: "Every 6 hours", category: "Advanced", keywords: ["every", "6", "hours"], popularity: 5 },
    { label: "Hourly on the half hour", input: "Hourly on the half hour", category: "Advanced", keywords: ["hourly", "half", "30"], popularity: 4 },
    { label: "Every weekday except Monday at 9:00 AM", input: "Every weekday except Monday at 9:00 AM", category: "Advanced", keywords: ["weekday", "except", "monday", "not"], popularity: 5 },
    { label: "Weekends but not Sundays at 10:00 AM", input: "Weekends but not Sundays at 10:00 AM", category: "Advanced", keywords: ["weekends", "but", "not", "sunday"], popularity: 4 },
    { label: "Every 10 days at 9:00 AM", input: "Every 10 days at 9:00 AM", category: "Advanced", keywords: ["every", "10", "days"], popularity: 4 },
    { label: "Every 14 days at 2:00 PM", input: "Every 14 days at 2:00 PM", category: "Advanced", keywords: ["every", "14", "days", "two weeks"], popularity: 4 },
    { label: "Every 45 days at 9:00 AM", input: "Every 45 days at 9:00 AM", category: "Advanced", keywords: ["every", "45", "days"], popularity: 3 },
    { label: "Weekdays minus Friday at 9:00 AM", input: "Weekdays minus Friday at 9:00 AM", category: "Advanced", keywords: ["weekdays", "minus", "friday", "except"], popularity: 4 },
    { label: "Every 5 days at noon", input: "Every 5 days at noon", category: "Advanced", keywords: ["every", "5", "days"], popularity: 4 },
    { label: "Every 21 days at 10:00 AM", input: "Every 21 days at 10:00 AM", category: "Advanced", keywords: ["every", "21", "days"], popularity: 3 }
];

// Combine all templates
const ALL_TEMPLATES = [
    ...DAILY_TEMPLATES,
    ...WEEKLY_TEMPLATES,
    ...MONTHLY_TEMPLATES,
    ...QUARTERLY_TEMPLATES,
    ...YEARLY_TEMPLATES,
    ...ONETIME_TEMPLATES,
    ...ADVANCED_TEMPLATES
];

/**
 * Get all templates
 */
function getAllTemplates() {
    return ALL_TEMPLATES.map(template => ({
        ...template,
        value: null // Will be populated on demand
    }));
}

/**
 * Get templates by category
 */
function getTemplatesByCategory(category) {
    return ALL_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get all categories
 */
function getCategories() {
    return ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly', 'One-time', 'Advanced'];
}

/**
 * Parse template and add value
 */
function parseTemplate(template) {
    try {
        const value = parseNaturalSchedule(template.input);
        return {
            ...template,
            value
        };
    } catch (error) {
        return {
            ...template,
            value: null,
            parseError: error.message
        };
    }
}

module.exports = {
    ALL_TEMPLATES,
    DAILY_TEMPLATES,
    WEEKLY_TEMPLATES,
    MONTHLY_TEMPLATES,
    QUARTERLY_TEMPLATES,
    YEARLY_TEMPLATES,
    ONETIME_TEMPLATES,
    ADVANCED_TEMPLATES,
    getAllTemplates,
    getTemplatesByCategory,
    getCategories,
    parseTemplate
};

},{"./parser":10}],5:[function(require,module,exports){
/**
 * Main autocomplete engine - combines templates and dynamic generation
 */

const { getAllTemplates, parseTemplate } = require('./autocomplete-templates');
const { generateFromPatterns, validateSuggestions } = require('./autocomplete-patterns');
const { generatePrefixCompletions, validatePrefixCompletions } = require('./autocomplete-prefix');
const { normalizeInput } = require('./tokenizer');

/**
 * Calculate string similarity score (0-1)
 * PREFIX-ONLY matching - only returns high scores if target starts with input
 */
function calculateSimilarity(input, target) {
    const inputLower = input.toLowerCase().trim();
    const targetLower = target.toLowerCase().trim();

    // Exact match
    if (inputLower === targetLower) {
        return 1.0;
    }

    // Prefix match (REQUIRED for autocomplete)
    if (targetLower.startsWith(inputLower)) {
        // Score based on how complete the input is
        const completeness = inputLower.length / targetLower.length;
        return 0.85 + (0.15 * completeness);
    }

    // No match - not a prefix
    return 0;
}

/**
 * Match templates against input
 */
function matchTemplates(input, templates) {
    const inputLower = input.toLowerCase().trim();
    const matches = [];

    // Try typo correction using tokenizer normalization
    const corrected = normalizeInput(input);
    const correctedLower = corrected.toLowerCase().trim();

    for (const template of templates) {
        // Calculate similarity with original input
        const similarityOriginal = calculateSimilarity(inputLower, template.input);

        // Calculate similarity with corrected input
        const similarityCorrected = corrected !== input ?
            calculateSimilarity(correctedLower, template.input) : 0;

        const similarity = Math.max(similarityOriginal, similarityCorrected);

        // Also check against keywords
        let keywordScore = 0;
        if (template.keywords) {
            const inputWords = inputLower.split(/\s+/);
            const matchedKeywords = template.keywords.filter(keyword =>
                inputWords.some(word => keyword.includes(word) || word.includes(keyword))
            );
            keywordScore = matchedKeywords.length / template.keywords.length;
        }

        const finalSimilarity = Math.max(similarity, keywordScore * 0.5);

        if (finalSimilarity > 0.2) {
            matches.push({
                ...template,
                similarity: finalSimilarity,
                source: 'template'
            });
        }
    }

    return matches;
}

/**
 * Calculate final score for ranking
 */
function calculateScore(suggestion, options = {}) {
    const {
        similarityWeight = 0.7,
        popularityWeight = 0.3
    } = options;

    const similarity = suggestion.similarity || 0;
    const popularity = (suggestion.popularity || 5) / 10; // Normalize to 0-1

    return (similarity * similarityWeight) + (popularity * popularityWeight);
}

/**
 * Deduplicate suggestions based on input text
 */
function deduplicate(suggestions) {
    const seen = new Set();
    const unique = [];

    for (const suggestion of suggestions) {
        const key = suggestion.input.toLowerCase().trim();
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(suggestion);
        }
    }

    return unique;
}

/**
 * Get autocomplete suggestions
 *
 * @param {string} partialInput - The partial input from the user
 * @param {Object} options - Configuration options
 * @param {number} options.limit - Maximum number of suggestions (default: 10)
 * @param {string} options.category - Filter by category (optional)
 * @param {number} options.minScore - Minimum score threshold (default: 0.3)
 * @param {number} options.similarityWeight - Weight for similarity in ranking (default: 0.7)
 * @param {number} options.popularityWeight - Weight for popularity in ranking (default: 0.3)
 * @param {boolean} options.includeDynamic - Include dynamically generated suggestions (default: true)
 * @param {boolean} options.includeValue - Parse and include JSON value (default: true)
 *
 * @returns {Array} Array of suggestion objects with label, input, value, score, source
 */
function getSuggestions(partialInput, options = {}) {
    const {
        limit = 10,
        category = null,
        minScore = 0.3,
        similarityWeight = 0.7,
        popularityWeight = 0.3,
        includeDynamic = true,
        includeValue = true
    } = options;

    // Handle empty input
    if (!partialInput || partialInput.trim().length === 0) {
        return getPopularSuggestions(limit, includeValue);
    }

    const input = partialInput.trim();
    const correctedInput = normalizeInput(input).toLowerCase();
    let allSuggestions = [];

    // 1. Match against templates (PREFIX ONLY)
    let templates = getAllTemplates();
    if (category) {
        templates = templates.filter(t => t.category === category);
    }

    const templateMatches = matchTemplates(input, templates);
    // Filter to only prefix matches
    const prefixTemplates = templateMatches.filter(t =>
        t.input.toLowerCase().startsWith(correctedInput) ||
        t.label.toLowerCase().startsWith(correctedInput)
    );
    allSuggestions.push(...prefixTemplates);

    // 2. Generate prefix-preserving completions (if enabled)
    if (includeDynamic) {
        const prefixCompletions = generatePrefixCompletions(input);
        const validatedPrefixCompletions = validatePrefixCompletions(prefixCompletions);

        // Calculate similarity for prefix completions
        validatedPrefixCompletions.forEach(suggestion => {
            suggestion.similarity = calculateSimilarity(correctedInput, suggestion.input.toLowerCase());
            suggestion.popularity = 8; // High popularity for direct completions
        });

        allSuggestions.push(...validatedPrefixCompletions);

        // Also try old pattern-based generation (filtered for prefix match)
        const dynamicSuggestions = generateFromPatterns(input, limit);
        dynamicSuggestions.forEach(suggestion => {
            suggestion.similarity = calculateSimilarity(correctedInput, suggestion.input.toLowerCase());
            suggestion.popularity = 7;
        });

        // Only keep dynamic suggestions that start with corrected input
        const prefixDynamic = dynamicSuggestions.filter(s =>
            s.input.toLowerCase().startsWith(correctedInput)
        );
        allSuggestions.push(...prefixDynamic);
    }

    // 3. Deduplicate
    allSuggestions = deduplicate(allSuggestions);

    // 4. Calculate scores and filter (use lower threshold since we're strict on prefix)
    allSuggestions = allSuggestions.map(suggestion => ({
        ...suggestion,
        score: calculateScore(suggestion, { similarityWeight, popularityWeight })
    })).filter(suggestion => suggestion.score >= Math.max(0.3, minScore));

    // 5. Sort by score (descending)
    allSuggestions.sort((a, b) => b.score - a.score);

    // 6. Limit results
    const topSuggestions = allSuggestions.slice(0, limit);

    // 7. Parse and add JSON values if requested
    if (includeValue) {
        return validateSuggestions(topSuggestions);
    }

    // 8. Return without values
    return topSuggestions.map(s => ({
        label: s.label || s.input,
        input: s.input,
        category: s.category,
        score: s.score,
        source: s.source
    }));
}

/**
 * Get popular suggestions for empty input
 */
function getPopularSuggestions(limit = 10, includeValue = true) {
    const templates = getAllTemplates();

    // Sort by popularity
    const popular = templates
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, limit);

    if (includeValue) {
        return popular.map(template => {
            const parsed = parseTemplate(template);
            return {
                label: template.label,
                input: template.input,
                category: template.category,
                value: parsed.value,
                score: template.popularity / 10,
                source: 'template'
            };
        });
    }

    return popular.map(template => ({
        label: template.label,
        input: template.input,
        category: template.category,
        score: template.popularity / 10,
        source: 'template'
    }));
}

/**
 * Get suggestions by category
 */
function getSuggestionsByCategory(category, limit = 20, includeValue = true) {
    const templates = getAllTemplates().filter(t => t.category === category);

    // Sort by popularity
    const sorted = templates
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, limit);

    if (includeValue) {
        return sorted.map(template => {
            const parsed = parseTemplate(template);
            return {
                label: template.label,
                input: template.input,
                category: template.category,
                value: parsed.value,
                score: template.popularity / 10,
                source: 'template'
            };
        });
    }

    return sorted.map(template => ({
        label: template.label,
        input: template.input,
        category: template.category,
        score: template.popularity / 10,
        source: 'template'
    }));
}

module.exports = {
    getSuggestions,
    getSuggestionsByCategory,
    getPopularSuggestions
};

},{"./autocomplete-patterns":2,"./autocomplete-prefix":3,"./autocomplete-templates":4,"./tokenizer":11}],6:[function(require,module,exports){
/**
 * JSON builder - constructs the final schedule JSON
 */

/**
 * Build schedule JSON from parsed context
 */
function buildScheduleJSON(context) {
    const { start, repeat, until } = context;

    if (!start) {
        throw new Error('Start date is required');
    }

    const result = {
        start: formatISO8601(start)
    };

    // Add repeat if present
    if (repeat) {
        result.repeat = buildRepeatObject(repeat, start, context);
    }

    // Add until if present
    if (until) {
        result.until = formatISO8601(until);
    }

    // Validate the result
    validateSchedule(result);

    return result;
}

/**
 * Build repeat object
 */
function buildRepeatObject(repeat, start, context) {
    const { interval, on, at } = repeat;

    const result = {
        interval: {
            unit: interval.unit,
            count: interval.count
        }
    };

    // Add "on" clause based on unit
    if (on) {
        result.on = on;
    } else {
        // Infer "on" from context if needed
        const inferredOn = inferOnClause(interval, start, context);
        if (inferredOn) {
            result.on = inferredOn;
        }
    }

    // Add "at" time
    if (at) {
        result.at = at;
    } else {
        // Infer "at" from start time if applicable
        const inferredAt = inferAtTime(interval, start);
        if (inferredAt) {
            result.at = inferredAt;
        }
    }

    return result;
}

/**
 * Infer "on" clause from context
 */
function inferOnClause(interval, start, context) {
    const { tokens } = context;
    const text = tokens.join(' ');

    // For weekly schedules, check if we need weekdays
    if (interval.unit === 'week') {
        // If specific weekday mentioned, extract it
        const weekdayMap = {
            'sunday': 'sun', 'monday': 'mon', 'tuesday': 'tue', 'wednesday': 'wed',
            'thursday': 'thu', 'friday': 'fri', 'saturday': 'sat'
        };

        for (const [full, short] of Object.entries(weekdayMap)) {
            if (new RegExp(`\\b${full}s?\\b`).test(text)) {
                return { weekdays: [short] };
            }
        }

        // If weekdays mentioned
        if (/\b(weekdays?|business\s+days?)\b/.test(text)) {
            return { weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'] };
        }

        // If weekends mentioned
        if (/\bweekends?\b/.test(text)) {
            return { weekdays: ['sat', 'sun'] };
        }
    }

    // For monthly schedules, infer from start date
    if (interval.unit === 'month') {
        const day = start.getDate();
        return { month_days: [day] };
    }

    // For yearly schedules, infer from start date
    if (interval.unit === 'year') {
        const month = start.getMonth() + 1;
        const day = start.getDate();
        return { year_date: { month, day } };
    }

    return null;
}

/**
 * Infer "at" time from start
 */
function inferAtTime(interval, start) {
    // "at" is required for day, week, month, year
    if (['day', 'week', 'month', 'year'].includes(interval.unit)) {
        const hours = start.getHours();
        const minutes = start.getMinutes();
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // "at" is optional for hour
    if (interval.unit === 'hour') {
        const minutes = start.getMinutes();
        if (minutes !== 0) {
            return `${String(start.getHours()).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }
    }

    return null;
}

/**
 * Format date as ISO 8601
 */
function formatISO8601(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Validate schedule JSON
 */
function validateSchedule(schedule) {
    if (!schedule.start) {
        throw new Error('Schedule must have a start date');
    }

    if (!schedule.repeat) {
        // One-time schedule is valid
        return;
    }

    const { interval, on, at } = schedule.repeat;

    // Validate interval
    if (!interval || !interval.unit || !interval.count) {
        throw new Error('Repeat interval must have unit and count');
    }

    const validUnits = ['minute', 'hour', 'day', 'week', 'month', 'year'];
    if (!validUnits.includes(interval.unit)) {
        throw new Error(`Invalid interval unit: ${interval.unit}`);
    }

    // Validate "at" requirements
    if (['day', 'week', 'month', 'year'].includes(interval.unit)) {
        if (!at) {
            throw new Error(`"at" time is required for ${interval.unit} intervals`);
        }
    }

    if (interval.unit === 'minute' && at) {
        throw new Error('"at" time is not allowed for minute intervals');
    }

    // Validate "on" clause
    if (on) {
        if (interval.unit === 'week' && !on.weekdays) {
            throw new Error('Weekly schedules must specify weekdays');
        }

        if (interval.unit === 'month' && !on.month_days && !on.weekday_position) {
            throw new Error('Monthly schedules must specify month_days or weekday_position');
        }

        if (interval.unit === 'year' && !on.year_date) {
            throw new Error('Yearly schedules must specify year_date');
        }
    }
}

module.exports = {
    buildScheduleJSON
};

},{}],7:[function(require,module,exports){
/**
 * Schedule calculator - calculates next execution time from schedule JSON
 */

/**
 * Calculate the next scheduled execution time
 * @param {Object} schedule - The schedule JSON object
 * @param {Object} options - Options
 * @param {Date} options.from - Calculate from this date (default: now)
 * @param {boolean} options.asTimestamp - Return unix timestamp in milliseconds (default: false)
 * @returns {Date|number|null} - Next execution time, or null if schedule has ended
 */
function getNextScheduledTime(schedule, options = {}) {
    const from = options.from || new Date();
    const asTimestamp = options.asTimestamp || false;

    // Parse start date
    const start = new Date(schedule.start);

    // Check if schedule has ended
    if (schedule.until) {
        const until = new Date(schedule.until);
        if (from > until) {
            return null; // Schedule has ended
        }
    }

    // If no repeat, it's a one-time event
    if (!schedule.repeat) {
        // Return start time if it's in the future, otherwise null
        const next = start > from ? start : null;
        return next && asTimestamp ? next.getTime() : next;
    }

    // Calculate next execution for repeating schedule
    const next = calculateNextRepeat(schedule, from, start);

    // Check if next execution is beyond "until"
    if (next && schedule.until) {
        const until = new Date(schedule.until);
        if (next > until) {
            return null;
        }
    }

    return next && asTimestamp ? next.getTime() : next;
}

/**
 * Calculate next repeat occurrence
 */
function calculateNextRepeat(schedule, from, start) {
    const { repeat } = schedule;
    const { interval, on, at } = repeat;
    const { unit, count } = interval;

    // Start from the later of start or from
    let current = new Date(Math.max(start.getTime(), from.getTime()));

    // Handle different interval units
    switch (unit) {
        case 'minute':
            return calculateNextMinuteInterval(current, start, count);

        case 'hour':
            return calculateNextHourInterval(current, start, count, at);

        case 'day':
            return calculateNextDayInterval(current, start, count, on, at);

        case 'week':
            return calculateNextWeekInterval(current, start, count, on, at);

        case 'month':
            return calculateNextMonthInterval(current, start, count, on, at);

        case 'year':
            return calculateNextYearInterval(current, start, count, on, at);

        default:
            throw new Error(`Unsupported interval unit: ${unit}`);
    }
}

/**
 * Calculate next minute interval
 */
function calculateNextMinuteInterval(current, start, count) {
    // Calculate minutes since start
    const minutesSinceStart = Math.floor((current - start) / (60 * 1000));

    // Calculate next occurrence
    const nextOccurrence = Math.ceil((minutesSinceStart + 1) / count) * count;

    const next = new Date(start);
    next.setMinutes(start.getMinutes() + nextOccurrence);

    return next;
}

/**
 * Calculate next hour interval
 */
function calculateNextHourInterval(current, start, count, at) {
    // Calculate hours since start
    const hoursSinceStart = Math.floor((current - start) / (60 * 60 * 1000));

    // Calculate next occurrence
    const nextOccurrence = Math.ceil((hoursSinceStart + 1) / count) * count;

    const next = new Date(start);
    next.setHours(start.getHours() + nextOccurrence);

    // Apply "at" time if specified (for the minutes)
    if (at) {
        const [hours, minutes] = at.split(':').map(Number);
        next.setMinutes(minutes);
    }

    return next;
}

/**
 * Calculate next day interval
 */
function calculateNextDayInterval(current, start, count, on, at) {
    // If there are weekday constraints, convert to weekly schedule
    if (on && on.weekdays) {
        // Convert weekday names to numbers
        const weekdayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
        const targetDays = on.weekdays.map(d => weekdayMap[d]);

        // Find next occurrence of any target weekday
        let next = new Date(current);
        next.setHours(0, 0, 0, 0);

        while (true) {
            if (targetDays.includes(next.getDay()) && next >= current) {
                break;
            }
            next.setDate(next.getDate() + 1);
        }

        // Apply "at" time
        if (at) {
            const [hours, minutes] = at.split(':').map(Number);
            next.setHours(hours, minutes, 0, 0);
        }

        return next;
    }

    // Calculate days since start
    const daysSinceStart = Math.floor((current - start) / (24 * 60 * 60 * 1000));

    // Calculate next occurrence
    const nextOccurrence = Math.ceil((daysSinceStart + 1) / count) * count;

    const next = new Date(start);
    next.setDate(start.getDate() + nextOccurrence);

    // Apply "at" time
    if (at) {
        const [hours, minutes] = at.split(':').map(Number);
        next.setHours(hours, minutes, 0, 0);
    }

    return next;
}

/**
 * Calculate next week interval
 */
function calculateNextWeekInterval(current, start, count, on, at) {
    const weekdayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

    // Get target weekdays
    const targetDays = on && on.weekdays
        ? on.weekdays.map(d => weekdayMap[d])
        : [start.getDay()]; // Default to start day

    // Start searching from current time
    let next = new Date(current);
    next.setHours(0, 0, 0, 0);

    // Find next occurrence
    let weeksChecked = 0;
    const maxWeeks = count * 52; // Prevent infinite loop

    while (weeksChecked < maxWeeks) {
        // Check each day in current week
        for (let i = 0; i < 7; i++) {
            const checkDate = new Date(next);
            checkDate.setDate(next.getDate() + i);

            // Check if this day matches target weekdays
            if (targetDays.includes(checkDate.getDay())) {
                // Apply "at" time
                if (at) {
                    const [hours, minutes] = at.split(':').map(Number);
                    checkDate.setHours(hours, minutes, 0, 0);
                } else {
                    checkDate.setHours(start.getHours(), start.getMinutes(), 0, 0);
                }

                // Check if this is in the future
                if (checkDate > current) {
                    // Check if this matches the interval
                    const weeksSinceStart = Math.floor((checkDate - start) / (7 * 24 * 60 * 60 * 1000));
                    if (weeksSinceStart % count === 0) {
                        return checkDate;
                    }
                }
            }
        }

        // Move to next interval
        next.setDate(next.getDate() + (count * 7));
        weeksChecked += count;
    }

    return null;
}

/**
 * Calculate next month interval
 */
function calculateNextMonthInterval(current, start, count, on, at) {
    let next = new Date(current);
    next.setHours(0, 0, 0, 0);

    // Get target days
    const targetDays = on && on.month_days
        ? on.month_days
        : [start.getDate()]; // Default to start day

    // Search for next occurrence (limit to 10 years)
    const maxMonths = count * 120;
    let monthsChecked = 0;

    while (monthsChecked < maxMonths) {
        for (const targetDay of targetDays) {
            const checkDate = new Date(next);

            if (targetDay === 'last') {
                // Last day of month
                checkDate.setMonth(checkDate.getMonth() + 1);
                checkDate.setDate(0);
            } else {
                checkDate.setDate(targetDay);
            }

            // Apply "at" time
            if (at) {
                const [hours, minutes] = at.split(':').map(Number);
                checkDate.setHours(hours, minutes, 0, 0);
            } else {
                checkDate.setHours(start.getHours(), start.getMinutes(), 0, 0);
            }

            // Check if this is in the future and matches interval
            if (checkDate > current) {
                const monthsSinceStart = Math.floor((checkDate.getFullYear() - start.getFullYear()) * 12 +
                    (checkDate.getMonth() - start.getMonth()));

                if (monthsSinceStart % count === 0) {
                    return checkDate;
                }
            }
        }

        // Move to next interval
        next.setMonth(next.getMonth() + count);
        monthsChecked += count;
    }

    return null;
}

/**
 * Calculate next year interval
 */
function calculateNextYearInterval(current, start, count, on, at) {
    let next = new Date(current);

    // Get target month and day
    const targetMonth = on && on.year_date ? on.year_date.month - 1 : start.getMonth();
    const targetDay = on && on.year_date ? on.year_date.day : start.getDate();

    // Search for next occurrence (limit to 100 years)
    const maxYears = count * 100;
    let yearsChecked = 0;

    while (yearsChecked < maxYears) {
        const checkDate = new Date(next.getFullYear(), targetMonth, 1);

        if (targetDay === 'last') {
            // Last day of target month
            checkDate.setMonth(targetMonth + 1);
            checkDate.setDate(0);
        } else {
            checkDate.setDate(targetDay);
        }

        // Apply "at" time
        if (at) {
            const [hours, minutes] = at.split(':').map(Number);
            checkDate.setHours(hours, minutes, 0, 0);
        } else {
            checkDate.setHours(start.getHours(), start.getMinutes(), 0, 0);
        }

        // Check if this is in the future and matches interval
        if (checkDate > current) {
            const yearsSinceStart = checkDate.getFullYear() - start.getFullYear();

            if (yearsSinceStart % count === 0) {
                return checkDate;
            }
        }

        // Move to next interval
        next.setFullYear(next.getFullYear() + count);
        yearsChecked += count;
    }

    return null;
}

module.exports = {
    getNextScheduledTime
};

},{}],8:[function(require,module,exports){
/**
 * Date/Time parser - handles absolute and relative dates
 */

const MONTH_MAP = {
    'january': 0, 'february': 1, 'march': 2, 'april': 3,
    'may': 4, 'june': 5, 'july': 6, 'august': 7,
    'september': 8, 'october': 9, 'november': 10, 'december': 11
};

const WEEKDAY_MAP = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
};

/**
 * Parse a datetime match from regex
 */
function parseDateTime(match) {
    // Handle ISO format: YYYY-MM-DD
    if (match[0].match(/\d{4}-\d{2}-\d{2}/)) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;
        const day = parseInt(match[3]);
        const hours = match[4] ? parseInt(match[4]) : 0;
        const minutes = match[5] ? parseInt(match[5]) : 0;

        return new Date(year, month, day, hours, minutes, 0, 0);
    }

    // Handle month name format
    const monthName = match[1].toLowerCase();
    const day = parseInt(match[2]);
    const year = match[4] ? parseInt(match[4]) : new Date().getFullYear();

    const month = MONTH_MAP[monthName];
    if (month === undefined) {
        return null;
    }

    let hours = 0;
    let minutes = 0;

    // Parse time if present
    if (match[5]) {
        hours = parseInt(match[5]);

        // Check if match[6] is a number (minutes) or am/pm string
        if (match[6] && !isNaN(parseInt(match[6]))) {
            // It's minutes
            minutes = parseInt(match[6]);
            // Period might be in match[7]
            const period = match[7] ? match[7].toLowerCase() : null;
            if (period === 'pm' && hours !== 12) {
                hours += 12;
            } else if (period === 'am' && hours === 12) {
                hours = 0;
            }
        } else if (match[6] && (match[6].toLowerCase() === 'am' || match[6].toLowerCase() === 'pm')) {
            // match[6] is am/pm, no minutes
            minutes = 0;
            const period = match[6].toLowerCase();
            if (period === 'pm' && hours !== 12) {
                hours += 12;
            } else if (period === 'am' && hours === 12) {
                hours = 0;
            }
        }
    }

    return new Date(year, month, day, hours, minutes, 0, 0);
}

/**
 * Parse relative dates (tomorrow, next week, this friday, etc.)
 */
function parseRelativeDate(text, referenceDate) {
    const ref = new Date(referenceDate);

    // "X days from now", "X weeks from now", "X months from now"
    const fromNowMatch = text.match(/\b(\d+)\s+(days?|weeks?|months?|years?)\s+from\s+now\b/i);
    if (fromNowMatch) {
        const count = parseInt(fromNowMatch[1]);
        const unit = fromNowMatch[2].replace(/s$/, '').toLowerCase();

        const result = new Date(ref);

        if (unit === 'day') {
            result.setDate(result.getDate() + count);
        } else if (unit === 'week') {
            result.setDate(result.getDate() + (count * 7));
        } else if (unit === 'month') {
            result.setMonth(result.getMonth() + count);
        } else if (unit === 'year') {
            result.setFullYear(result.getFullYear() + count);
        }

        // Extract time
        const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
            const time = parseTimeFromMatch(timeMatch);
            result.setHours(time.hours, time.minutes, 0, 0);
        } else {
            result.setHours(9, 0, 0, 0);
        }

        return result;
    }

    // "X [weekday]s from now" (e.g., "5 fridays from now")
    const weekdaysFromNowMatch = text.match(/\b(\d+)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\s+from\s+now\b/i);
    if (weekdaysFromNowMatch) {
        const count = parseInt(weekdaysFromNowMatch[1]);
        const weekdayName = weekdaysFromNowMatch[2].toLowerCase();
        const targetDay = WEEKDAY_MAP[weekdayName];

        const result = new Date(ref);
        let occurrences = 0;

        // Find the Nth occurrence of this weekday
        while (occurrences < count) {
            result.setDate(result.getDate() + 1);
            if (result.getDay() === targetDay) {
                occurrences++;
            }
        }

        // Extract time
        const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
            const time = parseTimeFromMatch(timeMatch);
            result.setHours(time.hours, time.minutes, 0, 0);
        } else {
            result.setHours(9, 0, 0, 0);
        }

        return result;
    }

    // "next quarter"
    if (/\bnext\s+quarter\b/.test(text)) {
        const result = new Date(ref);
        const currentMonth = result.getMonth();

        // Calculate next quarter start month
        const currentQuarter = Math.floor(currentMonth / 3);
        const nextQuarterStartMonth = ((currentQuarter + 1) % 4) * 3;

        if (nextQuarterStartMonth <= currentMonth) {
            // Next quarter is next year
            result.setFullYear(result.getFullYear() + 1);
        }

        result.setMonth(nextQuarterStartMonth);
        result.setDate(1);

        // Extract time or default to midnight
        const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
            const time = parseTimeFromMatch(timeMatch);
            result.setHours(time.hours, time.minutes, 0, 0);
        } else {
            result.setHours(0, 0, 0, 0);
        }

        return result;
    }

    // "next month", "next year"
    const nextPeriodMatch = text.match(/\bnext\s+(month|year)\b/);
    if (nextPeriodMatch) {
        const result = new Date(ref);

        if (nextPeriodMatch[1] === 'month') {
            result.setMonth(result.getMonth() + 1);
            result.setDate(1);
        } else if (nextPeriodMatch[1] === 'year') {
            result.setFullYear(result.getFullYear() + 1);
            result.setMonth(0);
            result.setDate(1);
        }

        // Extract time
        const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
            const time = parseTimeFromMatch(timeMatch);
            result.setHours(time.hours, time.minutes, 0, 0);
        } else {
            result.setHours(0, 0, 0, 0);
        }

        return result;
    }

    // "beginning of next month", "start of next month"
    if (/\b(beginning|start)\s+of\s+next\s+month\b/.test(text)) {
        const result = new Date(ref);
        result.setMonth(result.getMonth() + 1);
        result.setDate(1);

        const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
            const time = parseTimeFromMatch(timeMatch);
            result.setHours(time.hours, time.minutes, 0, 0);
        } else {
            result.setHours(0, 0, 0, 0);
        }

        return result;
    }

    // "last day of this month", "end of this month"
    if (/\b(last day of|end of)\s+this\s+month\b/.test(text)) {
        const result = new Date(ref);
        result.setMonth(result.getMonth() + 1);
        result.setDate(0); // 0 = last day of previous month

        const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
            const time = parseTimeFromMatch(timeMatch);
            result.setHours(time.hours, time.minutes, 0, 0);
        } else {
            result.setHours(23, 59, 0, 0);
        }

        return result;
    }

    // "last day of the year", "end of the year"
    if (/\b(last day of|end of)\s+(the\s+)?year\b/.test(text)) {
        const result = new Date(ref);
        result.setMonth(11);
        result.setDate(31);

        const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
            const time = parseTimeFromMatch(timeMatch);
            result.setHours(time.hours, time.minutes, 0, 0);
        } else {
            result.setHours(23, 59, 0, 0);
        }

        return result;
    }

    // "beginning of the year", "start of the year"
    if (/\b(beginning|start)\s+of\s+(the\s+)?year\b/.test(text)) {
        const result = new Date(ref);
        result.setMonth(0);
        result.setDate(1);

        const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
            const time = parseTimeFromMatch(timeMatch);
            result.setHours(time.hours, time.minutes, 0, 0);
        } else {
            result.setHours(0, 0, 0, 0);
        }

        return result;
    }

    // Tomorrow
    if (/\btomorrow\b/.test(text)) {
        const tomorrow = new Date(ref);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Extract time if present
        const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
            const time = parseTimeFromMatch(timeMatch);
            tomorrow.setHours(time.hours, time.minutes, 0, 0);
        } else {
            tomorrow.setHours(9, 0, 0, 0); // Default to 9am
        }

        return tomorrow;
    }

    // Today (with "later" modifier)
    if (/\btoday\b/.test(text)) {
        const today = new Date(ref);

        const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
            const time = parseTimeFromMatch(timeMatch);
            today.setHours(time.hours, time.minutes, 0, 0);
        } else if (/\blater\b/.test(text)) {
            // "later today" - default to 4pm
            today.setHours(16, 0, 0, 0);
        } else {
            today.setHours(9, 0, 0, 0);
        }

        return today;
    }

    // Next [weekday]
    const nextWeekdayMatch = text.match(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    if (nextWeekdayMatch) {
        const targetDay = WEEKDAY_MAP[nextWeekdayMatch[1]];
        const result = new Date(ref);

        // Find next occurrence of this weekday
        const currentDay = result.getDay();
        const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
        result.setDate(result.getDate() + daysUntil);

        // Extract time
        const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
            const time = parseTimeFromMatch(timeMatch);
            result.setHours(time.hours, time.minutes, 0, 0);
        } else {
            result.setHours(9, 0, 0, 0);
        }

        return result;
    }

    // This [weekday]
    const thisWeekdayMatch = text.match(/\bthis\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    if (thisWeekdayMatch) {
        const targetDay = WEEKDAY_MAP[thisWeekdayMatch[1]];
        const result = new Date(ref);

        const currentDay = result.getDay();
        const daysUntil = (targetDay - currentDay + 7) % 7;
        if (daysUntil === 0) {
            // It's today, use it
        } else {
            result.setDate(result.getDate() + daysUntil);
        }

        const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
            const time = parseTimeFromMatch(timeMatch);
            result.setHours(time.hours, time.minutes, 0, 0);
        } else {
            result.setHours(9, 0, 0, 0);
        }

        return result;
    }

    // This coming [weekday]
    const comingWeekdayMatch = text.match(/\bthis\s+coming\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    if (comingWeekdayMatch) {
        const targetDay = WEEKDAY_MAP[comingWeekdayMatch[1]];
        const result = new Date(ref);

        const currentDay = result.getDay();
        const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
        result.setDate(result.getDate() + daysUntil);

        const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
            const time = parseTimeFromMatch(timeMatch);
            result.setHours(time.hours, time.minutes, 0, 0);
        } else {
            result.setHours(9, 0, 0, 0);
        }

        return result;
    }

    return null;
}

function parseTimeFromMatch(match) {
    let hours = parseInt(match[1]);
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const period = match[3] ? match[3].toLowerCase() : null;

    if (period === 'pm' && hours !== 12) {
        hours += 12;
    } else if (period === 'am' && hours === 12) {
        hours = 0;
    }

    return { hours, minutes };
}

module.exports = {
    parseDateTime,
    parseRelativeDate
};

},{}],9:[function(require,module,exports){
/**
 * Interval parser - handles "every N days/weeks/months" and related patterns
 */

const WEEKDAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEKDAY_FULL = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Parse interval from text (every N minutes/hours/days/weeks/months/years)
 */
function parseInterval(tokens) {
    const text = tokens.join(' ');

    // Check for "day/days of the month" patterns first - these indicate monthly schedules
    // Examples: "4th day of the month every 2 months", "on the 15th of each month"
    if (/\bday\s+of\s+(?:the\s+)?month\b/.test(text) || /\bof\s+(?:the\s+)?month\b/.test(text) || /\bof\s+each\s+month\b/.test(text)) {
        // Look for "every N months" in the text
        const monthIntervalMatch = text.match(/\bevery\s+(\d+)\s+months?\b/);
        if (monthIntervalMatch) {
            return { unit: 'month', count: parseInt(monthIntervalMatch[1]) };
        }
        // Default to monthly
        return { unit: 'month', count: 1 };
    }

    // Handle "hourly", "daily", "weekly", "monthly", "quarterly", "yearly", "annually"
    if (/\bhourly\b/.test(text)) {
        return { unit: 'hour', count: 1 };
    }
    if (/\bdaily\b/.test(text)) {
        return { unit: 'day', count: 1 };
    }
    if (/\bweekly\b/.test(text)) {
        return { unit: 'week', count: 1 };
    }
    if (/\bmonthly\b/.test(text)) {
        return { unit: 'month', count: 1 };
    }
    if (/\b(quarterly|every\s+quarter)\b/.test(text)) {
        return { unit: 'month', count: 3 };
    }
    if (/\b(yearly|annually)\b/.test(text)) {
        return { unit: 'year', count: 1 };
    }

    // Handle "every N [unit]"
    const patterns = [
        // "every 15 minutes", "every 2 hours", "every 45 days"
        /\bevery\s+(\d+)\s+(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\b/,
        // "every other sunday", "every other monday", etc.
        /\bevery\s+other\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
        // "every other day", "every other week"
        /\bevery\s+other\s+(day|week|month|year)\b/,
        // "every day", "every week"
        /\bevery\s+(day|week|month|year)\b/,
        // "every minute", "every hour"
        /\bevery\s+(minute|hour)\b/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            if (match[0].includes('other')) {
                // "every other X" means every 2 X
                const matched = match[1].toLowerCase();
                // Check if it's a weekday name
                const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                if (weekdays.includes(matched)) {
                    return { unit: 'week', count: 2 };
                }
                const unit = normalizeUnit(matched);
                return { unit, count: 2 };
            } else if (match[1] && !isNaN(match[1])) {
                // "every N units"
                const count = parseInt(match[1]);
                const unit = normalizeUnit(match[2]);
                return { unit, count };
            } else {
                // "every unit" means every 1 unit
                const unit = normalizeUnit(match[1] || match[2]);
                return { unit, count: 1 };
            }
        }
    }

    // Handle specific weekday patterns: "every monday", "mondays", etc.
    const weekdayPattern = /\bevery\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/;
    const weekdayMatch = text.match(weekdayPattern);
    if (weekdayMatch) {
        return { unit: 'week', count: 1 };
    }

    // Handle standalone weekday mentions like "mondays", "fridays"
    const standaloneWeekday = /\b(sundays|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays)\b/;
    if (standaloneWeekday.test(text)) {
        return { unit: 'week', count: 1 };
    }

    // Handle "weekdays", "weekends", "business days"
    if (/\b(weekdays?|business\s+days?)\b/.test(text)) {
        return { unit: 'week', count: 1 };
    }
    if (/\bweekends?\b/.test(text)) {
        return { unit: 'week', count: 1 };
    }

    // Handle "on [weekday]" patterns
    const onWeekday = /\bon\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|weekdays?|weekends?)\b/;
    if (onWeekday.test(text)) {
        return { unit: 'week', count: 1 };
    }

    // Handle "twice per/a [unit]"
    const twicePattern = /\btwice\s+(?:per|a)\s+(day|week|month|year)\b/;
    const twiceMatch = text.match(twicePattern);
    if (twiceMatch) {
        const unit = normalizeUnit(twiceMatch[1]);
        // "twice per X" is not directly representable, but we can indicate it needs multiple times
        // For now, return the base unit
        return { unit, count: 1, multiple: 2 };
    }

    // Handle "once per [unit]"
    const oncePattern = /\bonce\s+(?:per|a)\s+(day|week|month|year)\b/;
    const onceMatch = text.match(oncePattern);
    if (onceMatch) {
        const unit = normalizeUnit(onceMatch[1]);
        return { unit, count: 1 };
    }

    // Handle monthly/yearly specific patterns
    // "on the 1st and 15th" -> monthly
    if (/\bon\s+the\s+\d+(st|nd|rd|th)?(\s+and\s+\d+(st|nd|rd|th)?)*/.test(text) && !/\bof\b/.test(text)) {
        return { unit: 'month', count: 1 };
    }

    // "on march 1st" -> yearly
    if (/\bon\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d+/.test(text)) {
        return { unit: 'year', count: 1 };
    }

    return null;
}

/**
 * Parse weekdays from text
 */
function parseWeekdays(text) {
    let weekdays = [];

    // Check for "weekdays" or "business days"
    if (/\b(weekdays?|business\s+days?)\b/.test(text)) {
        weekdays = ['mon', 'tue', 'wed', 'thu', 'fri'];
    }
    // Check for "weekends"
    else if (/\bweekends?\b/.test(text)) {
        weekdays = ['sat', 'sun'];
    }
    // Check for "weekend day"
    else if (/\bweekend\s+day\b/.test(text)) {
        weekdays = ['sat', 'sun'];
    }
    // Check for specific weekdays
    else {
        WEEKDAY_FULL.forEach((day, index) => {
            const pattern = new RegExp(`\\b${day}s?\\b`, 'i');
            if (pattern.test(text)) {
                weekdays.push(WEEKDAY_NAMES[index]);
            }
        });
    }

    // Handle "except" patterns
    const exceptMatch = text.match(/\bexcept\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sundays|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays)\b/i);
    if (exceptMatch) {
        const exceptDay = exceptMatch[1].replace(/s$/, '').toLowerCase();
        const exceptIndex = WEEKDAY_FULL.indexOf(exceptDay);
        if (exceptIndex !== -1) {
            const exceptShort = WEEKDAY_NAMES[exceptIndex];

            // If no weekdays were specified, assume all weekdays except the excluded one
            if (weekdays.length === 0) {
                // Check if context suggests weekdays or all days
                if (/\bweekday\b/.test(text) || /\bbusiness\s+day\b/.test(text)) {
                    weekdays = ['mon', 'tue', 'wed', 'thu', 'fri'];
                } else if (/\bweekend\b/.test(text)) {
                    weekdays = ['sat', 'sun'];
                } else {
                    // Default to all days
                    weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                }
            }

            weekdays = weekdays.filter(d => d !== exceptShort);
        }
    }

    return weekdays;
}

/**
 * Parse month days from text (1st, 15th, last, etc.)
 */
function parseMonthDays(text) {
    const days = [];

    // Check for "last day" variations
    if (/\blast\s+day\b/.test(text) || /\blast\s+calendar\s+day\b/.test(text)) {
        return ['last'];
    }

    // Check for "last weekday" (this is a special case that may need handling differently)
    if (/\blast\s+weekday\b/.test(text)) {
        // For now, return 'last' - the scheduler will need to handle this specially
        return ['last'];
    }

    // Check for "day one", "day 1", "first day"
    if (/\b(day\s+one|day\s+1|first\s+day)\b/.test(text)) {
        return [1];
    }

    // More specific patterns for month days to avoid false positives
    const specificPatterns = [
        // "on the 4th", "on the 15th" (ordinal suffixes are optional after normalization)
        /\bon\s+the\s+(\d+)(?:st|nd|rd|th)?\b/gi,
        // "4th day of", "15th day of", "4 day of" (after normalization)
        /\b(\d+)(?:st|nd|rd|th)?\s+day\s+of\b/gi,
        // "day 4", "day 15"
        /\bday\s+(\d+)\b/gi,
    ];

    for (const pattern of specificPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const day = parseInt(match[1]);
            if (day >= 1 && day <= 31) {
                if (!days.includes(day)) {
                    days.push(day);
                }
            }
        }
    }

    // If we didn't find any specific patterns, fall back to a more general pattern
    // but exclude numbers that are clearly part of "every N" patterns
    if (days.length === 0) {
        // Remove "every N" patterns temporarily to avoid false matches
        const cleanedText = text.replace(/\bevery\s+\d+\s+(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\b/gi, '');

        const dayPattern = /\b(\d+)(?:st|nd|rd|th)?\b/g;
        let match;
        while ((match = dayPattern.exec(cleanedText)) !== null) {
            const day = parseInt(match[1]);
            if (day >= 1 && day <= 31) {
                if (!days.includes(day)) {
                    days.push(day);
                }
            }
        }
    }

    // Handle "30th and 31st when it exists" or similar
    // The "when it exists" part is just informational - we still parse the days
    if (/\bwhen\s+it\s+exists\b/.test(text)) {
        // Add a note that this should skip non-existent dates
        // This would need to be handled by the scheduler implementation
    }

    return days;
}

/**
 * Parse weekday position in month (e.g., "first monday", "last friday", "third tuesday")
 */
function parseWeekdayPosition(text) {
    const ordinals = {
        'first': 1,
        '1st': 1,
        'second': 2,
        '2nd': 2,
        'third': 3,
        '3rd': 3,
        'fourth': 4,
        '4th': 4,
        'fifth': 5,
        '5th': 5,
        'last': -1
    };

    const weekdayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weekdayShort = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    // Pattern: "first/second/third/fourth/fifth/last [weekday] of the month" or "of every month"
    const patterns = [
        /\b(first|second|third|fourth|fifth|last|1st|2nd|3rd|4th|5th)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+of\s+(?:the\s+)?month\b/i,
        /\b(first|second|third|fourth|fifth|last|1st|2nd|3rd|4th|5th)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+of\s+every\s+month\b/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const position = ordinals[match[1].toLowerCase()];
            const weekdayName = match[2].toLowerCase();
            const weekdayIndex = weekdayNames.indexOf(weekdayName);

            if (position && weekdayIndex !== -1) {
                return {
                    weekday: weekdayShort[weekdayIndex],
                    position: position
                };
            }
        }
    }

    return null;
}

/**
 * Parse year date from text (month and day for yearly recurrence)
 */
function parseYearDate(text) {
    const monthMap = {
        'january': 1, 'february': 2, 'march': 3, 'april': 4,
        'may': 5, 'june': 6, 'july': 7, 'august': 8,
        'september': 9, 'october': 10, 'november': 11, 'december': 12
    };

    // Pattern: "on march 1st", "march 1", etc.
    const pattern = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d+)(?:st|nd|rd|th)?\b/i;
    const match = text.match(pattern);

    if (match) {
        const month = monthMap[match[1].toLowerCase()];
        const day = parseInt(match[2]);

        return { month, day };
    }

    // Check for "last day of [month]"
    const lastDayOfMonthPattern = /\blast\s+day\s+of\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
    const lastDayMatch = text.match(lastDayOfMonthPattern);

    if (lastDayMatch) {
        const month = monthMap[lastDayMatch[1].toLowerCase()];
        // Return a special marker for "last day"
        return { month, day: 'last' };
    }

    // Check for special dates
    if (/\bfirst\s+day\s+of\s+(the\s+)?year\b/.test(text)) {
        return { month: 1, day: 1 };
    }

    if (/\b(?:last\s+day\s+of\s+(?:the\s+)?year|december\s+31)\b/.test(text)) {
        return { month: 12, day: 31 };
    }

    // Check for "last day of quarter" or "end of quarter"
    if (/\b(?:last\s+day|end)\s+of\s+(?:the\s+)?quarter\b/.test(text)) {
        // Quarter ends: Mar 31, Jun 30, Sep 30, Dec 31
        // For now, return the first quarter end (March 31)
        // Note: This would ideally generate multiple schedule entries
        return { month: 3, day: 31 };
    }

    return null;
}

/**
 * Normalize unit name
 */
function normalizeUnit(unit) {
    if (!unit) return null;

    unit = unit.toLowerCase().replace(/s$/, ''); // Remove trailing 's'

    const unitMap = {
        'minute': 'minute',
        'hour': 'hour',
        'day': 'day',
        'week': 'week',
        'month': 'month',
        'year': 'year'
    };

    return unitMap[unit] || null;
}

module.exports = {
    parseInterval,
    parseWeekdays,
    parseMonthDays,
    parseYearDate,
    parseWeekdayPosition
};

},{}],10:[function(require,module,exports){
const { normalizeInput, tokenize } = require('./tokenizer');
const { parseDateTime, parseRelativeDate } = require('./dateParser');
const { parseInterval, parseWeekdays, parseMonthDays, parseYearDate, parseWeekdayPosition } = require('./intervalParser');
const { buildScheduleJSON } = require('./builder');

/**
 * Main parser function - converts natural language to schedule JSON
 */
function parseNaturalSchedule(input, options = {}) {
    try {
        const normalized = normalizeInput(input);
        const tokens = tokenize(normalized);

        // Extract components
        const context = {
            start: null,
            repeat: null,
            until: null,
            hasAt: false,
            hasOn: false,
            tokens,
            referenceDate: options.referenceDate || new Date()
        };

        // Parse the input
        parseStart(context);
        parseRepeat(context);
        parseUntil(context);

        // Build the final JSON
        return buildScheduleJSON(context);
    } catch (error) {
        throw new Error(`Failed to parse schedule: ${error.message}`);
    }
}

/**
 * Parse start date/time
 */
function parseStart(context) {
    const { tokens, referenceDate } = context;
    const text = tokens.join(' ');

    // Check for "now" or "right now"
    if (/\bnow\b/.test(text)) {
        context.start = new Date(referenceDate);
        return;
    }

    // Look for explicit dates like "February 1st, 2026 at 9:00 AM"
    const dateMatch = findDateTimePattern(tokens);
    if (dateMatch) {
        context.start = dateMatch;
        return;
    }

    // Look for relative dates like "tomorrow", "next tuesday", "this friday"
    const relativeMatch = findRelativeDate(tokens, referenceDate);
    if (relativeMatch) {
        context.start = relativeMatch;
        return;
    }

    // Look for "in X days/months/years" patterns
    const inFutureMatch = findInFuturePattern(text, referenceDate);
    if (inFutureMatch) {
        context.start = inFutureMatch;
        return;
    }

    // Look for "at" time patterns
    const timeMatch = findTimePattern(tokens);
    if (timeMatch) {
        // Start is today at the specified time
        const start = new Date(referenceDate);
        start.setHours(timeMatch.hours, timeMatch.minutes, 0, 0);

        // If time has passed today, start tomorrow
        if (start < referenceDate) {
            start.setDate(start.getDate() + 1);
        }

        context.start = start;
        context.hasAt = true;
        return;
    }

    // Check if there's a repeat - if so, use reference date
    // If no repeat found, this might be an error
    const hasRepeatKeywords = /\b(every|daily|weekly|monthly|quarterly|yearly|annually|hourly)\b/.test(text);

    if (hasRepeatKeywords) {
        // Use reference date as start for repeating schedules
        context.start = new Date(referenceDate);
    } else {
        // No repeat and no clear start time - this is likely an error
        throw new Error(`Could not determine start date/time from: "${text}". Please specify a time or date.`);
    }
}

/**
 * Parse repeat configuration
 */
function parseRepeat(context) {
    const { tokens } = context;
    const text = tokens.join(' ');

    // Check if this is a one-time event
    if (isOneTime(tokens)) {
        context.repeat = null;
        return;
    }

    // Check for one-time future date patterns that shouldn't repeat
    // e.g., "5 fridays from now", "in 40 days", "30 days from now", "next tuesday"
    const oneTimeFuturePatterns = [
        /\b\d+\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\s+from\s+now\b/,
        /\bin\s+\d+\s+(days?|weeks?|months?|years?)\b/,
        /\b\d+\s+(days?|weeks?|months?|years?)\s+from\s+now\b/,
        /\b(next|this)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
        /\b(tomorrow|today|yesterday)\b/,
        /\bnext\s+(week|month|quarter|year)\b/,
        /\b(beginning|start|end|last day)\s+of\s+(next|this|the)\s+(month|quarter|year)\b/,
        // Full dates with explicit year (e.g., "December 14th 2026", "Dec 14 2026", "2026-12-14")
        /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(st|nd|rd|th)?\s+\d{4}\b/i,
        /\b\d{4}-\d{2}-\d{2}\b/,
    ];

    for (const pattern of oneTimeFuturePatterns) {
        if (pattern.test(text)) {
            context.repeat = null;
            return;
        }
    }

    // Parse interval (every N days/weeks/months)
    const interval = parseInterval(tokens);
    if (!interval) {
        // Check if "every" was mentioned but we couldn't parse it
        if (/\bevery\b/.test(text)) {
            throw new Error(`Could not parse interval from: "${text}". Please specify a valid interval (e.g., "every 3 days", "every week", "every month").`);
        }
        // No repeat found
        context.repeat = null;
        return;
    }

    context.repeat = { interval };

    // Parse "on" clause (weekdays, month_days, year_date)
    const on = parseOnClause(tokens, interval.unit);
    if (on) {
        context.repeat.on = on;
        context.hasOn = true;
    }

    // Parse "at" time
    const atTime = parseAtTime(tokens);
    if (atTime) {
        context.repeat.at = atTime;
        context.hasAt = true;
    }
}

/**
 * Parse until date
 */
function parseUntil(context) {
    const { tokens, referenceDate } = context;

    const untilMatch = findUntilPattern(tokens, referenceDate);
    if (untilMatch) {
        context.until = untilMatch;
    }
}

/**
 * Helper functions
 */

function isOneTime(tokens) {
    const text = tokens.join(' ');
    return /\b(once|one[- ]time)\b/.test(text);
}

function findDateTimePattern(tokens) {
    const text = tokens.join(' ');

    // Pattern: Month Day, Year at Time
    // e.g., "February 1st, 2026 at 9:00 AM", "Dec 14th 2026 at 3PM"
    const patterns = [
        // Full date with time (with minutes) - "December 14th 2026 at 9:00 AM"
        /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)?,?\s+(\d{4})\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?\b/i,
        // Full date with time (without minutes) - "December 14th 2026 at 3PM"
        /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)?,?\s+(\d{4})\s+at\s+(\d{1,2})\s*(am|pm)\b/i,
        // Full date without time - "December 14th 2026"
        /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)?,?\s+(\d{4})\b/i,
        // Month and day with time (with minutes)
        /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)?\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?\b/i,
        // ISO date format
        /\b(\d{4})-(\d{2})-(\d{2})\s+(?:at\s+)?(\d{1,2}):(\d{2})\b/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return parseDateTime(match);
        }
    }

    return null;
}

function findRelativeDate(tokens, referenceDate) {
    const text = tokens.join(' ');
    return parseRelativeDate(text, referenceDate);
}

function findTimePattern(tokens) {
    const text = tokens.join(' ');

    // Patterns for time
    const patterns = [
        // 14:00 (24-hour format)
        /\bat\s+(\d{1,2}):(\d{2})(?!\s*(?:am|pm))\b/i,
        // 9:00 AM, 10:30 PM
        /\bat\s+(\d{1,2}):(\d{2})\s*(am|pm)\b/i,
        // 9am, 10pm, "at 10"
        /\bat\s+(\d{1,2})\s*(am|pm)?\b/i,
        // midnight, noon
        /\bat\s+(midnight|noon)\b/i,
        // "in the morning", "in the afternoon"
        /\bin\s+the\s+(morning|afternoon|evening|night)\b/i,
        // "morning", "afternoon", "evening", "night"
        /\b(morning|afternoon|evening|night)\b/i,
        // "early" (6am), "late morning" (11am), "early afternoon" (1pm)
        /\b(early|late)\s+(morning|afternoon)\b/i,
        // standalone "early" or "late"
        /\b(early|late)\b/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const time = parseTimeMatch(match);
            if (time) return time;
        }
    }

    return null;
}

function findInFuturePattern(text, referenceDate) {
    // "in X days", "in X months", "in X years"
    const patterns = [
        /\bin\s+(\d+)\s+(days?|months?|years?)\b/i,
        /\bin\s+(two|three|four|five|six)\s+(days?|months?|years?)\b/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const numberMap = {
                'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6
            };

            const count = isNaN(match[1]) ? numberMap[match[1]] : parseInt(match[1]);
            const unit = match[2].replace(/s$/, '').toLowerCase();

            const result = new Date(referenceDate);

            if (unit === 'day') {
                result.setDate(result.getDate() + count);
            } else if (unit === 'month') {
                result.setMonth(result.getMonth() + count);
            } else if (unit === 'year') {
                result.setFullYear(result.getFullYear() + count);
            }

            // Look for time
            const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
            if (timeMatch) {
                const time = parseTimeFromMatch(timeMatch);
                result.setHours(time.hours, time.minutes, 0, 0);
            } else {
                result.setHours(9, 0, 0, 0); // Default to 9am
            }

            return result;
        }
    }

    return null;
}

function parseTimeFromMatch(match) {
    let hours = parseInt(match[1]);
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const period = match[3] ? match[3].toLowerCase() : null;

    if (period === 'pm' && hours !== 12) {
        hours += 12;
    } else if (period === 'am' && hours === 12) {
        hours = 0;
    }

    return { hours, minutes };
}

function parseTimeMatch(match) {
    // Handle special time names
    if (match[1] === 'midnight') {
        return { hours: 0, minutes: 0 };
    }
    if (match[1] === 'noon') {
        return { hours: 12, minutes: 0 };
    }

    // Handle "early" and "late" modifiers
    if (match[1] === 'early') {
        if (match[2] === 'morning') {
            return { hours: 6, minutes: 30 };
        } else if (match[2] === 'afternoon') {
            return { hours: 13, minutes: 0 };
        } else {
            // Standalone "early" means early morning
            return { hours: 6, minutes: 0 };
        }
    }
    if (match[1] === 'late') {
        if (match[2] === 'morning') {
            return { hours: 11, minutes: 0 };
        } else if (match[2] === 'afternoon') {
            return { hours: 17, minutes: 0 };
        } else {
            // Standalone "late" means late evening
            return { hours: 22, minutes: 0 };
        }
    }

    // Handle general time periods
    if (match[1] === 'morning') {
        return { hours: 9, minutes: 0 };
    }
    if (match[1] === 'afternoon') {
        return { hours: 14, minutes: 0 };
    }
    if (match[1] === 'evening') {
        return { hours: 18, minutes: 0 };
    }
    if (match[1] === 'night') {
        return { hours: 20, minutes: 0 };
    }

    // Handle numeric times
    let hours = parseInt(match[1]);
    let minutes = 0;
    let period = null;

    // Check if match[2] is a number (minutes) or am/pm
    if (match[2] && !isNaN(parseInt(match[2]))) {
        minutes = parseInt(match[2]);
        period = match[3] ? match[3].toLowerCase() : null;
    } else {
        // match[2] is am/pm or null
        period = match[2] ? match[2].toLowerCase() : null;
    }

    // Convert 24-hour format if no period specified and hours > 12
    if (!period && hours > 12 && hours <= 23) {
        // Already in 24-hour format
        return { hours, minutes };
    }

    if (period === 'pm' && hours !== 12) {
        hours += 12;
    } else if (period === 'am' && hours === 12) {
        hours = 0;
    }

    return { hours, minutes };
}

function parseOnClause(tokens, unit) {
    const text = tokens.join(' ');

    // Weekly: parse weekdays
    if (unit === 'week') {
        const weekdays = parseWeekdays(text);
        if (weekdays.length > 0) {
            return { weekdays };
        }
    }

    // Monthly: check for weekday position first (e.g., "first wednesday of the month")
    if (unit === 'month') {
        const weekdayPos = parseWeekdayPosition(text);
        if (weekdayPos) {
            return { weekday_position: weekdayPos };
        }

        const monthDays = parseMonthDays(text);
        if (monthDays.length > 0) {
            return { month_days: monthDays };
        }
    }

    // Yearly: parse year date
    if (unit === 'year') {
        const yearDate = parseYearDate(text);
        if (yearDate) {
            return { year_date: yearDate };
        }
    }

    // Handle weekday constraints for day/daily intervals
    if (unit === 'day') {
        const weekdays = parseWeekdays(text);
        if (weekdays.length > 0 && weekdays.length < 7) {
            // Convert to weekly schedule
            return { weekdays };
        }
    }

    return null;
}

function parseAtTime(tokens) {
    const text = tokens.join(' ');

    const patterns = [
        /\bat\s+(\d{1,2}):(\d{2})\s*(am|pm)?\b/i,
        /\bat\s+(\d{1,2})\s*(am|pm)\b/i,
        /\bat\s+(midnight|noon)\b/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const time = parseTimeMatch(match);
            if (time && !isNaN(time.hours) && !isNaN(time.minutes)) {
                return `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}`;
            }
        }
    }

    return null;
}

function findUntilPattern(tokens, referenceDate) {
    const text = tokens.join(' ');

    const patterns = [
        /\buntil\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)?,?\s+(\d{4})\b/i,
        /\buntil\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)?\b/i,
        /\buntil\s+(\d{4})-(\d{2})-(\d{2})\b/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return parseDateTime(match);
        }
    }

    return null;
}

module.exports = {
    parseNaturalSchedule
};

},{"./builder":6,"./dateParser":8,"./intervalParser":9,"./tokenizer":11}],11:[function(require,module,exports){
/**
 * Tokenizer - normalizes and tokenizes input
 */

function normalizeInput(input) {
    if (!input || typeof input !== 'string') {
        throw new Error('Input must be a non-empty string');
    }

    let normalized = input.toLowerCase().trim();

    // Handle common typos and variations
    normalized = normalized
        // Typo corrections - weekdays
        .replace(/\bthrusday\b/g, 'thursday')
        .replace(/\bwensday\b/g, 'wednesday')
        .replace(/\btuseday\b/g, 'tuesday')
        .replace(/\bsaterday\b/g, 'saturday')

        // Typo corrections - months
        .replace(/\bfeburary\b/g, 'february')
        .replace(/\bfebruary\b/g, 'february')
        .replace(/\bseptemeber\b/g, 'september')
        .replace(/\boctobor\b/g, 'october')
        .replace(/\bnovemeber\b/g, 'november')
        .replace(/\bdecemeber\b/g, 'december')

        // Typo corrections - common words
        .replace(/\bevry\b/g, 'every')
        .replace(/\bever\b/g, 'every')
        .replace(/\bdya\b/g, 'day')
        .replace(/\bdaus\b/g, 'days')
        .replace(/\bdyas\b/g, 'days')
        .replace(/\bweekdys\b/g, 'weekdays')
        .replace(/\bbussiness\b/g, 'business')
        .replace(/\bbusness\b/g, 'business')
        .replace(/\bworkday\b/g, 'weekday')
        .replace(/\bworkdays\b/g, 'weekdays')
        .replace(/\bmoth\b/g, 'month')
        .replace(/\bmonhs\b/g, 'months')
        .replace(/\bwekes\b/g, 'weeks')
        .replace(/\bweks\b/g, 'weeks')
        .replace(/\byeras\b/g, 'years')
        .replace(/\bminuts\b/g, 'minutes')
        .replace(/\bminuets\b/g, 'minutes')

        // Variations
        .replace(/\beveryday\b/g, 'every day')
        .replace(/\bweekend day\b/g, 'weekend')

        // Alternative separators
        .replace(/\s+\+\s+/g, ' and ')
        .replace(/\s*\/\s*/g, ' and ')
        .replace(/\bminus\b/g, 'except')
        .replace(/\bbut not\b/g, 'except')

        // Normalize contractions and variations
        .replace(/\bmon\b/g, 'monday')
        .replace(/\btues?\b/g, 'tuesday')
        .replace(/\bweds?\b/g, 'wednesday')
        .replace(/\bthurs?\b/g, 'thursday')
        .replace(/\bthur\b/g, 'thursday')
        .replace(/\bthu\b/g, 'thursday')
        .replace(/\bfri\b/g, 'friday')
        .replace(/\bsat\b/g, 'saturday')
        .replace(/\bsun\b/g, 'sunday')

        .replace(/\bjan\b/g, 'january')
        .replace(/\bfeb\b/g, 'february')
        .replace(/\bmar\b/g, 'march')
        .replace(/\bapr\b/g, 'april')
        .replace(/\bjun\b/g, 'june')
        .replace(/\bjul\b/g, 'july')
        .replace(/\baug\b/g, 'august')
        .replace(/\bsep\b/g, 'september')
        .replace(/\bsept\b/g, 'september')
        .replace(/\boct\b/g, 'october')
        .replace(/\bnov\b/g, 'november')
        .replace(/\bdec\b/g, 'december')

        // Normalize time expressions
        .replace(/\bmidnite\b/g, 'midnight')
        .replace(/\b12\s*am\b/g, 'midnight')
        .replace(/\b12\s*pm\b/g, 'noon')
        .replace(/\b12:00\s*am\b/g, 'midnight')
        .replace(/\b12:00\s*pm\b/g, 'noon')
        .replace(/\b00:00\b/g, 'midnight')

        // Normalize "o'clock"
        .replace(/\b(\d{1,2})\s*o'?clock\b/g, '$1:00')

        // Normalize time qualifiers
        .replace(/\baround\b/g, 'at')
        .replace(/\bvery early\b/g, 'early')
        .replace(/\bvery late\b/g, 'late')
        .replace(/\bfirst thing\b/g, 'early')

        // Normalize ordinals in numbers
        .replace(/\b1st\b/g, '1')
        .replace(/\b2nd\b/g, '2')
        .replace(/\b3rd\b/g, '3')
        .replace(/\b(\d+)th\b/g, '$1')

        // Normalize ordinal words
        .replace(/\b3rd day\b/g, '3 days')
        .replace(/\bthird day\b/g, '3 days')

        // Normalize time references
        .replace(/\bright now\b/g, 'now')
        .replace(/\bthis moment\b/g, 'now')
        .replace(/\blater today\b/g, 'today later')
        .replace(/\bthis coming\b/g, 'next')
        .replace(/\bstart of\b/g, 'beginning of')
        .replace(/\bend of\b/g, 'last day of')
        .replace(/\bvery end\b/g, 'last day')

        // Normalize "forever" and "until end of time"
        .replace(/\bforever\b/g, '')
        .replace(/\buntil the end of time\b/g, '')
        .replace(/\bno matter what\b/g, '')

        // Normalize special dates
        .replace(/\bleap day\b/g, 'february 29')

        // Normalize multiple spaces
        .replace(/\s+/g, ' ');

    return normalized;
}

function tokenize(input) {
    // Split on whitespace but keep punctuation
    return input
        .split(/\s+/)
        .filter(token => token.length > 0);
}

module.exports = {
    normalizeInput,
    tokenize
};

},{}]},{},[1])(1)
});
