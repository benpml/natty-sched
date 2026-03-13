const { getDateTimeSuggestions } = require('./index');
const { resolveDateTime } = require('./src/datetime-autocomplete');

const validCases = [
  'Now',
  'Next tuesday',
  'Two weeks from now on monday',
  'Two mondays from now',
  'Yesterday',
  'Two mondays ago',
  'The first of the month, 3 months from now',
  'The last day of the month',
  'Feb 14 at 8 AM',
  'March 5th 2028',
  '12/24/2024',
  'The first of march 2025',
  'Friday',
  'This friday',
  'Today',
  '5PM today',
  'Today at 5',
  'Yesterday at 6',
  'Early on Thursday',
  'Early morning Tuesday',
  'Late Tuesday',
  'Tuesday afternoon',
  'Friday night',
  '5AM on Wednesday',
  '5AM on December 15, 2025',
  'Whenever',
  'Next thu',
  'In one',
  'In one wee',
  'In one week',
  'A week from',
  'A week from now',
  'In 1',
  'In 1 day',
  'In 5 days',
  'In a month',
  'In a year',
  'At',
  'At 8',
  'At 8:00 AM T',
  'At 8 am today',
  'The friday after next',
  '5 thursda'
];

const emptyCases = [
  'today at 44',
  'Today at 8000',
  'Yesteryear'
];

let failures = 0;
const referenceDate = new Date('2026-02-27T12:00:00');

for (const input of validCases) {
  const suggestions = getDateTimeSuggestions(input, { limit: 10, includeValue: true, referenceDate });
  console.log(`\nInput: ${input}`);
  if (!suggestions.length) {
    failures += 1;
    console.log('  ❌ No suggestions');
    continue;
  }

  suggestions.forEach((s, idx) => {
    const valueOk = s.value && typeof s.value.datetime === 'string' && Number.isFinite(s.value.timestamp);
    if (!valueOk) failures += 1;
    console.log(`  ${idx + 1}. ${s.label} -> ${s.value.datetime}`);
  });
}

for (const input of emptyCases) {
  const suggestions = getDateTimeSuggestions(input, { limit: 10, includeValue: true, referenceDate });
  console.log(`\nInput: ${input}`);
  if (suggestions.length) {
    failures += 1;
    console.log('  ❌ Expected no suggestions');
    suggestions.forEach((s, idx) => console.log(`  ${idx + 1}. ${s.label}`));
  } else {
    console.log('  ✓ No suggestions');
  }
}

const holidayReferenceDate = new Date('2026-02-27T12:00:00');
const observedReferenceDate = new Date('2022-06-01T12:00:00');
const formatLocal = (d) => {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${da} ${hh}:${mm}`;
};

const expectLocal = (input, expectedLocal, options = {}) => {
  const actual = resolveDateTime(input, { referenceDate: options.referenceDate || holidayReferenceDate, observed: options.observed });
  console.log(`\nResolve: ${input}`);
  if (!actual) {
    failures += 1;
    console.log('  ❌ Did not resolve');
    return;
  }
  const actualLocal = formatLocal(actual);
  if (actualLocal !== expectedLocal) {
    failures += 1;
    console.log(`  ❌ Expected ${expectedLocal}`);
    console.log(`  Actual ${actualLocal}`);
    return;
  }
  console.log(`  ✓ ${actualLocal}`);
};

const expectSuggestion = (input, expected) => {
  const suggestions = getDateTimeSuggestions(input, { limit: 10, includeValue: true, referenceDate: holidayReferenceDate });
  const inputs = suggestions.map(s => s.input);
  console.log(`\nAutocomplete: ${input}`);
  if (!inputs.includes(expected)) {
    failures += 1;
    console.log(`  ❌ Missing ${expected}`);
    console.log(`  Actual ${JSON.stringify(inputs)}`);
    return;
  }
  console.log(`  ✓ Includes ${expected}`);
};

expectLocal('christmas', '2026-12-25 09:00');
expectLocal('on christmas', '2026-12-25 09:00');
expectLocal('this easter', '2026-04-05 09:00');
expectLocal('next easter', '2027-03-28 09:00');
expectLocal('labor day', '2026-09-07 09:00');
expectLocal('next week', '2026-03-06 09:00');
expectLocal("new year's day", '2023-01-02 09:00', { referenceDate: observedReferenceDate, observed: true });

expectSuggestion('on chri', 'on christmas');
expectSuggestion('this eas', 'this easter');
expectSuggestion('lab', 'labor day');
expectSuggestion('on labor d', 'on labor day');

if (failures > 0) {
  console.error(`\nFailed checks: ${failures}`);
  process.exit(1);
}

console.log('\nAll datetime autocomplete checks passed.');
