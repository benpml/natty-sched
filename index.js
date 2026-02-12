/**
 * Natural Scheduler - Convert natural language to JSON schedule format
 */

const { parseNaturalSchedule } = require('./src/parser');
const { getNextScheduledTime } = require('./src/calculator');
const { getSuggestions, getSuggestionsByCategory, getPopularSuggestions } = require('./src/autocomplete');
const { getTemplatesByCategory, getCategories } = require('./src/autocomplete-templates');

module.exports = {
    // Core parsing and calculation
    parse: parseNaturalSchedule,
    parseNaturalSchedule,
    getNextScheduledTime,
    nextRun: getNextScheduledTime, // Alias

    // Autocomplete functionality
    getSuggestions,
    autocomplete: getSuggestions, // Alias
    getSuggestionsByCategory,
    getPopularSuggestions,
    getTemplatesByCategory,
    getCategories
};
