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
