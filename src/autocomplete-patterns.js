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
