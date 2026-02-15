const { getSuggestions } = require('./index.js');

const tests = [
  // Time-first patterns
  { input: 'today at', scenario: 'Today at' },
  { input: 'today at 9', scenario: 'Today at 9' },
  { input: 'today at 5pm', scenario: 'Today at 5pm' },

  // Relative time patterns
  { input: 'in a week', scenario: 'In a week' },
  { input: 'in a week from', scenario: 'In a week from' },
  { input: 'in 5 days', scenario: 'In 5 days' },
  { input: 'in 5 days at', scenario: 'In 5 days at' },
  { input: 'in an hour', scenario: 'In an hour' },
  { input: 'in 2 hours', scenario: 'In 2 hours' },

  // Specific day with time
  { input: 'next tuesday', scenario: 'Next tuesday' },
  { input: 'next tuesday at', scenario: 'Next tuesday at' },
  { input: 'next tuesday at 3', scenario: 'Next tuesday at 3' },
  { input: 'next tuesday at 3pm', scenario: 'Next tuesday at 3pm' },

  // Complex relative patterns
  { input: 'two fridays from', scenario: 'Two fridays from' },
  { input: 'two fridays from now', scenario: 'Two fridays from now' },
  { input: '3 weeks from', scenario: '3 weeks from' },
  { input: '3 weeks from now', scenario: '3 weeks from now' },

  // Every other patterns
  { input: 'every other day', scenario: 'Every other day' },
  { input: 'every other day at', scenario: 'Every other day at' },
  { input: 'every other week', scenario: 'Every other week' },
  { input: 'every other monday', scenario: 'Every other monday' },

  // Specific time patterns
  { input: 'at 5pm', scenario: 'At 5pm' },
  { input: 'at 5pm on', scenario: 'At 5pm on' },
  { input: 'at 5pm on fridays', scenario: 'At 5pm on fridays' },
  { input: 'at noon', scenario: 'At noon' },
  { input: 'at midnight', scenario: 'At midnight' },

  // Business language patterns
  { input: 'at the end of', scenario: 'At the end of' },
  { input: 'at the end of each', scenario: 'At the end of each' },
  { input: 'at the end of each quarter', scenario: 'At the end of each quarter' },
  { input: 'at the beginning of', scenario: 'At the beginning of' },
  { input: 'at the beginning of each', scenario: 'At the beginning of each' },
  { input: 'at the beginning of each month', scenario: 'At the beginning of each month' },
  { input: 'at the beginning of each weekday', scenario: 'At the beginning of each weekday' },

  // Start of/end of patterns
  { input: 'start of', scenario: 'Start of' },
  { input: 'start of the week', scenario: 'Start of the week' },
  { input: 'end of', scenario: 'End of' },
  { input: 'end of the month', scenario: 'End of the month' },
  { input: 'end of the year', scenario: 'End of the year' },

  // Mixed patterns
  { input: 'on fridays', scenario: 'On fridays' },
  { input: 'on fridays at', scenario: 'On fridays at' },
  { input: 'on fridays at 5', scenario: 'On fridays at 5' },
  { input: 'on the 15th', scenario: 'On the 15th' },
  { input: 'on the 15th at', scenario: 'On the 15th at' },
  { input: 'on the last day', scenario: 'On the last day' },
  { input: 'on the first', scenario: 'On the first' },
  { input: 'on the first monday', scenario: 'On the first monday' },

  // Ordinal patterns
  { input: '1st', scenario: '1st' },
  { input: '1st of', scenario: '1st of' },
  { input: '1st of each', scenario: '1st of each' },
  { input: '1st of each month', scenario: '1st of each month' },
  { input: '15th of', scenario: '15th of' },

  // Common casual patterns
  { input: 'once a', scenario: 'Once a' },
  { input: 'once a week', scenario: 'Once a week' },
  { input: 'once a month', scenario: 'Once a month' },
  { input: 'once a day', scenario: 'Once a day' },
  { input: 'twice a', scenario: 'Twice a' },
  { input: 'twice a week', scenario: 'Twice a week' },

  // Edge cases with numbers
  { input: 'every 5', scenario: 'Every 5' },
  { input: 'every 30 minutes', scenario: 'Every 30 minutes' },
  { input: 'every 30 minutes at', scenario: 'Every 30 minutes at' },
  { input: 'every hour', scenario: 'Every hour' },
  { input: 'every hour at', scenario: 'Every hour at' },

  // Weekend/weekday variations
  { input: 'on weekends', scenario: 'On weekends' },
  { input: 'on weekends at', scenario: 'On weekends at' },
  { input: 'every weekend', scenario: 'Every weekend' },
  { input: 'every weekday', scenario: 'Every weekday' },
];

console.log('='.repeat(80));
console.log('EXTENDED AUTOCOMPLETE TESTING - Real-world Scenarios');
console.log('='.repeat(80));

let issueCount = 0;
const issues = [];

tests.forEach(test => {
  console.log(`\n📝 Input: "${test.input}" (${test.scenario})`);
  console.log('-'.repeat(80));

  const results = getSuggestions(test.input, { limit: 5, includeValue: false });

  if (results.length === 0) {
    console.log('❌ NO RESULTS');
    issueCount++;
    issues.push({type: 'no_results', input: test.input, scenario: test.scenario});
  } else {
    results.forEach((r, i) => {
      const score = (r.score * 100).toFixed(0);
      console.log(`  ${i + 1}. [${score}%] ${r.label}`);
    });

    // Check prefix matching
    const normalized = test.input.toLowerCase().trim();
    const allStartWithInput = results.every(r =>
      r.label.toLowerCase().startsWith(normalized)
    );

    if (!allStartWithInput && test.input.length > 2) {
      console.log('⚠️  WARNING: Some results don\'t start with input');
      issueCount++;
      issues.push({
        type: 'prefix_violation',
        input: test.input,
        scenario: test.scenario,
        examples: results.filter(r => !r.label.toLowerCase().startsWith(normalized)).map(r => r.label).slice(0, 2)
      });
    }

    // Check for double 'at' or other obvious issues
    const hasDoubleAt = results.some(r => /\sat\s+at\s/.test(r.label));
    if (hasDoubleAt) {
      console.log('⚠️  WARNING: Results contain "at at"');
      issueCount++;
      issues.push({
        type: 'double_at',
        input: test.input,
        scenario: test.scenario,
        examples: results.filter(r => /\sat\s+at\s/.test(r.label)).map(r => r.label).slice(0, 2)
      });
    }

    // Check for incomplete or nonsensical results
    const hasIncomplete = results.some(r =>
      r.label.toLowerCase().includes(' at at') ||
      r.label.toLowerCase().includes(' on on') ||
      r.label.toLowerCase().includes(' the the') ||
      r.label.trim().endsWith(' at') ||
      r.label.trim().endsWith(' on') ||
      r.label.trim().endsWith(' the')
    );
    if (hasIncomplete) {
      console.log('⚠️  WARNING: Results contain incomplete/duplicate words');
      issueCount++;
      issues.push({
        type: 'incomplete',
        input: test.input,
        scenario: test.scenario,
        examples: results.filter(r =>
          r.label.toLowerCase().includes(' at at') ||
          r.label.toLowerCase().includes(' on on') ||
          r.label.trim().endsWith(' at') ||
          r.label.trim().endsWith(' on')
        ).map(r => r.label).slice(0, 2)
      });
    }
  }
});

console.log('\n\n');
console.log('='.repeat(80));
console.log('ISSUE SUMMARY');
console.log('='.repeat(80));
console.log(`Total issues found: ${issueCount}`);

if (issues.length > 0) {
  console.log('\n🔴 Issues by type:\n');

  const noResults = issues.filter(i => i.type === 'no_results');
  if (noResults.length > 0) {
    console.log(`❌ NO RESULTS (${noResults.length} cases):`);
    noResults.forEach(i => console.log(`   - "${i.input}" (${i.scenario})`));
    console.log('');
  }

  const prefixViolations = issues.filter(i => i.type === 'prefix_violation');
  if (prefixViolations.length > 0) {
    console.log(`⚠️  PREFIX VIOLATIONS (${prefixViolations.length} cases):`);
    prefixViolations.forEach(i => {
      console.log(`   - "${i.input}" (${i.scenario})`);
      if (i.examples) i.examples.forEach(ex => console.log(`     → "${ex}"`));
    });
    console.log('');
  }

  const doubleAts = issues.filter(i => i.type === 'double_at');
  if (doubleAts.length > 0) {
    console.log(`⚠️  DOUBLE "AT" (${doubleAts.length} cases):`);
    doubleAts.forEach(i => {
      console.log(`   - "${i.input}" (${i.scenario})`);
      if (i.examples) i.examples.forEach(ex => console.log(`     → "${ex}"`));
    });
    console.log('');
  }

  const incompletes = issues.filter(i => i.type === 'incomplete');
  if (incompletes.length > 0) {
    console.log(`⚠️  INCOMPLETE/DUPLICATE WORDS (${incompletes.length} cases):`);
    incompletes.forEach(i => {
      console.log(`   - "${i.input}" (${i.scenario})`);
      if (i.examples) i.examples.forEach(ex => console.log(`     → "${ex}"`));
    });
    console.log('');
  }
}
