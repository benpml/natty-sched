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
