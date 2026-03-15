# Natural Scheduler

Natural language schedule and datetime autocomplete with resolver functions that stay aligned with the autocomplete pipeline.

## Installation

```bash
npm install natty-sched
```

## Public API

The package exports these functions:

- `autocomplete(input, options?)`
- `autocomplete(input, referenceDate, excludePast?, options?)`
- `autocompleteSchedule(input, options?)`
- `autocompleteSchedule(input, referenceDate, excludePast?, options?)`
- `autocompleteDatetime(input, options?)`
- `autocompleteDatetime(input, referenceDate, excludePast?, options?)`
- `resolveString(input, options?)`
- `resolveString(input, referenceDate, excludePast?, options?)`
- `resolveScheduleString(input, options?)`
- `resolveScheduleString(input, referenceDate, excludePast?, options?)`
- `resolveDatetimeString(input, options?)`
- `resolveDatetimeString(input, referenceDate, excludePast?, options?)`
- `calcNextScheduledTime(schedule, options?)`

## Quick Start

```javascript
const {
  autocomplete,
  autocompleteSchedule,
  autocompleteDatetime,
  resolveString,
  resolveScheduleString,
  resolveDatetimeString,
  calcNextScheduledTime
} = require('natty-sched');

const scheduleSuggestions = autocompleteSchedule('every fri', { limit: 5, includeValue: true });
const schedule = resolveScheduleString('every friday at 5pm');

const datetimeSuggestions = autocompleteDatetime('today', new Date('2026-03-15T13:37:00'), true, {
  limit: 10,
  includeValue: true
});
const datetimeValue = resolveDatetimeString('Now', new Date('2026-03-15T13:37:00'), true);

const mixedSuggestions = autocomplete('fri', { limit: 10, includeValue: true });
const mixedValue = resolveString('Now', new Date('2026-03-15T13:37:00'), true);

const nextRun = calcNextScheduledTime(schedule, { from: new Date() });
```

## Suggestion Shape

Autocomplete functions return arrays like:

```javascript
{
  label: 'Every Friday at 5 PM',
  input: 'Every Friday at 5 PM',
  value: { start: '2026-03-15T17:00:00', repeat: { ... } },
  score: 0.94,
  source: 'template',
  type: 'schedule'
}
```

For datetime suggestions, `value` looks like:

```javascript
{
  datetime: '2026-03-15T13:37:00',
  timestamp: 1773596220000
}
```

## `autocomplete`

Combined autocomplete across schedules and datetimes.

Options:

- `limit` default `10`
- `includeValue` default `true`
- `minScore` default `0.3`
- `referenceDate` for relative datetime resolution
- `excludePast` to suppress datetime results before `referenceDate`
- `allowRecurring` default `true`
- `allowOneTime` default `true`
- `category` for schedule-category filtering
- `defaultTime` for datetime fallback time
- `wheneverDays` for datetime `whenever` range

Examples:

```javascript
const suggestions = autocomplete('every day', { limit: 5 });
const suggestions2 = autocomplete('today', new Date('2026-03-15T13:37:00'), true, {
  limit: 10,
  includeValue: true
});
```

## `autocompleteSchedule`

Schedule-only autocomplete.

This uses the schedule autocomplete pipeline directly.

Examples:

```javascript
const schedules = autocompleteSchedule('every 2', { limit: 5, includeValue: true });
const monthly = autocompleteSchedule('', { limit: 10, category: 'Monthly' });
```

## `autocompleteDatetime`

Datetime-only autocomplete.

This is the renamed public version of the old datetime autocomplete API.

Supported top-level args:

```javascript
autocompleteDatetime(input, options?)
autocompleteDatetime(input, referenceDate, excludePast?, options?)
```

Datetime-specific options:

- `referenceDate`
- `excludePast`
- `defaultTime`
- `wheneverDays`
- `limit`
- `includeValue`
- `minScore`

Blank or `null` input returns the default datetime suggestions:

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

Examples:

```javascript
const defaults = autocompleteDatetime('', new Date('2026-03-15T13:37:00'), true, {
  limit: 10,
  includeValue: true
});

const today = autocompleteDatetime('today', new Date('2026-03-15T13:37:00'), true, {
  limit: 10,
  includeValue: true
});
```

## Resolver Functions

The resolver functions use the same autocomplete pipeline as their matching autocomplete function. That is the main contract: resolver values do not come from a separate parsing path.

### `resolveScheduleString`

Returns the exact schedule JSON that the schedule autocomplete pipeline would attach to the matching suggestion.

```javascript
const schedule = resolveScheduleString('every day at 9am');
```

### `resolveDatetimeString`

Returns the exact `{ datetime, timestamp }` value that the datetime autocomplete pipeline would attach to the matching suggestion.

```javascript
const value = resolveDatetimeString('Now', new Date('2026-03-15T13:37:00'), true);
```

### `resolveString`

Combined resolver across both schedule and datetime suggestions.

It returns the exact `value` from the combined autocomplete pipeline for the supplied input.

```javascript
const value1 = resolveString('Now', new Date('2026-03-15T13:37:00'), true);
const value2 = resolveString('every friday at 5pm');
```

Notes:

- Blank input returns `null` for resolver functions.
- If an exact normalized suggestion match is not present, the resolver falls back to the top autocomplete result for that input.

## `calcNextScheduledTime`

Calculate the next run time for a resolved schedule.

Parameters:

- `schedule`: schedule JSON returned by `resolveScheduleString` or schedule autocomplete
- `options.from`: calculate from this date, defaults to now
- `options.asTimestamp`: when `true`, return unix milliseconds instead of `Date`

Examples:

```javascript
const schedule = resolveScheduleString('every friday at 5pm');
const nextDate = calcNextScheduledTime(schedule, { from: new Date('2026-03-15T12:00:00') });
const nextTimestamp = calcNextScheduledTime(schedule, {
  from: new Date('2026-03-15T12:00:00'),
  asTimestamp: true
});
```

## Notes

- `referenceDate` can be a `Date`, ISO string, or unix milliseconds.
- `excludePast` only affects datetime resolution and datetime autocomplete.
- `Now` is still allowed when `excludePast` is `true`.
- The package no longer exposes the old category/template helper methods on the public entrypoint.

## Verification

Current test status in this repo:

- `npm test` passes
- `node test-datetime-autocomplete.js` passes
