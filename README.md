# Natural Scheduler

A comprehensive natural language parser that converts human-friendly schedule descriptions into structured JSON format. Built to handle typos, variations, and complex scheduling patterns with proper validation.

## 🎯 Key Features

- ✅ **Proper interval support** - Every N days/weeks/months/years
- ✅ **Typo tolerance** - Handles common misspellings (dya→day, daus→days, bussiness→business)
- ✅ **Alternative syntax** - Supports +, /, "except", "minus", "but not"
- ✅ **Rich time expressions** - Early morning, late afternoon, evening, night
- ✅ **Relative dates** - Tomorrow, next Tuesday, 5 fridays from now, in 40 days
- ✅ **Weekday patterns** - Specific days, weekdays, weekends, business days, except patterns
- ✅ **Monthly patterns** - Specific dates, last day, when it exists
- ✅ **Yearly patterns** - Annual schedules with specific dates, last day of month
- ✅ **Proper validation** - Throws clear errors instead of silent fallbacks
- ✅ **Zero dependencies** - Pure JavaScript implementation

## 📦 Installation

```bash
npm install natty-sched
```

## 🚀 Quick Start

```javascript
const { parse } = require('natty-sched');

const result = parse("Every 45 days at 9am");
console.log(JSON.stringify(result, null, 2));
```

## 📐 JSON Format

The library outputs schedules in this canonical format:

```javascript
{
  "start": "ISO-8601 datetime",      // Required: First execution time

  "repeat": {                         // Optional: Omit for one-time events
    "interval": {
      "unit": "minute | hour | day | week | month | year",
      "count": 1                      // Number of units between executions
    },

    "on": {                          // Optional: Constraints based on unit
      "weekdays": ["mon", "tue"],    // For weekly schedules
      "month_days": [1, 15, "last"], // For monthly schedules
      "year_date": {                 // For yearly schedules
        "month": 3,
        "day": 1
      }
    },

    "at": "HH:MM"                    // Required for day/week/month/year
  },

  "until": "ISO-8601 date or datetime"  // Optional: End date
}
```

## 📚 Examples

### Basic Intervals

```javascript
parse("Every 45 days at 9am")
// Every 45 days starting at 9am

parse("Every 15 minutes")
// Every 15 minutes

parse("Every other day at 8:30 AM")
// Every 2 days at 8:30am

parse("Hourly on the half hour")
// Every hour (with minutes from start time)
```

### With Typos

```javascript
parse("Ever 29 dyas")          // ✅ Parses as "Every 29 days"
parse("Every dya at 3 am")     // ✅ Parses as "Every day at 3am"
parse("Bussiness days at 9am") // ✅ Parses as "Business days at 9am"
```

### Weekday Patterns

```javascript
parse("Weekdays at 9:00 AM")
// Mon-Fri at 9am

parse("Business days at 9:30 AM")
// Same as weekdays

parse("Every thursday at 2pm")
// Weekly on Thursday at 2pm

parse("Mondays and Wednesdays at 3:00 PM")
// Weekly on Mon and Wed at 3pm

parse("Tuesday + Thursday at 1pm")
// Alternative separator syntax

parse("Mon/Wed/Fri at 10am")
// Slash separator syntax

parse("Weekdays except fridays at 8am")
// Mon-Thu at 8am

parse("Weekends but not sundays at 10am")
// Saturday only at 10am
```

### Time Variations

```javascript
parse("Weekdays early at 6:30am")
// "early" = 6:30am

parse("Every day late morning")
// "late morning" = 11am

parse("Weekends evening at 6pm")
// "evening" = 6pm (or explicit 6pm)

parse("Every workday morning at 8")
// Mon-Fri at 8am

parse("Every weekday afternoon at 3:15")
// Mon-Fri at 3:15pm

parse("Every weekend night at 10pm")
// Sat-Sun at 10pm
```

### Monthly Patterns

```javascript
parse("On the 1st and 15th at noon")
// Monthly on 1st and 15th at 12pm

parse("On the last day of each month at 9:00 AM")
// Last day of month at 9am

parse("Every 3 months on the 1st at 9:00 AM")
// Quarterly on the 1st at 9am

parse("Monthly on the 31st when it exists")
// 31st of each month (skips Feb, Apr, Jun, Sep, Nov)
```

### Yearly Patterns

```javascript
parse("Annually on March 1st at 9:00 AM")
// March 1st every year at 9am

parse("Every year on the last day of February")
// Feb 28/29 every year

parse("Every year on leap day at 9am")
// Feb 29 (only on leap years)

parse("Every year, December 31st at 11:59pm")
// Dec 31 at 11:59pm annually
```

### Relative Dates (One-Time)

```javascript
parse("Tomorrow at 7am")
// One-time, tomorrow at 7am

parse("Next Tuesday at 8pm")
// One-time, next Tuesday at 8pm

parse("In 45 days at 8am")
// One-time, 45 days from now at 8am

parse("30 days from now at 9am")
// One-time, 30 days from reference date

parse("5 fridays from now at 2pm")
// One-time, the 5th Friday from now

parse("Next quarter at midnight")
// One-time, start of next quarter

parse("End of the year at midnight")
// One-time, Dec 31 at midnight

parse("Later today at 4pm")
// One-time, today at 4pm
```

### Edge Cases

```javascript
parse("Every day at midnight forever")
// Daily at midnight (no end date)

parse("Every month on last day, no matter what")
// Last day of each month

parse("Once, right now")
// One-time event at current time

parse("Once, tomorrow morning")
// One-time tomorrow at 9am (default morning time)
```

## 🎯 API

### `parse(input, options?)`

Parses natural language input into a schedule JSON object.

**Parameters:**
- `input` (string): Natural language schedule description
- `options` (object, optional):
  - `referenceDate` (Date): Reference date for relative dates (default: now)

**Returns:** Schedule JSON object

**Throws:** Error with descriptive message if input cannot be parsed

**Example:**
```javascript
try {
  const result = parse("Every 41 days at 9am");
  console.log(result);
} catch (error) {
  console.error(error.message);
}
```

### `getNextScheduledTime(schedule, options?)` / `nextRun(schedule, options?)`

Calculates the next scheduled execution time from a schedule JSON object.

**Parameters:**
- `schedule` (object): Schedule JSON object (from `parse()`)
- `options` (object, optional):
  - `from` (Date): Calculate from this date (default: now)
  - `asTimestamp` (boolean): Return unix timestamp in milliseconds (default: false)

**Returns:**
- `Date` object (if `asTimestamp` is false)
- `number` (unix timestamp in milliseconds if `asTimestamp` is true)
- `null` if schedule has ended (past "until" date) or one-time event has passed

**Examples:**
```javascript
const schedule = parse("Every 3 days at 9am");

// Get next run as Date
const nextDate = getNextScheduledTime(schedule);
console.log(nextDate.toISOString()); // "2026-02-04T09:00:00.000Z"

// Get next run as unix timestamp
const nextTimestamp = getNextScheduledTime(schedule, { asTimestamp: true });
console.log(nextTimestamp); // 1770394800000

// Calculate from specific date
const fromDate = new Date('2026-02-15T10:00:00');
const next = getNextScheduledTime(schedule, { from: fromDate });
console.log(next.toISOString()); // "2026-02-16T09:00:00.000Z"

// Using the alias
const next2 = nextRun(schedule, { asTimestamp: true });
console.log(next2); // 1770394800000

// One-time event in the past returns null
const pastSchedule = parse("Tomorrow at 7am");
const result = getNextScheduledTime(pastSchedule, {
  from: new Date('2026-02-10T10:00:00') // After the event
});
console.log(result); // null

// Schedule with "until" date
const limitedSchedule = parse("Every day at 9am");
limitedSchedule.until = "2026-02-10T00:00:00";
const afterEnd = getNextScheduledTime(limitedSchedule, {
  from: new Date('2026-02-11T10:00:00')
});
console.log(afterEnd); // null (schedule ended)
```

## ✅ Validation

The library provides proper validation and throws meaningful errors instead of silently falling back to defaults:

```javascript
// ❌ Invalid input
parse("asdfasdfasdf")
// Throws: "Could not determine start date/time from: ..."

// ❌ Ambiguous input
parse("sometime later")
// Throws: "Could not determine start date/time from: ..."

// ✅ Valid with typos
parse("ever 29 dyas at 9am")
// Works! Typos are corrected automatically
```

## 🧪 Testing

Run the test suite:

```bash
npm test                          # Run basic tests
node test-comprehensive.js        # Run all 67 comprehensive tests
node comparison.js                # See feature comparison demo
```

All tests pass, covering:
- Basic intervals (minutes, hours, days, weeks, months, years)
- Typo corrections
- Weekday patterns with exceptions
- Monthly and yearly patterns
- Relative dates and future scheduling
- Time variations (early, late, morning, afternoon, evening, night)
- Edge cases (leap day, last day, when it exists)

## 🎮 Interactive Demo

Run the interactive CLI demo:

```bash
node demo.js
```

Try entering natural language schedules and see the JSON output with human-friendly interpretations!

## 🏆 Supported Patterns

### Intervals
- `every N minutes/hours/days/weeks/months/years`
- `every other day/week/month`
- `hourly/daily/weekly/monthly/quarterly/yearly`

### Weekdays
- Specific: `monday`, `tuesdays`, `every friday`
- Groups: `weekdays`, `weekends`, `business days`
- With exceptions: `weekdays except fridays`, `weekends but not sundays`
- Alternative syntax: `monday and wednesday`, `tue + thu`, `mon/wed/fri`

### Time Expressions
- Explicit: `at 9am`, `at 14:00`, `at 5:30 PM`
- Named: `midnight`, `noon`, `morning`, `afternoon`, `evening`, `night`
- Qualified: `early morning`, `late afternoon`, `around 9am`

### Relative Dates
- Simple: `tomorrow`, `today`, `next tuesday`
- Future: `in 40 days`, `30 days from now`, `5 fridays from now`
- Period: `next month`, `next quarter`, `next year`
- Special: `end of the year`, `start of next month`

### Monthly
- Specific dates: `1st`, `15th`, `on the 10th`
- Last day: `last day`, `last calendar day`
- Conditional: `31st when it exists`

### Yearly
- With month: `march 1st`, `december 31st`
- Special: `leap day`, `last day of february`

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! The library prioritizes:
- Natural language flexibility
- Typo tolerance
- Clear error messages
- Zero dependencies
- Comprehensive test coverage
