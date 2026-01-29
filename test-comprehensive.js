const { parse } = require('./index');

// Comprehensive test cases from user requirements
const testCases = [
    // Basic patterns with typos
    "Every day at 5am",
    "Every dya at 3 am",
    "Every 2 daus",
    "Every 8 dyas",
    "Ever 29 days",

    // Daily patterns
    "Daily around 9:15 AM",

    // Weekday patterns
    "Every single weekday at 7:00",
    "Weekdays only, 8:45 in the morning",
    "Business days at 10",

    // Weekend patterns
    "Every weekend at noon",
    "Weekends only, early at 6:30am",
    "Saturday mornings at 9",
    "Sundays at 11:59pm",
    "Every other Sunday at midnight",

    // Day intervals
    "Every 3rd day at 4pm",
    "Every 7 days at 2:00 PM",
    "Every 14 days around noon",
    "Every 21 days, late morning",
    "Every 60 days at 8am",
    "Every 120 days at 3:30 PM",
    "Every 365 days at midnight",

    // Weekly patterns
    "Every week on Monday at 9",
    "Mondays and Fridays at 5pm",
    "Tuesday + Thursday at 1pm",
    "Every week on Tue/Wed/Thu at 10",
    "Every 2 weeks on Wednesday at noon",
    "Every 4 weeks on Friday at 6pm",

    // Monthly patterns
    "Once a month on the 10th at 8am",
    "Monthly on the 1st at midnight",
    "Monthly on the last day at 5:00 PM",
    "Every 2 months on the 15th at noon",
    "Every 6 months on the last day at 11pm",

    // Quarterly patterns
    "Every quarter on day one at 9am",

    // Yearly patterns
    "Once a year on Jan 5th at 10am",
    "Yearly on March 15 at noon",
    "Every year on the last day of February",
    "Every year, December 31st at 11:59pm",

    // Long intervals
    "Every 45 days at 9am",
    "Every 90 days at noon",
    "Every 180 days at 7am",

    // Relative dates - one-time
    "Next Tuesday evening around 8",
    "This coming Thursday at 14:00",
    "Tomorrow at 6am",
    "Later today at 4pm",
    "In two days at 9:30",
    "In 45 days at 8am",

    // Relative with "from now"
    "30 days from now at 9am",
    "5 fridays from now at 2pm",

    // Month/year relative
    "Next month at midnight",
    "Next quarter at 9am",
    "Next year on March 1st at 9am",
    "End of the year at midnight",
    "Start of the year at 00:00",

    // Except patterns
    "Every weekday except monday at 9am",
    "Every weekday except fridays at 8",
    "Every weekend except saturday at 11am",
    "Weekends but not sundays at 10am",

    // Time variations
    "Every workday morning at 8",
    "Every weekday afternoon at 3:15",
    "Every weekend night at 10pm",

    // Edge cases
    "Every day at midnight forever",
    "Every month on the 31st when it exists",
    "Every month on last day, no matter what",
    "Every year on last calendar day at 11:59",

    // One-time events
    "Once, right now",
    "Once, tomorrow morning",
    "Once, next friday evening",
];

console.log('═══════════════════════════════════════════════════════════');
console.log('    Natural Scheduler - Comprehensive Test Suite');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;
const errors = [];

// Set a reference date for consistent testing
const referenceDate = new Date('2026-02-01T09:00:00');

testCases.forEach((input, index) => {
    try {
        const result = parse(input, { referenceDate });
        console.log(`✅ ${index + 1}. "${input}"`);
        passed++;
    } catch (error) {
        console.log(`❌ ${index + 1}. "${input}"`);
        console.log(`   Error: ${error.message}`);
        failed++;
        errors.push({ input, error: error.message });
    }
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);
console.log('═══════════════════════════════════════════════════════════');

if (failed > 0) {
    console.log('\n Failed tests:');
    errors.forEach((e, i) => {
        console.log(`${i + 1}. "${e.input}"`);
        console.log(`   ${e.error}`);
    });
}

console.log('');
