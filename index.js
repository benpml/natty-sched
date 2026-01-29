/**
 * Natural Scheduler - Convert natural language to JSON schedule format
 */

const { parseNaturalSchedule } = require('./src/parser');
const { getNextScheduledTime } = require('./src/calculator');

module.exports = {
    parse: parseNaturalSchedule,
    parseNaturalSchedule,
    getNextScheduledTime,
    nextRun: getNextScheduledTime // Alias
};
