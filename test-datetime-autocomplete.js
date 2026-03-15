const { autocompleteDatetime, autocomplete, resolveDatetimeString } = require('./index');

const resolveDatetimeDate = (...args) => {
  const value = resolveDatetimeString(...args);
  return value ? new Date(value.timestamp) : null;
};

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
const referenceDate = new Date('2026-02-27T12:34:00');

for (const input of validCases) {
  const suggestions = autocompleteDatetime(input, { limit: 10, includeValue: true, referenceDate });
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
  const suggestions = autocompleteDatetime(input, { limit: 10, includeValue: true, referenceDate });
  console.log(`\nInput: ${input}`);
  if (suggestions.length) {
    failures += 1;
    console.log('  ❌ Expected no suggestions');
    suggestions.forEach((s, idx) => console.log(`  ${idx + 1}. ${s.label}`));
  } else {
    console.log('  ✓ No suggestions');
  }
}

const holidayReferenceDate = new Date('2026-02-27T12:34:00');
const observedReferenceDate = new Date('2022-06-01T12:34:00');
const formatLocal = (d) => {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${da} ${hh}:${mm}`;
};

const expectLocal = (input, expectedLocal, options = {}) => {
  const actual = resolveDatetimeDate(input, { referenceDate: options.referenceDate || holidayReferenceDate, observed: options.observed });
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
  const suggestions = autocompleteDatetime(input, { limit: 10, includeValue: true, referenceDate: holidayReferenceDate });
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

const expectNoSuggestion = (input, unexpected) => {
  const suggestions = autocompleteDatetime(input, { limit: 20, includeValue: true, referenceDate: holidayReferenceDate });
  const inputs = suggestions.map(s => s.input);
  console.log(`\nAutocomplete: ${input}`);
  if (inputs.includes(unexpected)) {
    failures += 1;
    console.log(`  ❌ Should not include ${unexpected}`);
    console.log(`  Actual ${JSON.stringify(inputs)}`);
    return;
  }
  console.log(`  ✓ Omits ${unexpected}`);
};

const expectExactInputs = (description, actual, expected) => {
  console.log(`\n${description}`);
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (!same) {
    failures += 1;
    console.log(`  ❌ Expected ${JSON.stringify(expected)}`);
    console.log(`  Actual ${JSON.stringify(actual)}`);
    return;
  }
  console.log(`  ✓ ${JSON.stringify(actual)}`);
};

expectLocal('christmas', '2026-12-25 12:34');
expectLocal('on christmas', '2026-12-25 12:34');
expectLocal('this easter', '2026-04-05 12:34');
expectLocal('next easter', '2027-03-28 12:34');
expectLocal('labor day', '2026-09-07 12:34');
expectLocal('next week', '2026-03-06 12:34');
expectLocal("new year's day", '2023-01-02 12:34', { referenceDate: observedReferenceDate, observed: true });

expectSuggestion('on chri', 'On Christmas');
expectSuggestion('this eas', 'This Easter');
expectSuggestion('lab', 'Labor Day');
expectSuggestion('on labor d', 'On Labor Day');
expectSuggestion('in 1 year', 'In 1 year at night');
expectSuggestion('2 weeks from now', '2 weeks from now in the morning');
expectSuggestion('in 2 days', 'In 2 days in the afternoon');
expectSuggestion('next month', 'Next month in the morning');
expectSuggestion('next year', 'Next year in the evening');
expectSuggestion('2 weeks from friday', '2 weeks from Friday at 3 PM');
expectNoSuggestion('in 1 hour', 'In 1 hour night');
expectNoSuggestion('in 1 year', 'In 1 year night');
expectNoSuggestion('2 weeks from now', '2 weeks from now morning');
expectNoSuggestion('in 2 days', 'In 2 days afternoon');
expectNoSuggestion('next month', 'Next month morning');
expectNoSuggestion('next year', 'Next year evening');
expectNoSuggestion('tonight', 'Tonight at 9 AM');
expectNoSuggestion('tonight', 'Tonight at 12 PM');
expectNoSuggestion('tonight', 'This morning');

console.log('\nResolve: tonight');
const tonightResolved = resolveDatetimeDate('tonight', { referenceDate: holidayReferenceDate });
if (!tonightResolved || formatLocal(tonightResolved) !== '2026-02-27 20:00') {
  failures += 1;
  console.log(`  ❌ Expected 2026-02-27 20:00`);
  console.log(`  Actual ${tonightResolved ? formatLocal(tonightResolved) : 'null'}`);
} else {
  console.log('  ✓ 2026-02-27 20:00');
}

console.log('\nResolve: tonight morning');
if (resolveDatetimeDate('tonight morning', { referenceDate: holidayReferenceDate }) !== null) {
  failures += 1;
  console.log('  ❌ Expected null');
} else {
  console.log('  ✓ null');
}

console.log('\nResolve: tonight at 9 am');
if (resolveDatetimeDate('tonight at 9 am', { referenceDate: holidayReferenceDate }) !== null) {
  failures += 1;
  console.log('  ❌ Expected null');
} else {
  console.log('  ✓ null');
}

expectLocal('tonight at 9 pm', '2026-02-27 21:00');

const blankDefaults = autocompleteDatetime('', holidayReferenceDate, false, {
  limit: 10,
  includeValue: false
}).map(s => s.input);
expectExactInputs('Blank defaults', blankDefaults, [
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
]);

const topLevelFiltered = autocompleteDatetime('today', holidayReferenceDate, true, {
  limit: 10,
  includeValue: false
}).map(s => s.input);
console.log('\nTop-level args: autocompleteDatetime');
if (topLevelFiltered.includes('Today at 9 AM') || !topLevelFiltered.includes('Today')) {
  failures += 1;
  console.log(`  ❌ Unexpected top-level filtering result ${JSON.stringify(topLevelFiltered)}`);
} else {
  console.log(`  ✓ ${JSON.stringify(topLevelFiltered)}`);
}

console.log('\nResolve: now with excludePast');
const nowResolved = resolveDatetimeDate('now', { referenceDate: holidayReferenceDate, excludePast: true });
if (!nowResolved || formatLocal(nowResolved) !== '2026-02-27 12:34') {
  failures += 1;
  console.log(`  ❌ Expected 2026-02-27 12:34`);
  console.log(`  Actual ${nowResolved ? formatLocal(nowResolved) : 'null'}`);
} else {
  console.log('  ✓ 2026-02-27 12:34');
}

console.log('\nResolve: yesterday with excludePast');
if (resolveDatetimeDate('yesterday', { referenceDate: holidayReferenceDate, excludePast: true }) !== null) {
  failures += 1;
  console.log('  ❌ Expected null');
} else {
  console.log('  ✓ null');
}

const blankFiltered = autocompleteDatetime('', new Date('2026-03-16T15:00:00'), true, {
  limit: 10,
  includeValue: true
});
console.log('\nBlank defaults with excludePast');
const blankFilteredInputs = blankFiltered.map(s => s.input);
const blankFilteredPast = blankFiltered.some(s => s.value.timestamp < new Date('2026-03-16T15:00:00').getTime());
if (blankFilteredPast || !blankFilteredInputs.includes('Now') || blankFilteredInputs.includes('Monday at 8 AM')) {
  failures += 1;
  console.log(`  ❌ Unexpected filtered defaults ${JSON.stringify(blankFilteredInputs)}`);
} else {
  console.log(`  ✓ ${JSON.stringify(blankFilteredInputs)}`);
}

const unifiedBlankDefaults = autocomplete('', holidayReferenceDate, false, {
  limit: 10,
  includeValue: false
}).map(s => s.input);
expectExactInputs('Blank defaults via autocomplete', unifiedBlankDefaults, [
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
]);

const blankDefaultsAlias = autocompleteDatetime('', holidayReferenceDate, false, {
  limit: 10,
  includeValue: false
}).map(s => s.input);
expectExactInputs('Blank defaults via autocompleteDatetime', blankDefaultsAlias, [
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
]);

console.log('\nResolveDatetimeString: Now');
const nowSuggestionValue = autocompleteDatetime('Now', holidayReferenceDate, true, {
  limit: 50,
  includeValue: true
}).find(s => s.input === 'Now')?.value;
const nowResolvedValue = resolveDatetimeString('Now', holidayReferenceDate, true);
if (JSON.stringify(nowResolvedValue) !== JSON.stringify(nowSuggestionValue)) {
  failures += 1;
  console.log(`  ❌ Expected ${JSON.stringify(nowSuggestionValue)}`);
  console.log(`  Actual ${JSON.stringify(nowResolvedValue)}`);
} else {
  console.log(`  ✓ ${JSON.stringify(nowResolvedValue)}`);
}

console.log('\nResolveDatetimeString: March 5th 2028');
const marchSuggestionValue = autocompleteDatetime('March 5th 2028', holidayReferenceDate, false, {
  limit: 50,
  includeValue: true
})[0]?.value;
const marchResolvedValue = resolveDatetimeString('March 5th 2028', holidayReferenceDate, false);
if (JSON.stringify(marchResolvedValue) !== JSON.stringify(marchSuggestionValue)) {
  failures += 1;
  console.log(`  ❌ Expected ${JSON.stringify(marchSuggestionValue)}`);
  console.log(`  Actual ${JSON.stringify(marchResolvedValue)}`);
} else {
  console.log(`  ✓ ${JSON.stringify(marchResolvedValue)}`);
}

console.log('\nResolveDatetimeString: invalid tonight at 9 am');
if (resolveDatetimeString('tonight at 9 am', holidayReferenceDate, false) !== null) {
  failures += 1;
  console.log('  ❌ Expected null');
} else {
  console.log('  ✓ null');
}

if (failures > 0) {
  console.error(`\nFailed checks: ${failures}`);
  process.exit(1);
}

console.log('\nAll datetime autocomplete checks passed.');
