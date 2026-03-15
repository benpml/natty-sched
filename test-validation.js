/**
 * Comprehensive validation test for unified autocomplete.
 * Validates both output text (labels) and output JSON structure
 * for every test case in test-cases.md.
 */

const fs = require('fs');
const {
  autocomplete,
  autocompleteSchedule,
  autocompleteDatetime,
  resolveDatetimeString,
  resolveScheduleString,
  resolveString
} = require('./index');

const resolveDatetimeDate = (...args) => {
  const value = resolveDatetimeString(...args);
  return value ? new Date(value.timestamp) : null;
};

const referenceDate = new Date('2026-03-03T10:00:00');

// ---- Assertion helpers ----
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(message);
  }
}

// ---- Load test cases from test-cases.md ----
function loadTestCases(sectionHeader) {
  const md = fs.readFileSync('test-cases.md', 'utf8');
  const escaped = sectionHeader.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`## ${escaped}[\\s\\S]*?\n\`\`\`js\\s*\\n\\[([\\s\\S]*?)\\]\\s*\\n\`\`\``);
  const match = md.match(regex);
  if (!match) throw new Error(`Could not find section: "${sectionHeader}"`);
  const cases = [];
  for (const line of match[1].split('\n')) {
    const m = line.match(/"([^"]+)"/);
    if (m) cases.push(m[1]);
  }
  return cases;
}

const VALID_INTERVAL_UNITS = ['minute', 'hour', 'day', 'week', 'month', 'year'];

// ---- Schedule validation ----
function validateScheduleResults(input, results) {
  const prefix = `Schedule "${input}"`;

  assert(results.length > 0, `${prefix}: returns at least 1 result`);

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const rp = `${prefix} [${i}]`;

    // Type
    assert(r.type === 'schedule', `${rp}: type is "schedule" (got "${r.type}")`);

    // Label quality
    assert(typeof r.label === 'string' && r.label.length > 0, `${rp}: label is non-empty string`);
    assert(!/::\s*/.test(r.label), `${rp}: label has no double colons ("${r.label}")`);
    assert(!/:\s*$/.test(r.label.trim()), `${rp}: label has no trailing colon ("${r.label}")`);
    assert(!/\bEvery Weekdays\b/.test(r.label), `${rp}: label not "Every Weekdays" ("${r.label}")`);
    assert(!/\bat\s*$/i.test(r.label.trim()), `${rp}: label doesn't end with "at" ("${r.label}")`);

    // Score
    assert(typeof r.score === 'number' && r.score >= 0 && r.score <= 1,
      `${rp}: score in [0,1] (got ${r.score})`);

    // JSON value structure
    if (r.value) {
      // Start
      assert(typeof r.value.start === 'string', `${rp}: value.start is string`);
      const startYear = new Date(r.value.start).getFullYear();
      assert(startYear >= 2020, `${rp}: start year >= 2020 (got ${startYear}, start="${r.value.start}")`);

      // Repeat
      assert(r.value.repeat != null, `${rp}: value.repeat exists`);
      if (r.value.repeat) {
        // Interval
        assert(r.value.repeat.interval != null, `${rp}: repeat.interval exists`);
        if (r.value.repeat.interval) {
          assert(typeof r.value.repeat.interval.unit === 'string' &&
            VALID_INTERVAL_UNITS.includes(r.value.repeat.interval.unit),
            `${rp}: interval.unit is valid (got "${r.value.repeat.interval.unit}")`);
          assert(typeof r.value.repeat.interval.count === 'number' &&
            r.value.repeat.interval.count > 0,
            `${rp}: interval.count > 0 (got ${r.value.repeat.interval.count})`);
        }

        // At (time) - validate format when present
        if (r.value.repeat.at != null) {
          assert(typeof r.value.repeat.at === 'string' &&
            /^\d{2}:\d{2}$/.test(r.value.repeat.at),
            `${rp}: repeat.at is HH:MM format (got "${r.value.repeat.at}")`);
        }

        // On clause - validate structure when present
        if (r.value.repeat.on) {
          const on = r.value.repeat.on;
          const hasWeekdays = Array.isArray(on.weekdays);
          const hasMonthDays = Array.isArray(on.month_days);
          const hasYearDate = on.year_date != null;
          const hasWeekdayPos = on.weekday_position != null;
          assert(hasWeekdays || hasMonthDays || hasYearDate || hasWeekdayPos,
            `${rp}: on clause has valid structure`);

          if (hasWeekdays) {
            const validDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
            assert(on.weekdays.every(d => validDays.includes(d)),
              `${rp}: weekdays are valid (got ${JSON.stringify(on.weekdays)})`);
          }
          if (hasYearDate) {
            assert(typeof on.year_date.month === 'number' && on.year_date.month >= 1 && on.year_date.month <= 12,
              `${rp}: year_date.month valid (got ${on.year_date.month})`);
          }
        }
      }
    }
  }
}

// ---- Datetime validation ----
function validateDatetimeResults(input, results) {
  const prefix = `Datetime "${input}"`;

  assert(results.length > 0, `${prefix}: returns at least 1 result`);

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const rp = `${prefix} [${i}]`;

    // Type
    assert(r.type === 'datetime', `${rp}: type is "datetime" (got "${r.type}")`);

    // Label quality
    assert(typeof r.label === 'string' && r.label.length > 0, `${rp}: label is non-empty string`);

    // Score
    assert(typeof r.score === 'number' && r.score >= 0 && r.score <= 1,
      `${rp}: score in [0,1] (got ${r.score})`);

    // JSON value structure
    if (r.value) {
      assert(typeof r.value.datetime === 'string' && r.value.datetime.length > 0,
        `${rp}: value.datetime is non-empty string`);
      assert(typeof r.value.timestamp === 'number' && isFinite(r.value.timestamp),
        `${rp}: value.timestamp is finite number (got ${r.value.timestamp})`);
    }
  }
}

// ---- Run tests ----

console.log('=== Schedule Test Cases ===\n');
const scheduleCases = loadTestCases('Schedule test cases');
console.log(`Loaded ${scheduleCases.length} schedule test cases\n`);

let schedPass = 0, schedFail = 0;
for (const input of scheduleCases) {
  const beforeFailed = failed;
  const results = autocompleteSchedule(input, { limit: 5, includeValue: true, referenceDate });
  validateScheduleResults(input, results);
  if (failed > beforeFailed) {
    schedFail++;
  } else {
    schedPass++;
  }
}

console.log(`Schedule: ${schedPass}/${scheduleCases.length} inputs fully valid\n`);

console.log('=== Datetime Test Cases ===\n');
const datetimeCases = loadTestCases('Single Point in time test cases');
console.log(`Loaded ${datetimeCases.length} datetime test cases\n`);

let dtPass = 0, dtFail = 0;
for (const input of datetimeCases) {
  const beforeFailed = failed;
  const results = autocompleteDatetime(input, { limit: 5, includeValue: true, referenceDate });
  validateDatetimeResults(input, results);
  if (failed > beforeFailed) {
    dtFail++;
  } else {
    dtPass++;
  }
}

console.log(`Datetime: ${dtPass}/${datetimeCases.length} inputs fully valid\n`);

// ---- Determinism test ----
console.log('=== Determinism Test ===\n');
const deterministicInputs = [
  'every day at 9 am', 'weekdays at 8 am', 'monthly on the 1st at 9 am',
  'every friday at 5 pm', 'daily at noon', 'tomorrow', 'next tuesday',
  'in 30 minutes', 'friday at 3 pm', 'every other monday at 10 am',
  'at 5 pm on fridays', 'every month on the 15th at noon',
  'now', 'today at 9 am', 'next week', 'in 2 hours',
  'every 2 weeks on friday at 3 pm', 'yearly on march 1st at 9 am',
  'christmas', 'labor day'
];

let deterministicPass = true;
for (const input of deterministicInputs) {
  const r1 = autocomplete(input, { limit: 5, includeValue: true, referenceDate });
  const r2 = autocomplete(input, { limit: 5, includeValue: true, referenceDate });
  const s1 = JSON.stringify(r1);
  const s2 = JSON.stringify(r2);
  if (s1 !== s2) {
    deterministicPass = false;
    assert(false, `Determinism: "${input}" produces different results on 2nd run`);
  }
}
if (deterministicPass) {
  passed++;
  console.log(`Determinism: All ${deterministicInputs.length} inputs produce identical results\n`);
}

// ---- Targeted datetime regression checks ----
console.log('=== Datetime Regressions ===\n');

const issueReferenceDate = new Date('2026-03-15T13:37:00');

function datetimeInputs(input) {
  return autocomplete(input, {
    limit: 10,
    includeValue: true,
    referenceDate: issueReferenceDate
  }).map(r => r.input);
}

function assertIncludesSuggestion(input, expected) {
  const inputs = datetimeInputs(input);
  assert(inputs.includes(expected), `Datetime regression "${input}": includes "${expected}" (got ${JSON.stringify(inputs)})`);
}

function assertOmitsSuggestion(input, unexpected) {
  const inputs = datetimeInputs(input);
  assert(!inputs.includes(unexpected), `Datetime regression "${input}": omits "${unexpected}" (got ${JSON.stringify(inputs)})`);
}

function assertResolvedLocal(input, expectedLocal) {
  const resolved = resolveDatetimeDate(input, { referenceDate: issueReferenceDate });
  const actualLocal = resolved
    ? `${resolved.getFullYear()}-${String(resolved.getMonth() + 1).padStart(2, '0')}-${String(resolved.getDate()).padStart(2, '0')}T${String(resolved.getHours()).padStart(2, '0')}:${String(resolved.getMinutes()).padStart(2, '0')}:${String(resolved.getSeconds()).padStart(2, '0')}`
    : null;
  assert(actualLocal === expectedLocal, `Datetime regression "${input}": resolves to ${expectedLocal} (got ${actualLocal})`);
}

assertIncludesSuggestion('in 1 year', 'In 1 year at night');
assertIncludesSuggestion('2 weeks from now', '2 weeks from now in the morning');
assertIncludesSuggestion('in 2 days', 'In 2 days in the afternoon');
assertIncludesSuggestion('next month', 'Next month in the morning');
assertIncludesSuggestion('next year', 'Next year in the evening');
assertIncludesSuggestion('2 weeks from friday', '2 weeks from Friday at 3 PM');
assertIncludesSuggestion('today', 'This morning');
assertIncludesSuggestion('today', 'Tonight');
assert(datetimeInputs('early on thursday').length > 0,
  'Datetime regression "early on thursday": returns suggestions');
assert(datetimeInputs('early morning tuesday').length > 0,
  'Datetime regression "early morning tuesday": returns suggestions');
assert(datetimeInputs('late tuesday').length > 0,
  'Datetime regression "late tuesday": returns suggestions');
assert(datetimeInputs('5 thursda').length > 0,
  'Datetime regression "5 thursda": returns suggestions');

assertOmitsSuggestion('in 1 hour', 'In 1 hour night');
assertOmitsSuggestion('in 1 year', 'In 1 year night');
assertOmitsSuggestion('2 weeks from now', '2 weeks from now morning');
assertOmitsSuggestion('in 2 days', 'In 2 days afternoon');
assertOmitsSuggestion('next month', 'Next month morning');
assertOmitsSuggestion('next year', 'Next year evening');
assertOmitsSuggestion('today', 'Today morning');
assertOmitsSuggestion('today', 'Today night');
assertOmitsSuggestion('tonight', 'Tonight at 9 AM');
assertOmitsSuggestion('tonight', 'Tonight at 12 PM');
assertOmitsSuggestion('tonight', 'This morning');
assertOmitsSuggestion('tonight m', 'Tonight morning');
assertResolvedLocal('tonight', '2026-03-15T20:00:00');
assert(resolveDatetimeDate('tonight morning', { referenceDate: issueReferenceDate }) == null,
  'Datetime regression "tonight morning": resolves to null');
assert(resolveDatetimeDate('tonight at 9 am', { referenceDate: issueReferenceDate }) == null,
  'Datetime regression "tonight at 9 am": resolves to null');
assertResolvedLocal('tonight at 9 pm', '2026-03-15T21:00:00');
assert(resolveDatetimeDate('now', { referenceDate: issueReferenceDate, excludePast: true }) != null,
  'Datetime regression "now" with excludePast: resolves');
assert(resolveDatetimeDate('yesterday', { referenceDate: issueReferenceDate, excludePast: true }) == null,
  'Datetime regression "yesterday" with excludePast: resolves to null');

const topLevelToday = autocompleteDatetime('today', issueReferenceDate, true, {
  limit: 10,
  includeValue: false
}).map(r => r.input);
assert(topLevelToday.includes('Today'), `Datetime regression top-level args: includes "Today" (got ${JSON.stringify(topLevelToday)})`);
assert(!topLevelToday.includes('Today at 9 AM'), `Datetime regression top-level args: omits past "Today at 9 AM" (got ${JSON.stringify(topLevelToday)})`);

const blankDefaults = autocompleteDatetime('', issueReferenceDate, false, {
  limit: 10,
  includeValue: false
}).map(r => r.input);
assert(JSON.stringify(blankDefaults) === JSON.stringify([
  'Now',
  'In 1 hour',
  'Tomorrow morning',
  'Monday at 8 AM',
  'In 1 week',
  '1 month from now',
  'Next year',
  'Tonight',
  'Friday at 5 PM',
  'Christmas'
]), `Datetime regression blank defaults: exact order (got ${JSON.stringify(blankDefaults)})`);

const unifiedBlankDefaults = autocomplete('', issueReferenceDate, false, {
  limit: 10,
  includeValue: false
}).map(r => r.input);
assert(JSON.stringify(unifiedBlankDefaults) === JSON.stringify(blankDefaults),
  `Datetime regression unified blank defaults: match direct datetime defaults (got ${JSON.stringify(unifiedBlankDefaults)})`);

const filteredBlankDefaults = autocompleteDatetime('', new Date('2026-03-16T15:00:00'), true, {
  limit: 10,
  includeValue: true
});
assert(filteredBlankDefaults.length > 0, 'Datetime regression filtered blank defaults: returns suggestions');
assert(filteredBlankDefaults.every(r => r.value.timestamp >= new Date('2026-03-16T15:00:00').getTime()),
  `Datetime regression filtered blank defaults: all timestamps are >= referenceDate (got ${JSON.stringify(filteredBlankDefaults.map(r => r.input))})`);
assert(filteredBlankDefaults.some(r => r.input === 'Now'),
  `Datetime regression filtered blank defaults: includes "Now" (got ${JSON.stringify(filteredBlankDefaults.map(r => r.input))})`);
assert(filteredBlankDefaults.every(r => r.input !== 'Monday at 8 AM'),
  `Datetime regression filtered blank defaults: omits past "Monday at 8 AM" (got ${JSON.stringify(filteredBlankDefaults.map(r => r.input))})`);

const blankDefaultsAlias = autocompleteDatetime('', issueReferenceDate, false, {
  limit: 10,
  includeValue: false
}).map(r => r.input);
assert(JSON.stringify(blankDefaultsAlias) === JSON.stringify(blankDefaults),
  `Datetime regression autocompleteDatetime alias: matches autocompleteDatetime (got ${JSON.stringify(blankDefaultsAlias)})`);

const nowAutocompleteValue = autocompleteDatetime('Now', issueReferenceDate, true, {
  limit: 50,
  includeValue: true
}).find(r => r.input === 'Now')?.value;
const nowResolvedString = resolveDatetimeString('Now', issueReferenceDate, true);
assert(JSON.stringify(nowResolvedString) === JSON.stringify(nowAutocompleteValue),
  `Datetime regression resolveDatetimeString: matches autocomplete value for "Now" (got ${JSON.stringify(nowResolvedString)})`);
const ordinalAutocompleteValue = autocompleteDatetime('March 5th 2028', issueReferenceDate, false, {
  limit: 50,
  includeValue: true
})[0]?.value;
const ordinalResolvedString = resolveDatetimeString('March 5th 2028', issueReferenceDate, false);
assert(JSON.stringify(ordinalResolvedString) === JSON.stringify(ordinalAutocompleteValue),
  `Datetime regression resolveDatetimeString canonicalized input: matches top autocomplete value (got ${JSON.stringify(ordinalResolvedString)})`);
assert(resolveDatetimeString('tonight at 9 am', issueReferenceDate, false) == null,
  'Datetime regression resolveDatetimeString invalid phrase: returns null');

const scheduleAutocompleteValue = autocompleteSchedule('every day at 9am', {
  limit: 50,
  includeValue: true,
  referenceDate: issueReferenceDate
}).find(r => r.input.toLowerCase() === 'every day at 9am')?.value;
const scheduleResolvedString = resolveScheduleString('every day at 9am', {
  referenceDate: issueReferenceDate
});
assert(JSON.stringify(scheduleResolvedString) === JSON.stringify(scheduleAutocompleteValue),
  `Schedule regression resolveScheduleString: matches autocomplete value (got ${JSON.stringify(scheduleResolvedString)})`);
assert(resolveScheduleString('now', { referenceDate: issueReferenceDate }) == null,
  'Schedule regression resolveScheduleString invalid schedule phrase: returns null');

const combinedNowAutocompleteValue = autocomplete('Now', issueReferenceDate, true, {
  limit: 50,
  includeValue: true
}).find(r => r.input === 'Now')?.value;
const combinedNowResolved = resolveString('Now', issueReferenceDate, true);
assert(JSON.stringify(combinedNowResolved) === JSON.stringify(combinedNowAutocompleteValue),
  `Combined regression resolveString datetime: matches autocomplete value (got ${JSON.stringify(combinedNowResolved)})`);

const combinedScheduleAutocompleteValue = autocomplete('every day at 9am', {
  limit: 50,
  includeValue: true,
  referenceDate: issueReferenceDate
}).find(r => r.type === 'schedule' && r.input.toLowerCase() === 'every day at 9am')?.value;
const combinedScheduleResolved = resolveString('every day at 9am', { referenceDate: issueReferenceDate });
assert(JSON.stringify(combinedScheduleResolved) === JSON.stringify(combinedScheduleAutocompleteValue),
  `Combined regression resolveString schedule: matches autocomplete value (got ${JSON.stringify(combinedScheduleResolved)})`);

assertResolvedLocal('christmas', '2026-12-25T13:37:00');
assertResolvedLocal('next month', '2026-04-15T13:37:00');
assertResolvedLocal('next year', '2027-03-15T13:37:00');
assertResolvedLocal('in 2 days', '2026-03-17T13:37:00');
assertResolvedLocal('2 weeks from now', '2026-03-29T13:37:00');

// ---- Summary ----
console.log('=== Summary ===\n');
console.log(`Total assertions: ${passed + failed}`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);

if (failures.length > 0) {
  console.log(`\nFailure details (${failures.length}):`);
  // Group failures by input
  const byInput = {};
  for (const f of failures) {
    const inputMatch = f.match(/"([^"]+)"/);
    const key = inputMatch ? inputMatch[1] : 'other';
    if (!byInput[key]) byInput[key] = [];
    byInput[key].push(f);
  }
  const inputKeys = Object.keys(byInput);
  for (const key of inputKeys.slice(0, 50)) {
    console.log(`\n  "${key}":`);
    for (const f of byInput[key]) {
      console.log(`    ✗ ${f}`);
    }
  }
  if (inputKeys.length > 50) {
    console.log(`\n  ... and ${inputKeys.length - 50} more failing inputs`);
  }
}

process.exit(failed > 0 ? 1 : 0);
