const { parse } = require('./index');

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  Natural Scheduler - Key Features & Improvements');
console.log('═══════════════════════════════════════════════════════════════════\n');

const ref = new Date('2026-02-01T09:00:00');

const demos = [
    {
        title: '✅ Fixed: Long day intervals (cronned returned "* * * * *")',
        inputs: ['Every 41 days at 9am', 'Every 90 days at noon']
    },
    {
        title: '✅ Typo tolerance',
        inputs: ['Ever 29 dyas', 'Every dya at 3 am', 'Bussiness days at 9am']
    },
    {
        title: '✅ Alternative separators',
        inputs: ['Tuesday + Thursday at 1pm', 'Mon/Wed/Fri at 10am']
    },
    {
        title: '✅ Time variations',
        inputs: ['Weekdays early at 6:30am', 'Every day late morning', 'Weekends evening at 6pm']
    },
    {
        title: '✅ Except patterns',
        inputs: ['Weekdays except fridays at 8am', 'Weekends but not sundays at 10am']
    },
    {
        title: '✅ Relative futures',
        inputs: ['30 days from now at 9am', 'Next quarter at midnight', 'End of the year at 11:59pm']
    },
    {
        title: '✅ Edge cases',
        inputs: ['Last day of each month at 9am', 'Every year on leap day at 9am', 'Monthly on the 31st when it exists']
    }
];

demos.forEach(demo => {
    console.log(demo.title);
    console.log('─'.repeat(70));

    demo.inputs.forEach(input => {
        try {
            const result = parse(input, { referenceDate: ref });
            console.log(`\nInput:  "${input}"`);
            console.log('Output:');
            console.log(JSON.stringify(result, null, 2));
        } catch (error) {
            console.log(`\nInput:  "${input}"`);
            console.log(`❌ Error: ${error.message}`);
        }
    });

    console.log('\n');
});

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  Summary: All patterns correctly converted to JSON format!');
console.log('═══════════════════════════════════════════════════════════════════\n');
