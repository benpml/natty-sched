const { parse } = require('./index');

// Test cases from your requirements
const testCases = [
    {
        input: "Every 45 days",
        description: "Every 45 days"
    },
    {
        input: "Every thursday",
        description: "Every thursday"
    },
    {
        input: "Every other day",
        description: "Every other day"
    },
    {
        input: "On tuesdays at 10 am",
        description: "On tuesdays at 10 am"
    },
    {
        input: "On every weekend day",
        description: "On every weekend day"
    },
    {
        input: "Once per weekend",
        description: "Once per weekend"
    },
    {
        input: "Once per month on the first day of the month",
        description: "Once per month on the first day of the month"
    },
    {
        input: "Every 15 minutes",
        description: "Every 15 minutes"
    },
    {
        input: "Hourly on the half hour",
        description: "Hourly on the half hour"
    },
    {
        input: "Daily at 9:00 AM",
        description: "Daily at 9:00 AM"
    },
    {
        input: "Every 2 days at 8:30 AM",
        description: "Every 2 days at 8:30 AM"
    },
    {
        input: "Every 45 days at 9:00 AM",
        description: "Every 45 days at 9:00 AM"
    },
    {
        input: "Weekdays at 9:00 AM",
        description: "Weekdays at 9:00 AM"
    },
    {
        input: "Business days at 9:30 AM",
        description: "Business days at 9:30 AM"
    },
    {
        input: "Weekends at 10:00 AM",
        description: "Weekends at 10:00 AM"
    },
    {
        input: "Mondays at 10:00 AM",
        description: "Mondays at 10:00 AM"
    },
    {
        input: "Mondays and Wednesdays at 3:00 PM",
        description: "Mondays and Wednesdays at 3:00 PM"
    },
    {
        input: "Fridays at 5:00 PM",
        description: "Fridays at 5:00 PM"
    },
    {
        input: "Every other Tuesday at 11:00 AM",
        description: "Every other Tuesday at 11:00 AM"
    },
    {
        input: "On the 1st and 15th of each month at noon",
        description: "On the 1st and 15th of each month at noon"
    },
    {
        input: "On the last day of each month at 9:00 AM",
        description: "On the last day of each month at 9:00 AM"
    },
    {
        input: "Every 3 months on the 1st at 9:00 AM",
        description: "Every 3 months on the 1st at 9:00 AM"
    },
    {
        input: "Annually on March 1st at 9:00 AM",
        description: "Annually on March 1st at 9:00 AM"
    },
    {
        input: "Tomorrow morning at 7:00 AM",
        description: "Tomorrow morning at 7:00 AM"
    },
    {
        input: "Next Tuesday at 8:00 PM",
        description: "Next Tuesday at 8:00 PM"
    },
    {
        input: "This coming Friday at 4:00 PM",
        description: "This coming Friday at 4:00 PM"
    }
];

console.log('═══════════════════════════════════════════════════════════');
console.log('       Natural Scheduler - Test Suite');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

// Set a reference date for consistent testing
const referenceDate = new Date('2026-02-01T09:00:00');

testCases.forEach((testCase, index) => {
    console.log(`\nTest ${index + 1}: ${testCase.description}`);
    console.log('─'.repeat(60));
    console.log(`Input: "${testCase.input}"`);

    try {
        const result = parse(testCase.input, { referenceDate });
        console.log('✅ SUCCESS');
        console.log('Result:');
        console.log(JSON.stringify(result, null, 2));
        passed++;
    } catch (error) {
        console.log('❌ FAILED');
        console.log(`Error: ${error.message}`);
        failed++;
    }
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════\n');
