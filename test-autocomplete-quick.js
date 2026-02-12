/**
 * Quick test of autocomplete functionality
 */

const { getSuggestions } = require('./index');

console.log('Testing autocomplete functionality...\n');

// Test 1: Empty input (popular suggestions)
console.log('Test 1: Empty input (should show popular suggestions)');
try {
    const results = getSuggestions('', { limit: 5 });
    console.log(`✓ Got ${results.length} suggestions`);
    results.forEach((s, i) => console.log(`  ${i + 1}. ${s.label}`));
} catch (error) {
    console.log(`✗ Error: ${error.message}`);
}

console.log('\n' + '='.repeat(60) + '\n');

// Test 2: Partial input "every"
console.log('Test 2: Input "every" (should match many templates)');
try {
    const results = getSuggestions('every', { limit: 5 });
    console.log(`✓ Got ${results.length} suggestions`);
    results.forEach((s, i) => console.log(`  ${i + 1}. ${s.label} (score: ${(s.score * 100).toFixed(0)}%)`));
} catch (error) {
    console.log(`✗ Error: ${error.message}`);
}

console.log('\n' + '='.repeat(60) + '\n');

// Test 3: Partial input "every day"
console.log('Test 3: Input "every day" (should match daily schedules)');
try {
    const results = getSuggestions('every day', { limit: 5 });
    console.log(`✓ Got ${results.length} suggestions`);
    results.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.label} (score: ${(s.score * 100).toFixed(0)}%, source: ${s.source})`);
    });
} catch (error) {
    console.log(`✗ Error: ${error.message}`);
}

console.log('\n' + '='.repeat(60) + '\n');

// Test 4: Partial input "monday at"
console.log('Test 4: Input "monday at" (should generate dynamic suggestions)');
try {
    const results = getSuggestions('monday at', { limit: 5 });
    console.log(`✓ Got ${results.length} suggestions`);
    results.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.label} (source: ${s.source})`);
    });
} catch (error) {
    console.log(`✗ Error: ${error.message}`);
}

console.log('\n' + '='.repeat(60) + '\n');

// Test 5: Verify JSON values are included
console.log('Test 5: Verify JSON values are included');
try {
    const results = getSuggestions('every day', { limit: 2 });
    if (results.length > 0 && results[0].value) {
        console.log(`✓ JSON values are included`);
        console.log(`  Example: ${results[0].label}`);
        console.log(`  JSON:`, JSON.stringify(results[0].value, null, 2));
    } else {
        console.log(`✗ JSON values are missing`);
    }
} catch (error) {
    console.log(`✗ Error: ${error.message}`);
}

console.log('\n' + '='.repeat(60) + '\n');
console.log('✓ All tests completed!\n');
