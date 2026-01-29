const { parse, getNextScheduledTime, nextRun } = require('./index');

console.log('═══════════════════════════════════════════════════════════');
console.log('       Schedule Calculator - Usage Examples');
console.log('═══════════════════════════════════════════════════════════\n');

// Example 1: One-time event
console.log('Example 1: One-time event');
console.log('─'.repeat(70));

const schedule1 = parse('Tomorrow at 7am');
console.log('Schedule:', JSON.stringify(schedule1, null, 2));

const next1 = getNextScheduledTime(schedule1);
console.log('Next run:', next1 ? next1.toISOString() : 'null');
console.log('');

// Example 2: Repeating schedule with timestamp output
console.log('Example 2: Repeating schedule (every 3 days)');
console.log('─'.repeat(70));

const schedule2 = parse('Every 3 days at 9am');
console.log('Schedule:', JSON.stringify(schedule2, null, 2));

const next2Date = getNextScheduledTime(schedule2);
const next2Timestamp = getNextScheduledTime(schedule2, { asTimestamp: true });

console.log('Next run (Date):', next2Date ? next2Date.toISOString() : 'null');
console.log('Next run (Unix ms):', next2Timestamp);
console.log('');

// Example 3: Calculate from specific date
console.log('Example 3: Calculate from specific date');
console.log('─'.repeat(70));

const schedule3 = parse('Weekdays at 9am');
const fromDate = new Date('2026-02-15T14:00:00'); // Saturday afternoon

console.log('Schedule:', JSON.stringify(schedule3, null, 2));
console.log('Calculate from:', fromDate.toISOString());

const next3 = getNextScheduledTime(schedule3, { from: fromDate });
console.log('Next run:', next3 ? next3.toISOString() : 'null');
console.log('(Should be next Monday)');
console.log('');

// Example 4: Schedule with "until" date
console.log('Example 4: Schedule that ends');
console.log('─'.repeat(70));

const schedule4 = parse('Every day at 9am');
schedule4.until = '2026-02-10T00:00:00'; // Ends Feb 10th

console.log('Schedule:', JSON.stringify(schedule4, null, 2));

const from4 = new Date('2026-02-09T10:00:00');
const next4a = getNextScheduledTime(schedule4, { from: from4 });
console.log('From Feb 9 10am:', next4a ? next4a.toISOString() : 'null');

const from4b = new Date('2026-02-11T10:00:00');
const next4b = getNextScheduledTime(schedule4, { from: from4b });
console.log('From Feb 11 10am:', next4b ? next4b.toISOString() : 'null (ended)');
console.log('');

// Example 5: Complex schedule
console.log('Example 5: Monthly on last day');
console.log('─'.repeat(70));

const schedule5 = parse('Monthly on the last day at 5pm');
console.log('Schedule:', JSON.stringify(schedule5, null, 2));

const next5 = getNextScheduledTime(schedule5, {
    from: new Date('2026-02-15T10:00:00')
});
console.log('Next run:', next5 ? next5.toISOString() : 'null');
console.log('(Should be Feb 28, 2026 at 5pm)');
console.log('');

// Example 6: Using the alias
console.log('Example 6: Using nextRun alias');
console.log('─'.repeat(70));

const schedule6 = parse('Every Monday at 10am');
const next6 = nextRun(schedule6, {
    from: new Date('2026-02-15T10:00:00'), // Sunday
    asTimestamp: true
});

console.log('Schedule:', JSON.stringify(schedule6, null, 2));
console.log('Next run (Unix ms):', next6);
console.log('As Date:', new Date(next6).toISOString());
console.log('(Should be next Monday)');
console.log('');

console.log('═══════════════════════════════════════════════════════════\n');
