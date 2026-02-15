const { getSuggestions } = require('./index.js');

// Helper to analyze result quality
function analyzeResults(input, results) {
  const issues = [];

  // Check for duplicates or near-duplicates
  const labels = results.map(r => r.label.toLowerCase());
  const uniqueLabels = new Set(labels);
  if (labels.length !== uniqueLabels.size) {
    issues.push('❌ Contains duplicate suggestions');
  }

  // Check if results are sorted by score
  for (let i = 0; i < results.length - 1; i++) {
    if (results[i].score < results[i+1].score) {
      issues.push('❌ Results not properly sorted by score');
      break;
    }
  }

  // Check for incomplete results
  const incomplete = results.filter(r =>
    r.label.trim().endsWith(' at') ||
    r.label.trim().endsWith(' on') ||
    r.label.trim().endsWith(' the') ||
    r.label.trim().endsWith(' every') ||
    r.label.trim().endsWith(' and') ||
    r.label.includes(' at at ') ||
    r.label.includes(' on on ')
  );
  if (incomplete.length > 0) {
    issues.push(`❌ ${incomplete.length} incomplete/malformed results`);
  }

  // Check score distribution - should have variety, not all same score
  const scores = results.map(r => Math.round(r.score * 100));
  const uniqueScores = new Set(scores);
  if (uniqueScores.size === 1 && results.length > 1) {
    issues.push('⚠️  All results have identical scores');
  }

  // Check if top result is reasonable
  if (results.length > 0) {
    const top = results[0];
    if (top.score < 0.5) {
      issues.push('⚠️  Top result has low confidence score');
    }
  }

  return issues;
}

const tests = [
  // Progressive typing - should get BETTER as we type more
  { input: 'e', scenario: 'Very short - should return popular', expectPopular: true },
  { input: 'ev', scenario: 'Getting specific - "every" patterns' },
  { input: 'every', scenario: 'Complete word - should prefer "every" patterns' },
  { input: 'every d', scenario: 'Narrowing down - "every d*"' },
  { input: 'every day', scenario: 'Clear intent - daily patterns' },
  { input: 'every day at', scenario: 'Expect time completion' },
  { input: 'every day at 9', scenario: 'Specific time - should complete with AM/PM' },
  { input: 'every day at 9am', scenario: 'Complete pattern' },

  // Different phrasings of same thing
  { input: 'daily', scenario: 'Alternative to "every day"' },
  { input: 'each day', scenario: 'Alternative phrasing' },
  { input: 'every single day', scenario: 'Emphasis version' },
  { input: 'all days', scenario: 'Another alternative' },

  // Case sensitivity
  { input: 'EVERY DAY', scenario: 'All caps' },
  { input: 'Every Day', scenario: 'Title case' },
  { input: 'eVeRy DaY', scenario: 'Mixed case' },

  // Natural language variations
  { input: 'each monday', scenario: 'Each vs every' },
  { input: 'all mondays', scenario: 'All vs every' },
  { input: 'every mon', scenario: 'Abbreviated day' },
  { input: 'every monday and', scenario: 'Adding another day' },
  { input: 'every monday and wed', scenario: 'Abbreviated second day' },
  { input: 'monday wednesday', scenario: 'No "and"' },
  { input: 'monday/wednesday', scenario: 'Slash separator' },
  { input: 'monday + wednesday', scenario: 'Plus separator' },

  // Time variations
  { input: '9am', scenario: 'Just a time' },
  { input: '9:00', scenario: 'Time without AM/PM' },
  { input: '09:00', scenario: 'Leading zero' },
  { input: 'morning', scenario: 'Time of day word' },
  { input: 'in the morning', scenario: 'Time phrase' },
  { input: 'early morning', scenario: 'Qualified time' },

  // Incomplete but should still help
  { input: 'week', scenario: 'Just "week"' },
  { input: 'month', scenario: 'Just "month"' },
  { input: 'year', scenario: 'Just "year"' },
  { input: 'day', scenario: 'Just "day"' },

  // Common mistakes/variations
  { input: 'every weeks', scenario: 'Pluralization error' },
  { input: 'every 1 day', scenario: '"1" instead of omitting' },
  { input: 'every 1 week', scenario: '"1" instead of omitting' },
  { input: 'once per day', scenario: '"per" instead of "a"' },
  { input: 'one time per week', scenario: 'Verbose phrasing' },

  // Ambiguous inputs
  { input: 'weekly', scenario: 'Weekly - could mean many things' },
  { input: 'monthly', scenario: 'Monthly - needs more specificity' },
  { input: 'yearly', scenario: 'Yearly - very ambiguous' },
  { input: 'hourly', scenario: 'Hourly' },

  // Complex patterns
  { input: 'first and third', scenario: 'Multiple ordinals' },
  { input: 'first and last', scenario: 'First and last' },
  { input: 'every 2 weeks on monday and wednesday', scenario: 'Complex biweekly' },
  { input: 'last friday of every month', scenario: 'Last weekday of month' },

  // Real user scenarios
  { input: 'standup', scenario: 'User types meeting name' },
  { input: 'team meeting', scenario: 'Meeting context' },
  { input: 'reminder', scenario: 'Task context' },

  // Numbers and dates
  { input: 'the 1st', scenario: 'Ordinal with article' },
  { input: 'day 1', scenario: 'Day number' },
  { input: 'january', scenario: 'Month name' },
  { input: 'jan', scenario: 'Abbreviated month' },
  { input: 'january 15', scenario: 'Specific date' },

  // Progressive refinement for complex pattern
  { input: 'first monday of', scenario: 'Building complex pattern 1' },
  { input: 'first monday of the', scenario: 'Building complex pattern 2' },
  { input: 'first monday of the month', scenario: 'Building complex pattern 3' },
  { input: 'first monday of the month at', scenario: 'Building complex pattern 4' },
  { input: 'first monday of the month at 2', scenario: 'Building complex pattern 5' },

  // Very specific patterns
  { input: 'last day of february', scenario: 'Leap day handling' },
  { input: 'every leap year', scenario: 'Leap year pattern' },
  { input: 'last business day', scenario: 'Last business day' },
  { input: 'first business day', scenario: 'First business day' },
];

console.log('='.repeat(90));
console.log('UX & QUALITY TESTING - User Experience Analysis');
console.log('='.repeat(90));

let totalIssues = 0;
const issuesByType = {
  noResults: [],
  lowQuality: [],
  poorUx: [],
  incomplete: [],
  unsorted: [],
  duplicates: [],
  other: []
};

tests.forEach(test => {
  console.log(`\n📝 "${test.input}" (${test.scenario})`);
  console.log('-'.repeat(90));

  const results = getSuggestions(test.input, { limit: 10, includeValue: false });

  if (results.length === 0) {
    console.log('❌ NO RESULTS');
    totalIssues++;
    issuesByType.noResults.push(test);
  } else {
    // Show top 5 results with more detail
    const displayCount = Math.min(5, results.length);
    results.slice(0, displayCount).forEach((r, i) => {
      const score = (r.score * 100).toFixed(0);
      const prefix = r.label.toLowerCase().startsWith(test.input.toLowerCase()) ? '✓' : '✗';
      console.log(`  ${i + 1}. [${score}%] ${prefix} ${r.label}`);
    });

    if (results.length > displayCount) {
      console.log(`  ... and ${results.length - displayCount} more`);
    }

    // Analyze quality
    const qualityIssues = analyzeResults(test.input, results);
    if (qualityIssues.length > 0) {
      totalIssues += qualityIssues.length;
      qualityIssues.forEach(issue => {
        console.log(`  ${issue}`);
        if (issue.includes('duplicate')) issuesByType.duplicates.push({...test, issue});
        else if (issue.includes('incomplete')) issuesByType.incomplete.push({...test, issue});
        else if (issue.includes('sorted')) issuesByType.unsorted.push({...test, issue});
        else issuesByType.other.push({...test, issue});
      });
    }

    // Check if results actually help the user
    if (test.expectPopular) {
      // For very short inputs, should return popular suggestions
      if (results[0].score < 0.8) {
        console.log('  ⚠️  Expected popular suggestions for short input');
        totalIssues++;
        issuesByType.poorUx.push({...test, issue: 'Low-quality suggestions for short input'});
      }
    }

    // Check prefix matching
    const normalized = test.input.toLowerCase().trim();
    const nonMatching = results.filter(r => !r.label.toLowerCase().startsWith(normalized));
    if (nonMatching.length > 0 && test.input.length > 2) {
      console.log(`  ⚠️  ${nonMatching.length}/${results.length} results don't start with input`);
      totalIssues++;
      issuesByType.poorUx.push({...test, issue: `${nonMatching.length} prefix violations`});
    }
  }
});

// Summary
console.log('\n\n');
console.log('='.repeat(90));
console.log('ISSUE SUMMARY BY TYPE');
console.log('='.repeat(90));
console.log(`\nTotal issues found: ${totalIssues}\n`);

if (issuesByType.noResults.length > 0) {
  console.log(`\n❌ NO RESULTS (${issuesByType.noResults.length} cases):`);
  issuesByType.noResults.slice(0, 10).forEach(t =>
    console.log(`   • "${t.input}" - ${t.scenario}`)
  );
  if (issuesByType.noResults.length > 10) {
    console.log(`   ... and ${issuesByType.noResults.length - 10} more`);
  }
}

if (issuesByType.incomplete.length > 0) {
  console.log(`\n❌ INCOMPLETE/MALFORMED (${issuesByType.incomplete.length} cases):`);
  issuesByType.incomplete.slice(0, 5).forEach(t =>
    console.log(`   • "${t.input}" - ${t.scenario}`)
  );
}

if (issuesByType.duplicates.length > 0) {
  console.log(`\n❌ DUPLICATES (${issuesByType.duplicates.length} cases):`);
  issuesByType.duplicates.slice(0, 5).forEach(t =>
    console.log(`   • "${t.input}" - ${t.scenario}`)
  );
}

if (issuesByType.poorUx.length > 0) {
  console.log(`\n⚠️  POOR UX (${issuesByType.poorUx.length} cases):`);
  issuesByType.poorUx.slice(0, 10).forEach(t =>
    console.log(`   • "${t.input}" - ${t.scenario}: ${t.issue}`)
  );
}

if (issuesByType.other.length > 0) {
  console.log(`\n⚠️  OTHER ISSUES (${issuesByType.other.length} cases):`);
  issuesByType.other.slice(0, 5).forEach(t =>
    console.log(`   • "${t.input}" - ${t.scenario}: ${t.issue}`)
  );
}

console.log('\n');
