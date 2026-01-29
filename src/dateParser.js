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
        minutes = match[6] ? parseInt(match[6]) : 0;

        const period = match[7] ? match[7].toLowerCase() : null;
        if (period === 'pm' && hours !== 12) {
            hours += 12;
        } else if (period === 'am' && hours === 12) {
            hours = 0;
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
