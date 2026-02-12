/**
 * Interactive terminal test for autocomplete functionality
 */

const readline = require('readline');
const { getSuggestions, getSuggestionsByCategory, getCategories } = require('./index');

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    red: '\x1b[31m',
    gray: '\x1b[90m'
};

// Configuration
let config = {
    limit: 10,
    showJson: false,
    category: null,
    minScore: 0.3
};

/**
 * Print colored text
 */
function print(text, color = 'reset') {
    console.log(colors[color] + text + colors.reset);
}

/**
 * Print header
 */
function printHeader() {
    console.clear();
    print('╔══════════════════════════════════════════════════════════════╗', 'cyan');
    print('║        Natural Scheduler - Autocomplete Test Tool           ║', 'cyan');
    print('╚══════════════════════════════════════════════════════════════╝', 'cyan');
    print('');
    print('Type partial schedule text to see suggestions.', 'dim');
    print('Commands: /help /exit /clear /json /category /limit /score', 'dim');
    print('', 'reset');
}

/**
 * Print help
 */
function printHelp() {
    print('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    print('  COMMANDS', 'bright');
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    print('  /help              Show this help message', 'gray');
    print('  /exit              Exit the test tool', 'gray');
    print('  /clear             Clear the screen', 'gray');
    print('  /json              Toggle JSON value display', 'gray');
    print('  /category [name]   Filter by category (or show all)', 'gray');
    print('  /limit [number]    Set suggestion limit (default: 10)', 'gray');
    print('  /score [number]    Set minimum score threshold (default: 0.3)', 'gray');
    print('  /popular           Show popular suggestions', 'gray');
    print('  /categories        List all available categories', 'gray');
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    print('\n  EXAMPLES', 'bright');
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
    print('  every              See suggestions starting with "every"', 'gray');
    print('  every day          See daily schedule suggestions', 'gray');
    print('  monday at          See Monday schedule suggestions', 'gray');
    print('  monthly on         See monthly schedule suggestions', 'gray');
    print('  first              See ordinal-based suggestions', 'gray');
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');
}

/**
 * Print configuration
 */
function printConfig() {
    print('\n  Current Configuration:', 'yellow');
    print(`  • Limit: ${config.limit} suggestions`, 'dim');
    print(`  • Min Score: ${config.minScore}`, 'dim');
    print(`  • Show JSON: ${config.showJson ? 'Yes' : 'No'}`, 'dim');
    print(`  • Category Filter: ${config.category || 'None (all)'}`, 'dim');
    print('');
}

/**
 * Format suggestion for display
 */
function formatSuggestion(suggestion, index) {
    const number = `${index + 1}.`.padEnd(4);
    const score = suggestion.score ? ` [${(suggestion.score * 100).toFixed(0)}%]` : '';
    const category = suggestion.category ? ` (${suggestion.category})` : '';
    const source = suggestion.source === 'dynamic' ? ' 🔄' : '';

    print(`${number}${suggestion.label}${colors.gray}${score}${category}${source}${colors.reset}`, 'green');

    if (config.showJson && suggestion.value) {
        const json = JSON.stringify(suggestion.value, null, 2)
            .split('\n')
            .map(line => '      ' + line)
            .join('\n');
        print(json, 'dim');
        print('');
    }
}

/**
 * Process input
 */
function processInput(input) {
    const trimmed = input.trim();

    // Handle commands
    if (trimmed.startsWith('/')) {
        const parts = trimmed.slice(1).split(/\s+/);
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        switch (command) {
            case 'help':
                printHelp();
                return;

            case 'exit':
            case 'quit':
                print('\nGoodbye! 👋\n', 'cyan');
                process.exit(0);
                return;

            case 'clear':
                printHeader();
                return;

            case 'json':
                config.showJson = !config.showJson;
                print(`\n✓ JSON display ${config.showJson ? 'enabled' : 'disabled'}`, 'green');
                return;

            case 'category':
                if (args.length > 0) {
                    config.category = args.join(' ');
                    print(`\n✓ Category filter set to: ${config.category}`, 'green');
                } else {
                    config.category = null;
                    print('\n✓ Category filter cleared (showing all)', 'green');
                }
                return;

            case 'limit':
                if (args.length > 0) {
                    const limit = parseInt(args[0]);
                    if (!isNaN(limit) && limit > 0) {
                        config.limit = limit;
                        print(`\n✓ Suggestion limit set to: ${config.limit}`, 'green');
                    } else {
                        print('\n✗ Invalid limit. Please provide a positive number.', 'red');
                    }
                } else {
                    print('\n✗ Usage: /limit [number]', 'red');
                }
                return;

            case 'score':
                if (args.length > 0) {
                    const score = parseFloat(args[0]);
                    if (!isNaN(score) && score >= 0 && score <= 1) {
                        config.minScore = score;
                        print(`\n✓ Minimum score set to: ${config.minScore}`, 'green');
                    } else {
                        print('\n✗ Invalid score. Please provide a number between 0 and 1.', 'red');
                    }
                } else {
                    print('\n✗ Usage: /score [number]', 'red');
                }
                return;

            case 'popular':
                print('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
                print('  POPULAR SUGGESTIONS', 'bright');
                print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
                const popular = getSuggestions('', { limit: config.limit });
                if (popular.length === 0) {
                    print('\n  No suggestions found.', 'dim');
                } else {
                    print('');
                    popular.forEach((suggestion, index) => formatSuggestion(suggestion, index));
                }
                print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');
                return;

            case 'categories':
                print('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
                print('  AVAILABLE CATEGORIES', 'bright');
                print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
                const categories = getCategories();
                categories.forEach(cat => {
                    print(`  • ${cat}`, 'green');
                });
                print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');
                print('  Use /category [name] to filter suggestions', 'dim');
                return;

            case 'config':
                printConfig();
                return;

            default:
                print(`\n✗ Unknown command: /${command}`, 'red');
                print('  Type /help for available commands', 'dim');
                return;
        }
    }

    // Handle empty input
    if (trimmed.length === 0) {
        print('\n  Type something to see suggestions, or /help for commands', 'dim');
        return;
    }

    // Get suggestions
    try {
        print('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
        print(`  SUGGESTIONS FOR: "${trimmed}"`, 'bright');
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

        const suggestions = getSuggestions(trimmed, {
            limit: config.limit,
            category: config.category,
            minScore: config.minScore
        });

        if (suggestions.length === 0) {
            print('\n  No suggestions found. Try:', 'dim');
            print('  • Different keywords', 'dim');
            print('  • Lower minimum score with /score 0.1', 'dim');
            print('  • Remove category filter with /category', 'dim');
        } else {
            print(`\n  Found ${suggestions.length} suggestion(s):\n`, 'dim');
            suggestions.forEach((suggestion, index) => formatSuggestion(suggestion, index));
        }

        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');
    } catch (error) {
        print(`\n✗ Error: ${error.message}`, 'red');
        print('');
    }
}

/**
 * Main function
 */
function main() {
    printHeader();
    print('Welcome! Type a partial schedule to see autocomplete suggestions.\n', 'green');
    print('Try these examples:', 'dim');
    print('  • "every"', 'dim');
    print('  • "every day"', 'dim');
    print('  • "monday at"', 'dim');
    print('  • "first"', 'dim');
    print('\nType /help for more information.\n', 'dim');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: colors.blue + '> ' + colors.reset
    });

    rl.prompt();

    rl.on('line', (input) => {
        processInput(input);
        rl.prompt();
    });

    rl.on('close', () => {
        print('\nGoodbye! 👋\n', 'cyan');
        process.exit(0);
    });
}

// Run the test tool
main();
