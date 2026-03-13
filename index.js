/**
 * Natural Scheduler - Convert natural language to JSON schedule format
 */

const { parseNaturalSchedule } = require('./src/parser');
const { getNextScheduledTime } = require('./src/calculator');
const { getSuggestions, getSuggestionsByCategory, getPopularSuggestions } = require('./src/unified-autocomplete');
const { getTemplatesByCategory, getCategories } = require('./src/autocomplete-templates');
const { getDateTimeSuggestions, resolveDateTime } = require('./src/datetime-autocomplete');

module.exports = {
    // Core parsing and calculation
    parse: parseNaturalSchedule,
    parseNaturalSchedule,
    getNextScheduledTime,
    nextRun: getNextScheduledTime, // Alias

    // Autocomplete functionality
    getSuggestions,
    autocomplete: getSuggestions, // Alias
    getDateTimeSuggestions,
    resolveDateTime,
    getSuggestionsByCategory,
    getPopularSuggestions,
    getTemplatesByCategory,
    getCategories
};
