#!/usr/bin/env node
/**
 * Autocomplete Bulk Tester
 *
 * Usage:
 *   node test-bulk-autocomplete.js "query1" "query2" "query3" ...
 *
 * Options (can appear anywhere in the argument list):
 *   --mode=schedule      Only return recurring schedule suggestions
 *   --mode=datetime      Only return one-time datetime suggestions
 *   --mode=both          Return both types (default)
 *   --limit=N            Max results per query (default: 5)
 *   --min-score=N        Minimum score threshold 0-1 (default: 0.3)
 *   --no-value           Don't include parsed value in output
 *   --verbose            Show extra debug info (normalization, tokens, parse state)
 *   --json               Output raw JSON instead of formatted text
 *
 * Examples:
 *   node test-bulk-autocomplete.js "every day at" "monday" "at 3 pm"
 *   node test-bulk-autocomplete.js --mode=schedule --limit=10 "weekdays" "daily at"
 *   node test-bulk-autocomplete.js --verbose "every tuesd" "twice a week"
 *   node test-bulk-autocomplete.js --json "every monday at 9 am"
 */

const { getSuggestions } = require('./src/unified-autocomplete');

// Lazy-load verbose dependencies only if needed
let normalizeUnified, tokenize, detectScheduleParseState;

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Autocomplete Bulk Tester

Usage:
  node test-bulk-autocomplete.js "query1" "query2" "query3" ...

Options:
  --mode=schedule|datetime|both   Filter suggestion type (default: both)
  --limit=N                       Max results per query (default: 5)
  --min-score=N                   Minimum score 0-1 (default: 0.3)
  --no-value                      Omit parsed value from output
  --verbose                       Show normalization, tokens, and parse state
  --json                          Output raw JSON
  --help, -h                      Show this help

Examples:
  node test-bulk-autocomplete.js "every day at" "monday" "at 3 pm"
  node test-bulk-autocomplete.js --mode=schedule --limit=10 "weekdays"
  node test-bulk-autocomplete.js --verbose "every tuesd" "twice a week"
`);
  process.exit(0);
}

// Parse options and queries
let mode = 'both';
let limit = 5;
let minScore = 0.3;
let includeValue = true;
let verbose = false;
let jsonOutput = false;
const queries = [];

for (const arg of args) {
  if (arg.startsWith('--mode=')) {
    mode = arg.slice(7);
  } else if (arg.startsWith('--limit=')) {
    limit = parseInt(arg.slice(8), 10);
  } else if (arg.startsWith('--min-score=')) {
    minScore = parseFloat(arg.slice(12));
  } else if (arg === '--no-value') {
    includeValue = false;
  } else if (arg === '--verbose') {
    verbose = true;
  } else if (arg === '--json') {
    jsonOutput = true;
  } else if (!arg.startsWith('--')) {
    queries.push(arg);
  }
}

if (queries.length === 0) {
  console.error('Error: No queries provided. Pass one or more quoted strings.');
  process.exit(1);
}

// Build options object
const options = { limit, minScore, includeValue };
if (mode === 'schedule') {
  options.allowRecurring = true;
  options.allowOneTime = false;
} else if (mode === 'datetime') {
  options.allowRecurring = false;
  options.allowOneTime = true;
} else {
  options.allowRecurring = true;
  options.allowOneTime = true;
}

// Load verbose dependencies
if (verbose) {
  ({ normalizeUnified } = require('./src/unified-normalizer'));
  ({ tokenize } = require('./src/unified-tokenizer'));
  ({ detectScheduleParseState } = require('./src/schedule-candidates'));
}

// Run queries
const allResults = {};

for (const query of queries) {
  const results = getSuggestions(query, options);

  if (jsonOutput) {
    allResults[query] = results;
    continue;
  }

  const bar = '='.repeat(60);
  console.log(`\n${bar}`);
  console.log(`  Query: "${query}"`);
  console.log(`  Mode: ${mode} | Limit: ${limit} | Min Score: ${minScore}`);
  console.log(bar);

  if (verbose) {
    const { norm } = normalizeUnified(query);
    const tokens = tokenize(norm);
    const parseState = detectScheduleParseState(tokens, norm);
    console.log(`  Normalized: "${norm}"`);
    console.log(`  Tokens: ${tokens.map(t => `${t.type}:${t.text}`).join(', ')}`);
    console.log(`  Parse State: ${parseState.state}`);
    if (parseState.partialToken) {
      console.log(`  Partial Token: "${parseState.partialToken}"`);
    }
    if (parseState.context.interval) {
      console.log(`  Interval: every ${parseState.context.interval.count} ${parseState.context.interval.unit}(s)`);
    }
    if (parseState.context.weekdays.length) {
      console.log(`  Weekdays: ${parseState.context.weekdays.join(', ')}`);
    }
    console.log('');
  }

  if (results.length === 0) {
    console.log('  (no results)\n');
    continue;
  }

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const typeTag = r.type === 'schedule' ? 'SCHED' : 'DTIME';
    const scoreStr = r.score.toFixed(3);
    console.log(`  ${i + 1}. [${typeTag}] ${r.label}`);
    console.log(`     Score: ${scoreStr} | Source: ${r.source}`);
    if (includeValue && r.value) {
      console.log(`     Value: ${JSON.stringify(r.value)}`);
    }
  }
  console.log('');
}

if (jsonOutput) {
  console.log(JSON.stringify(allResults, null, 2));
}

// Summary
if (!jsonOutput && queries.length > 1) {
  console.log('='.repeat(60));
  console.log('  SUMMARY');
  console.log('='.repeat(60));
  let totalResults = 0;
  let totalEmpty = 0;
  for (const query of queries) {
    const results = getSuggestions(query, options);
    totalResults += results.length;
    if (results.length === 0) totalEmpty++;
  }
  console.log(`  Queries: ${queries.length}`);
  console.log(`  Total results: ${totalResults}`);
  console.log(`  Queries with no results: ${totalEmpty}`);
  console.log('');
}
