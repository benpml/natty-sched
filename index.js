/**
 * Natural Scheduler - Convert natural language to JSON schedule format
 */

const { getNextScheduledTime } = require('./src/calculator');
const {
    autocomplete,
    autocompleteSchedule,
    autocompleteDatetime,
    resolveScheduleString,
    resolveString
} = require('./src/unified-autocomplete');
const { resolveDatetimeString } = require('./src/datetime-autocomplete');

module.exports = {
    autocomplete,
    autocompleteSchedule,
    autocompleteDatetime,
    resolveDatetimeString,
    resolveScheduleString,
    resolveString,
    calcNextScheduledTime: getNextScheduledTime
};
