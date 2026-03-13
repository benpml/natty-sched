/**
 * Comprehensive validation test for unified autocomplete.
 * Validates both output text (labels) and output JSON structure
 * for every test case in test-cases.md.
 */

const fs = require('fs');
const { getSuggestions } = require('./src/unified-autocomplete');

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
  const results = getSuggestions(input, {
    mode: 'schedule', limit: 5, includeValue: true, referenceDate
  });
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
  const results = getSuggestions(input, {
    mode: 'datetime', limit: 5, includeValue: true, referenceDate
  });
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
  const r1 = getSuggestions(input, { limit: 5, includeValue: true, referenceDate });
  const r2 = getSuggestions(input, { limit: 5, includeValue: true, referenceDate });
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
