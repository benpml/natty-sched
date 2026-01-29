#!/usr/bin/env node

const { parse } = require('./index');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\n📅 Enter schedule (or "exit" to quit): '
});

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║           Natural Scheduler - Interactive Demo                ║');
console.log('║  Type natural language to convert to JSON schedule format      ║');
console.log('╚════════════════════════════════════════════════════════════════╝');

console.log('\n✨ Example expressions:');
console.log('  • Every 45 days at 9am');
console.log('  • Weekdays at 9:30 AM');
console.log('  • Every thursday at 2pm');
console.log('  • Every other Tuesday at 11am');
console.log('  • On the 1st and 15th at noon');
console.log('  • Monthly on the last day at 9am');
console.log('  • Quarterly at midnight');
console.log('  • Annually on March 1st at 9am');
console.log('  • Tomorrow at 7am');
console.log('  • Next Tuesday at 8pm');
console.log('  • Every 15 minutes');
console.log('  • Business days at 9am');

rl.prompt();

rl.on('line', (line) => {
    const input = line.trim();

    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
        console.log('\n👋 Goodbye!\n');
        process.exit(0);
    }

    if (!input) {
        rl.prompt();
        return;
    }

    try {
        const result = parse(input);
        console.log('\n✅ Success! Schedule JSON:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(JSON.stringify(result, null, 2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Show interpretation
        console.log('\n📋 Interpretation:');
        interpretSchedule(result);
    } catch (error) {
        console.log('\n❌ Parse Error:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  ${error.message}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    rl.prompt();
}).on('close', () => {
    console.log('\n👋 Goodbye!\n');
    process.exit(0);
});

/**
 * Interpret and explain the schedule in human-friendly terms
 */
function interpretSchedule(schedule) {
    const start = new Date(schedule.start);
    const startStr = start.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    console.log(`  🕐 Starts: ${startStr}`);

    if (!schedule.repeat) {
        console.log('  🔁 Frequency: One-time event');
    } else {
        const { interval, on, at } = schedule.repeat;

        // Interpret interval
        let freqStr = '';
        if (interval.count === 1) {
            freqStr = `Every ${interval.unit}`;
        } else {
            freqStr = `Every ${interval.count} ${interval.unit}s`;
        }
        console.log(`  🔁 Frequency: ${freqStr}`);

        // Interpret "on" clause
        if (on) {
            if (on.weekdays) {
                const days = on.weekdays.map(d => d.toUpperCase()).join(', ');
                console.log(`  📆 On: ${days}`);
            }
            if (on.month_days) {
                const days = on.month_days.map(d => d === 'last' ? 'Last day' : `Day ${d}`).join(', ');
                console.log(`  📆 On: ${days} of month`);
            }
            if (on.year_date) {
                const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                console.log(`  📆 On: ${monthNames[on.year_date.month]} ${on.year_date.day}`);
            }
        }

        // Interpret "at" time
        if (at) {
            const [hours, minutes] = at.split(':');
            const h = parseInt(hours);
            const m = parseInt(minutes);
            const period = h >= 12 ? 'PM' : 'AM';
            const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
            console.log(`  ⏰ At: ${displayHour}:${minutes} ${period}`);
        }
    }

    if (schedule.until) {
        const until = new Date(schedule.until);
        const untilStr = until.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        console.log(`  ⏹  Until: ${untilStr}`);
    }
}
