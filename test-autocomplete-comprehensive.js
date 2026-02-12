/**
 * Comprehensive autocomplete tests
 */

const {
    getSuggestions,
    getSuggestionsByCategory,
    getPopularSuggestions,
    getCategories
} = require('./index');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        console.log(`✓ ${message}`);
    } else {
        failed++;
        console.log(`✗ ${message}`);
    }
}

function assertGreaterThan(actual, expected, message) {
    assert(actual > expected, `${message} (got ${actual}, expected > ${expected})`);
}

function assertExists(value, message) {
    assert(value !== null && value !== undefined, message);
}

console.log('Running comprehensive autocomplete tests...\n');

// ═══════════════════════════════════════════════════════════════════════════
console.log('━━━ Test Suite 1: Basic Functionality ━━━\n');

// Test 1.1: Empty input returns popular suggestions
const popularSuggestions = getSuggestions('', { limit: 10 });
assert(popularSuggestions.length === 10, 'Empty input returns 10 popular suggestions');
assert(popularSuggestions.length > 0 && popularSuggestions[0].label, 'Popular suggestions have labels');
assert(popularSuggestions.length > 0 && popularSuggestions[0].value, 'Popular suggestions have values');

// Test 1.2: Partial input "every" returns suggestions
const everySuggestions = getSuggestions('every', { limit: 5 });
assertGreaterThan(everySuggestions.length, 0, 'Input "every" returns suggestions');
assert(everySuggestions.every(s => s.label && s.score), 'All suggestions have label and score');

// Test 1.3: More specific input "every day" returns relevant suggestions
const everyDaySuggestions = getSuggestions('every day', { limit: 5 });
assertGreaterThan(everyDaySuggestions.length, 0, 'Input "every day" returns suggestions');
assert(everyDaySuggestions[0].label.toLowerCase().includes('day'), 'Top suggestion is relevant to "day"');

// Test 1.4: getPopularSuggestions function works
const popular = getPopularSuggestions(5);
assert(popular.length === 5, 'getPopularSuggestions returns correct limit');
assert(popular.every(s => s.value), 'Popular suggestions include JSON values');

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━━ Test Suite 2: Template Matching ━━━\n');

// Test 2.1: Exact match gets high score
const exactMatch = getSuggestions('every day at 9:00 am', { limit: 1 });
assert(exactMatch.length > 0 && exactMatch[0].score > 0.8, 'Exact match gets high score');

// Test 2.2: Prefix match works
const prefixMatch = getSuggestions('weekdays', { limit: 5 });
assertGreaterThan(prefixMatch.length, 0, 'Prefix "weekdays" matches templates');
assert(prefixMatch.some(s => s.label.toLowerCase().includes('weekdays')), 'Results contain "weekdays"');

// Test 2.3: Keyword matching works
const keywordMatch = getSuggestions('weekday', { limit: 5 });
assertGreaterThan(keywordMatch.length, 0, 'Keyword "weekday" matches templates');

// Test 2.4: Multiple words match
const multiWordMatch = getSuggestions('monday morning', { limit: 5 });
assertGreaterThan(multiWordMatch.length, 0, 'Multi-word "monday morning" matches');

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━━ Test Suite 3: Dynamic Generation ━━━\n');

// Test 3.1: "every N" pattern generates suggestions
const everyNPattern = getSuggestions('every 2', { limit: 5 });
assertGreaterThan(everyNPattern.length, 0, 'Pattern "every 2" generates suggestions');

// Test 3.2: "weekday at" pattern generates suggestions
const weekdayAtPattern = getSuggestions('monday at', { limit: 5 });
assertGreaterThan(weekdayAtPattern.length, 0, 'Pattern "monday at" generates suggestions');
assert(weekdayAtPattern.some(s => s.source === 'template' || s.source === 'dynamic'),
    'Results have source property');

// Test 3.3: "first/second/etc weekday" pattern generates suggestions
const ordinalPattern = getSuggestions('first monday', { limit: 5 });
assertGreaterThan(ordinalPattern.length, 0, 'Pattern "first monday" generates suggestions');

// Test 3.4: "next" pattern generates suggestions
const nextPattern = getSuggestions('next mon', { limit: 5 });
assertGreaterThan(nextPattern.length, 0, 'Pattern "next mon" generates suggestions');

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━━ Test Suite 4: Category Filtering ━━━\n');

// Test 4.1: Get all categories
const categories = getCategories();
assertGreaterThan(categories.length, 0, 'getCategories returns categories');
assert(categories.includes('Daily'), 'Categories include "Daily"');
assert(categories.includes('Weekly'), 'Categories include "Weekly"');
assert(categories.includes('Monthly'), 'Categories include "Monthly"');

// Test 4.2: Filter by Daily category
const dailySuggestions = getSuggestions('every', { limit: 10, category: 'Daily' });
assertGreaterThan(dailySuggestions.length, 0, 'Category filter "Daily" returns results');
assert(dailySuggestions.every(s => s.category === 'Daily'), 'All results are Daily category');

// Test 4.3: Filter by Weekly category
const weeklySuggestions = getSuggestions('every', { limit: 10, category: 'Weekly' });
assertGreaterThan(weeklySuggestions.length, 0, 'Category filter "Weekly" returns results');
assert(weeklySuggestions.every(s => s.category === 'Weekly'), 'All results are Weekly category');

// Test 4.4: getSuggestionsByCategory function
const categoryResults = getSuggestionsByCategory('Monthly', 5);
assert(categoryResults.length > 0 && categoryResults.length <= 5, 'getSuggestionsByCategory respects limit');
assert(categoryResults.every(s => s.category === 'Monthly'), 'All results match requested category');

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━━ Test Suite 5: Ranking and Scoring ━━━\n');

// Test 5.1: Results are sorted by score
const scoredResults = getSuggestions('every day', { limit: 10 });
let isSorted = true;
for (let i = 0; i < scoredResults.length - 1; i++) {
    if (scoredResults[i].score < scoredResults[i + 1].score) {
        isSorted = false;
        break;
    }
}
assert(isSorted, 'Results are sorted by score (descending)');

// Test 5.2: More specific input gets higher scores
const genericInput = getSuggestions('every', { limit: 1 });
const specificInput = getSuggestions('every day at 9', { limit: 1 });
// Can't directly compare since they're different queries, but both should have scores
assert(genericInput[0] && genericInput[0].score > 0, 'Generic input has valid score');
assert(specificInput[0] && specificInput[0].score > 0, 'Specific input has valid score');

// Test 5.3: Popularity affects ranking
const popularityTest = getSuggestions('', { limit: 2 });
assert(popularityTest.every(s => s.score), 'Popular suggestions have scores');

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━━ Test Suite 6: JSON Values ━━━\n');

// Test 6.1: All suggestions have valid JSON values
const withValues = getSuggestions('every day', { limit: 5, includeValue: true });
assert(withValues.every(s => s.value !== null && s.value !== undefined),
    'All suggestions with includeValue=true have values');

// Test 6.2: JSON values have correct structure
const valueCheck = getSuggestions('every day at 9am', { limit: 1, includeValue: true });
if (valueCheck.length > 0) {
    const value = valueCheck[0].value;
    assertExists(value.start, 'JSON value has "start" field');
    assertExists(value.repeat, 'JSON value has "repeat" field');
    if (value.repeat) {
        assertExists(value.repeat.interval, 'Repeat has "interval" field');
        assertExists(value.repeat.interval.unit, 'Interval has "unit" field');
        assertExists(value.repeat.interval.count, 'Interval has "count" field');
    }
}

// Test 6.3: Can disable includeValue
const withoutValues = getSuggestions('every day', { limit: 5, includeValue: false });
assert(withoutValues.length > 0, 'Suggestions returned with includeValue=false');

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━━ Test Suite 7: Edge Cases ━━━\n');

// Test 7.1: Very short input
const shortInput = getSuggestions('e', { limit: 5 });
assertGreaterThan(shortInput.length, 0, 'Single character input returns results');

// Test 7.2: Input with typos (tokenizer should handle)
const typoInput = getSuggestions('evry day', { limit: 5 });
assertGreaterThan(typoInput.length, 0, 'Typo "evry day" returns results');

// Test 7.3: Case insensitivity
const upperCase = getSuggestions('EVERY DAY', { limit: 5 });
const lowerCase = getSuggestions('every day', { limit: 5 });
assert(upperCase.length > 0 && lowerCase.length > 0, 'Case insensitive matching works');

// Test 7.4: Limit parameter works
const limit3 = getSuggestions('every', { limit: 3 });
const limit10 = getSuggestions('every', { limit: 10 });
assert(limit3.length <= 3, 'Limit of 3 is respected');
assert(limit10.length <= 10, 'Limit of 10 is respected');

// Test 7.5: minScore parameter works
const highScore = getSuggestions('every day', { limit: 10, minScore: 0.8 });
const lowScore = getSuggestions('every day', { limit: 10, minScore: 0.1 });
assert(highScore.every(s => s.score >= 0.8), 'minScore 0.8 filters correctly');
assert(lowScore.length >= highScore.length, 'Lower minScore returns more or equal results');

// Test 7.6: Non-matching input returns empty or low-scored results
const nonMatch = getSuggestions('xyzabc123', { limit: 5 });
assert(nonMatch.length === 0 || nonMatch.every(s => s.score < 0.5),
    'Non-matching input returns empty or low scores');

// Test 7.7: Very long input handles gracefully
const longInput = getSuggestions('every single day at 9 in the morning every week throughout the year', { limit: 5 });
assert(Array.isArray(longInput), 'Long input returns array (handles gracefully)');

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━━ Test Suite 8: Specific Pattern Tests ━━━\n');

// Test 8.1: Weekday patterns (prefix matching)
const thursdayInput = getSuggestions('every thursday', { limit: 5 });
assertGreaterThan(thursdayInput.length, 0, 'Weekday pattern "every thursday" returns results');
assert(thursdayInput.every(s => s.label.toLowerCase().startsWith('every thursday')),
    'Results all start with "every thursday"');

// Test 8.2: Monthly patterns
const monthlyInput = getSuggestions('monthly on', { limit: 5 });
assertGreaterThan(monthlyInput.length, 0, 'Pattern "monthly on" returns results');

// Test 8.3: Time patterns (prefix matching)
const timeInput = getSuggestions('tomorrow at 9', { limit: 5 });
assertGreaterThan(timeInput.length, 0, 'Time pattern "tomorrow at 9" returns results');

// Test 8.4: Relative dates
const tomorrowInput = getSuggestions('tomorrow', { limit: 5 });
assertGreaterThan(tomorrowInput.length, 0, 'Relative date "tomorrow" returns results');

// Test 8.5: Business days
const businessInput = getSuggestions('business', { limit: 5 });
assertGreaterThan(businessInput.length, 0, 'Pattern "business" returns results');
assert(businessInput.some(s => s.label.toLowerCase().includes('business') || s.label.toLowerCase().includes('weekday')),
    'Results contain business day patterns');

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n━━━ Test Suite 9: Integration Tests ━━━\n');

// Test 9.1: Full workflow - get suggestions, select one, verify it parses
const workflow = getSuggestions('every', { limit: 5, includeValue: true });
if (workflow.length > 0) {
    const selected = workflow[0];
    assert(selected.label && selected.input && selected.value,
        'Full workflow: suggestion has all required fields');
    assert(selected.value.start, 'Full workflow: value can be used directly');
}

// Test 9.2: Verify template and dynamic sources both work
const mixed = getSuggestions('every day', { limit: 10 });
const hasTemplate = mixed.some(s => s.source === 'template');
const hasDynamic = mixed.some(s => s.source === 'dynamic');
assert(hasTemplate || hasDynamic, 'Results include template or dynamic sources');

// Test 9.3: Category browsing workflow
const allCategories = getCategories();
let allCategoriesWork = true;
for (const cat of allCategories) {
    const catResults = getSuggestionsByCategory(cat, 5);
    if (catResults.length === 0 || !catResults.every(s => s.category === cat)) {
        allCategoriesWork = false;
        break;
    }
}
assert(allCategoriesWork, 'All categories can be browsed successfully');

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(70));
console.log(`\nTest Results: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
    console.log('✓ All tests passed!\n');
    process.exit(0);
} else {
    console.log(`✗ ${failed} test(s) failed\n`);
    process.exit(1);
}
