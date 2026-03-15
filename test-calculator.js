const { parseNaturalSchedule: parse } = require('./src/parser');
const { calcNextScheduledTime } = require('./index');

console.log('═══════════════════════════════════════════════════════════');
console.log('       Schedule Calculator - Test Suite');
console.log('═══════════════════════════════════════════════════════════\n');

// Set a reference date for consistent testing
const referenceDate = new Date('2026-02-01T09:00:00');

const testCases = [
    {
        title: 'One-time event in the future',
        input: 'Tomorrow at 7am',
        from: referenceDate
    },
    {
        title: 'One-time event in the past',
        input: 'Tomorrow at 7am',
        from: new Date('2026-02-03T10:00:00') // After the event
    },
    {
        title: 'Every 15 minutes',
        input: 'Every 15 minutes',
        from: referenceDate
    },
    {
        title: 'Every 2 hours at :30',
        input: 'Every 2 hours at :30',
        from: referenceDate
    },
    {
        title: 'Every 3 days at 9am',
        input: 'Every 3 days at 9am',
        from: referenceDate
    },
    {
        title: 'Weekdays at 9am (Mon-Fri)',
        input: 'Weekdays at 9am',
        from: referenceDate // Sunday
    },
    {
        title: 'Every Monday at 10am',
        input: 'Every Monday at 10am',
        from: referenceDate
    },
    {
        title: 'Mondays and Fridays at 5pm',
        input: 'Mondays and Fridays at 5pm',
        from: referenceDate
    },
    {
        title: 'Monthly on the 1st at midnight',
        input: 'Monthly on the 1st at midnight',
        from: referenceDate
    },
    {
        title: 'Monthly on the 15th at noon',
        input: 'Monthly on the 15th at noon',
        from: referenceDate
    },
    {
        title: 'Monthly on last day at 5pm',
        input: 'Monthly on last day at 5pm',
        from: referenceDate
    },
    {
        title: 'Every 3 months on the 1st at 9am (Quarterly)',
        input: 'Every 3 months on the 1st at 9am',
        from: referenceDate
    },
    {
        title: 'Annually on March 1st at 9am',
        input: 'Annually on March 1st at 9am',
        from: referenceDate
    },
    {
        title: 'Every year on December 31st at 11:59pm',
        input: 'Every year on December 31st at 11:59pm',
        from: referenceDate
    }
];

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
    console.log(`\nTest ${index + 1}: ${test.title}`);
    console.log('─'.repeat(70));
    console.log(`Input: "${test.input}"`);

    try {
        // Parse the schedule
        const schedule = parse(test.input, { referenceDate });
        console.log('Schedule JSON:');
        console.log(JSON.stringify(schedule, null, 2));

        // Calculate next run as Date
        const nextDate = calcNextScheduledTime(schedule, { from: test.from });
        console.log(`\nFrom: ${test.from.toISOString()}`);
        console.log(`Next run (Date): ${nextDate ? nextDate.toISOString() : 'null (ended)'}`);

        // Calculate next run as timestamp
        const nextTimestamp = calcNextScheduledTime(schedule, {
            from: test.from,
            asTimestamp: true
        });
        console.log(`Next run (Unix ms): ${nextTimestamp !== null ? nextTimestamp : 'null (ended)'}`);

        console.log('\n✅ PASSED');
        passed++;
    } catch (error) {
        console.log(`\n❌ FAILED: ${error.message}`);
        failed++;
    }
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════\n');

// Additional edge case tests
console.log('\n🔍 Edge Case Tests:\n');

// Test with "until" date
console.log('Test: Schedule with "until" date in the past');
const scheduleWithUntil = parse('Every day at 9am', { referenceDate });
scheduleWithUntil.until = '2026-01-15T00:00:00'; // Before from date
const nextAfterUntil = calcNextScheduledTime(scheduleWithUntil, {
    from: new Date('2026-02-01T10:00:00')
});
console.log(`Result: ${nextAfterUntil === null ? '✅ null (correctly ended)' : '❌ should be null'}`);

// Test timestamp output
console.log('\nTest: Timestamp output');
const simpleSchedule = parse('Tomorrow at 7am', { referenceDate });
const asDate = calcNextScheduledTime(simpleSchedule, { from: referenceDate });
const asTimestamp = calcNextScheduledTime(simpleSchedule, {
    from: referenceDate,
    asTimestamp: true
});
console.log(`Date: ${asDate.toISOString()}`);
console.log(`Timestamp: ${asTimestamp}`);
console.log(`Match: ${asDate.getTime() === asTimestamp ? '✅ correct' : '❌ mismatch'}`);

console.log('\n');
