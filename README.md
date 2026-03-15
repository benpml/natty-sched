# Natural Scheduler

Natural-language schedule and datetime autocomplete for apps that need user-friendly time input.

`natty-sched` gives you three core workflows:

- schedule autocomplete and resolution for recurring rules like `every friday at 5pm`
- datetime autocomplete and resolution for one-time moments like `tomorrow morning`
- a combined mode when the user might mean either

It is built for product input fields, not just raw parsing. The resolver functions use the same code path as autocomplete, so the value a user selects is the same value you get when resolving that exact string later.

## Install

```bash
npm install natty-sched
```

## Browser / unpkg

The package ships a UMD bundle for browser use:

```html
<script src="https://unpkg.com/natty-sched/dist/natty-sched.umd.js"></script>
<script>
  const results = NattySched.autocompleteDatetime('today', new Date(), true, {
    limit: 5,
    includeValue: true
  });
  console.log(results);
</script>
```

## Exported Functions

```js
const {
  autocomplete,
  autocompleteSchedule,
  autocompleteDatetime,
  resolveString,
  resolveScheduleString,
  resolveDatetimeString,
  calcNextScheduledTime
} = require('natty-sched');
```

## Quick Start

### 1. Recurring schedules

```js
const { autocompleteSchedule, resolveScheduleString, calcNextScheduledTime } = require('natty-sched');

const suggestions = autocompleteSchedule('every fri', {
  limit: 5,
  includeValue: true
});

const schedule = resolveScheduleString('every friday at 5pm');
const nextRun = calcNextScheduledTime(schedule, {
  from: new Date('2026-03-15T12:00:00')
});
```

### 2. One-time datetimes

```js
const { autocompleteDatetime, resolveDatetimeString } = require('natty-sched');

const referenceDate = new Date('2026-03-15T13:37:00');

const suggestions = autocompleteDatetime('today', referenceDate, true, {
  limit: 10,
  includeValue: true
});

const value = resolveDatetimeString('Now', referenceDate, true);
// => { datetime: '2026-03-15T13:37:00', timestamp: 1773596220000 }
```

### 3. Mixed input fields

```js
const { autocomplete, resolveString } = require('natty-sched');

const results = autocomplete('friday', {
  limit: 10,
  includeValue: true
});

const value = resolveString('every friday at 5pm');
```

## Returned Shapes

### Schedule suggestion

```js
{
  label: 'Every Friday at 5 PM',
  input: 'Every Friday at 5 PM',
  value: {
    start: '2026-03-15T17:00:00',
    repeat: {
      interval: { unit: 'week', count: 1 },
      on: { weekdays: ['fri'] },
      at: '17:00'
    }
  },
  score: 0.94,
  source: 'template',
  type: 'schedule'
}
```

### Datetime suggestion

```js
{
  label: 'Tomorrow morning',
  input: 'Tomorrow morning',
  value: {
    datetime: '2026-03-16T09:00:00',
    timestamp: 1773666000000
  },
  score: 0.91,
  source: 'datetime',
  type: 'datetime'
}
```

## Core API

### `autocomplete(input, options?)`
### `autocomplete(input, referenceDate, excludePast?, options?)`

Combined autocomplete for schedule and datetime input.

Useful when the user may type either a recurring rule or a one-time date/time.

Options:

- `limit` default `10`
- `includeValue` default `true`
- `minScore` default `0.3`
- `referenceDate` for relative datetime resolution
- `excludePast` to omit datetime results before `referenceDate`
- `allowRecurring` default `true`
- `allowOneTime` default `true`
- `category` to filter schedule suggestions by category
- `defaultTime` to control fallback time for datetime resolution
- `wheneverDays` to control the random window used for `whenever`

Example:

```js
const results = autocomplete('today', new Date('2026-03-15T13:37:00'), true, {
  limit: 10,
  includeValue: true
});
```

### `autocompleteSchedule(input, options?)`
### `autocompleteSchedule(input, referenceDate, excludePast?, options?)`

Schedule-only autocomplete.

This produces recurring schedule suggestions only.

Example:

```js
autocompleteSchedule('every 2', { limit: 5, includeValue: true });
autocompleteSchedule('', { limit: 10, category: 'Monthly' });
```

### `autocompleteDatetime(input, options?)`
### `autocompleteDatetime(input, referenceDate, excludePast?, options?)`

Datetime-only autocomplete.

This produces one-time datetime suggestions only.

Datetime-specific options:

- `referenceDate`
- `excludePast`
- `defaultTime`
- `wheneverDays`
- `limit`
- `includeValue`
- `minScore`

When `excludePast` is `true`, only datetimes at or after `referenceDate` are returned. `Now` is still allowed.

If `input` is `''` or `null`, the default popular datetime suggestions are returned:

- `Now`
- `In 1 hour`
- `Tomorrow morning`
- `Monday at 8 AM`
- `In 1 week`
- `1 month from now`
- `Next year`
- `Tonight`
- `Friday at 5 PM`
- `Christmas`

Example:

```js
const defaults = autocompleteDatetime('', new Date('2026-03-15T13:37:00'), true, {
  limit: 10,
  includeValue: true
});
```

## Resolver Functions

The resolver functions are designed so there is no drift between:

- what autocomplete says a string means
- what your app later resolves that same string to

That is the main contract of this library.

### `resolveScheduleString(input, options?)`
### `resolveScheduleString(input, referenceDate, excludePast?, options?)`

Returns the exact schedule JSON that the schedule autocomplete pipeline would attach to that input.

```js
const schedule = resolveScheduleString('every day at 9am');
```

### `resolveDatetimeString(input, options?)`
### `resolveDatetimeString(input, referenceDate, excludePast?, options?)`

Returns the exact `{ datetime, timestamp }` value that the datetime autocomplete pipeline would attach to that input.

```js
const value = resolveDatetimeString('Now', new Date('2026-03-15T13:37:00'), true);
```

### `resolveString(input, options?)`
### `resolveString(input, referenceDate, excludePast?, options?)`

Returns the exact `value` from the combined autocomplete pipeline.

```js
const value1 = resolveString('Now', new Date('2026-03-15T13:37:00'), true);
const value2 = resolveString('every friday at 5pm');
```

Notes:

- blank input returns `null` for all resolver functions
- if there is no exact normalized match, the resolver falls back to the top autocomplete result for that input

## `calcNextScheduledTime(schedule, options?)`

Calculates the next run time for a resolved schedule.

Parameters:

- `schedule`: schedule JSON from `resolveScheduleString` or schedule autocomplete
- `options.from`: calculate from this date, default `now`
- `options.asTimestamp`: when `true`, return unix milliseconds instead of `Date`

Example:

```js
const schedule = resolveScheduleString('every friday at 5pm');

const nextDate = calcNextScheduledTime(schedule, {
  from: new Date('2026-03-15T12:00:00')
});

const nextTimestamp = calcNextScheduledTime(schedule, {
  from: new Date('2026-03-15T12:00:00'),
  asTimestamp: true
});
```

## Supported Input Examples

### Schedule examples

```js
'every day at 9am'
'weekdays at 8:30am'
'mondays and fridays at 5pm'
'every 3 days at noon'
'first monday of the month at 9am'
'every year on december 31st at 11:59pm'
```

### Datetime examples

```js
'now'
'tomorrow morning'
'tonight'
'friday at 5pm'
'in 2 weeks'
'1 month from now'
'christmas evening'
```

## Common Patterns

### Build a mixed input field

```js
function getSuggestions(text) {
  return autocomplete(text, new Date(), true, {
    limit: 8,
    includeValue: true
  });
}
```

### Store exact values from selected text later

```js
const selectedText = 'Tomorrow morning';
const value = resolveDatetimeString(selectedText, referenceDate, true);
```

### Resolve recurring schedules and compute next run

```js
const schedule = resolveScheduleString('every monday at 10am');
const nextRun = calcNextScheduledTime(schedule, { from: new Date() });
```

## Notes

- `referenceDate` can be a `Date`, ISO string, or unix milliseconds
- `excludePast` only affects datetime behavior
- if no time is specified for datetime resolution, the current time-of-day from `referenceDate` is used as the default
- browser builds use the local timezone of the runtime environment

## Verification

Current repo checks:

- `npm test`
- `node test-datetime-autocomplete.js`
- `npm run build:umd`
