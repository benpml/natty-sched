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
