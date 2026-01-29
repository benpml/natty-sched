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

        if (interval.unit === 'month' && !on.month_days) {
            throw new Error('Monthly schedules must specify month_days');
        }

        if (interval.unit === 'year' && !on.year_date) {
            throw new Error('Yearly schedules must specify year_date');
        }
    }
}

module.exports = {
    buildScheduleJSON
};
