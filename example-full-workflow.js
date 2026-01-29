const { parse, getNextScheduledTime } = require('./index');

console.log('═══════════════════════════════════════════════════════════════════');
console.log('       Natural Scheduler - Complete Workflow Example');
console.log('═══════════════════════════════════════════════════════════════════\n');

// Simulate a user entering natural language
const userInput = "Weekdays at 9am";

console.log(`User input: "${userInput}"\n`);

// Step 1: Parse natural language to JSON
console.log('Step 1: Parse to JSON');
console.log('─'.repeat(70));

try {
    const schedule = parse(userInput);
    console.log('✅ Parsed successfully:');
    console.log(JSON.stringify(schedule, null, 2));
    console.log('');

    // Step 2: Calculate next scheduled time
    console.log('Step 2: Calculate next execution time');
    console.log('─'.repeat(70));

    const now = new Date();
    const nextRun = getNextScheduledTime(schedule, { from: now });
    const nextRunTimestamp = getNextScheduledTime(schedule, {
        from: now,
        asTimestamp: true
    });

    console.log(`Current time: ${now.toISOString()}`);
    console.log(`Next run: ${nextRun ? nextRun.toISOString() : 'null'}`);
    console.log(`As Unix ms: ${nextRunTimestamp}`);
    console.log('');

    // Step 3: Calculate multiple upcoming runs
    console.log('Step 3: Get next 5 scheduled runs');
    console.log('─'.repeat(70));

    let currentFrom = now;
    const upcomingRuns = [];

    for (let i = 0; i < 5; i++) {
        const next = getNextScheduledTime(schedule, { from: currentFrom });

        if (!next) {
            console.log('Schedule ended or no more runs');
            break;
        }

        upcomingRuns.push(next);
        // Move forward by 1 second for next calculation
        currentFrom = new Date(next.getTime() + 1000);
    }

    upcomingRuns.forEach((run, index) => {
        console.log(`  ${index + 1}. ${run.toISOString()} (${run.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })})`);
    });

    console.log('');

    // Step 4: Store for database or API
    console.log('Step 4: Format for storage/transmission');
    console.log('─'.repeat(70));

    const apiPayload = {
        schedule_json: schedule,
        next_run_at: nextRunTimestamp,
        next_run_date: nextRun ? nextRun.toISOString() : null,
        created_at: Date.now(),
        human_readable: userInput
    };

    console.log('API/Database payload:');
    console.log(JSON.stringify(apiPayload, null, 2));
    console.log('');

    // Step 5: Check if schedule is active
    console.log('Step 5: Schedule status checks');
    console.log('─'.repeat(70));

    const hasEnded = nextRun === null;
    const isOneTime = !schedule.repeat;
    const hasUntil = !!schedule.until;

    console.log(`Is one-time event: ${isOneTime}`);
    console.log(`Has end date: ${hasUntil}`);
    console.log(`Schedule ended: ${hasEnded}`);
    console.log(`Status: ${hasEnded ? '🔴 Ended' : '🟢 Active'}`);

} catch (error) {
    console.log('❌ Error:', error.message);
}

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('                     Workflow Complete!');
console.log('═══════════════════════════════════════════════════════════════════\n');
