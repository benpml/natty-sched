/**
 * Parse-state-driven schedule candidate generation.
 * Analyzes the token stream to determine what the user is typing
 * and generates valid completion candidates.
 */

const {
  WEEKDAYS, WEEKDAY_LOOKUP, MONTHS, MONTH_LOOKUP,
  UNIT_CANON, UNIT_WORDS, CANON_UNITS,
  NAMED_TIMES, TIME_BUCKETS, TIME_BUCKET_KEYS,
  COMMON_TIMES, SCHEDULE_KEYWORDS, ORDINAL_WORDS
} = require('./shared-constants');
const { getAllTemplates } = require('./autocomplete-templates');
const { normalizeUnified, normalizeForScheduleMatch, endsWithIncompletePhrase, endsWithAt } = require('./unified-normalizer');

const WEEKDAY_SHORT = ['sun','mon','tue','wed','thu','fri','sat'];

/**
 * Detect what parse state we're in based on the token stream.
 * Returns the state name, expected next tokens, and any partial token.
 */
function detectScheduleParseState(tokens, normInput) {
  const ctx = {
    hasEvery: false, hasOn: false, hasAt: false, hasExcept: false,
    interval: null, weekdays: [], time: null,
    ordinal: null, monthDay: null, isComplete: false
  };

  if (!tokens.length) {
    return { state: 'empty', expected: [], partialToken: null, context: ctx };
  }

  let i = 0;
  const first = tokens[0];

  // ----- PARTIAL KEYWORD at start: "ev", "dai", "wee", "hou", etc. -----
  if (first.type === 'word' && tokens.length === 1) {
    const w = first.text;
    const schedKws = ['every','daily','weekly','monthly','quarterly','yearly','annually',
                      'hourly','weekdays','weekday','weekends','weekend','biweekly'];
    const matches = schedKws.filter(k => k.startsWith(w) && k !== w);
    if (matches.length) {
      return { state: 'partial_schedule_kw', expected: [{ kind: 'schedule_keyword', options: matches }],
               partialToken: w, context: ctx };
    }
  }

  // ----- "every ..." -----
  if (first.type === 'kw' && first.text === 'every') {
    ctx.hasEvery = true;
    i = 1;

    if (!tokens[i]) {
      return { state: 'every', expected: [
        { kind: 'unit', options: CANON_UNITS },
        { kind: 'weekday' },
        { kind: 'modifier', options: ['other','weekday','weekend','business'] }
      ], partialToken: null, context: ctx };
    }

    // "every other ..."
    if (tokens[i].type === 'kw' && tokens[i].text === 'other') {
      i++;
      if (!tokens[i]) {
        return { state: 'every_other', expected: [
          { kind: 'unit', options: ['day','week','month','year'] },
          { kind: 'weekday' }
        ], partialToken: null, context: ctx };
      }
      // "every other" + unit/weekday: set interval count=2 and continue
      if (tokens[i].type === 'unit') {
        ctx.interval = { count: 2, unit: tokens[i].value };
        i++;
      } else if (tokens[i].type === 'weekday') {
        ctx.interval = { count: 2, unit: 'week' };
        ctx.weekdays.push(WEEKDAY_SHORT[tokens[i].value]);
        i++;
      } else if (tokens[i].type === 'word') {
        return checkPartialTokenAt(tokens, i, ctx);
      }
    }

    // "every N ..."
    else if (tokens[i].type === 'number') {
      const count = tokens[i].value;
      i++;
      if (!tokens[i]) {
        return { state: 'every_N', expected: [
          { kind: 'unit', options: CANON_UNITS }
        ], partialToken: null, context: ctx };
      }
      if (tokens[i].type === 'word') {
        const partial = tokens[i].text;
        const unitMatches = UNIT_WORDS.filter(u => u.startsWith(partial));
        if (unitMatches.length) {
          return { state: 'partial_unit', expected: [
            { kind: 'unit', options: [...new Set(unitMatches.map(u => UNIT_CANON[u]))] }
          ], partialToken: partial, context: ctx };
        }
      }
      if (tokens[i].type === 'unit') {
        ctx.interval = { count, unit: tokens[i].value };
        i++;
      }
    }

    // "every weekday/weekend/business ..."
    else if (tokens[i].type === 'kw' && ['weekday','weekdays','weekend','weekends','business'].includes(tokens[i].text)) {
      const kw = tokens[i].text;
      i++;
      // "every business day"
      if (kw === 'business') {
        if (tokens[i]?.text === 'day' || tokens[i]?.text === 'days') i++;
      }
      ctx.interval = { count: 1, unit: 'week' };
      ctx.weekdays = kw.startsWith('weekend')
        ? ['sat','sun']
        : ['mon','tue','wed','thu','fri'];
    }

    // "every day/week/month/year"
    else if (tokens[i].type === 'unit') {
      ctx.interval = { count: 1, unit: tokens[i].value };
      i++;
    }
    else if (tokens[i].type === 'kw' && ['day','week','month','year'].includes(tokens[i].text)) {
      ctx.interval = { count: 1, unit: tokens[i].text };
      i++;
    }

    // "every monday/tuesday/..."
    else if (tokens[i].type === 'weekday') {
      ctx.interval = { count: 1, unit: 'week' };
      ctx.weekdays.push(WEEKDAY_SHORT[tokens[i].value]);
      i++;
    }

    // "every quarter"
    else if (tokens[i].type === 'kw' && tokens[i].text === 'quarterly') {
      ctx.interval = { count: 3, unit: 'month' };
      i++;
    }

    // "every first/last/second <weekday> of the month"
    else if (tokens[i].type === 'ordinal_word') {
      ctx.ordinal = tokens[i].value;
      i++;
      if (tokens[i]?.type === 'weekday') {
        ctx.weekdays.push(WEEKDAY_SHORT[tokens[i].value]);
        i++;
        ctx.interval = { count: 1, unit: 'month' };
        // skip "of the month" / "of every month"
        while (tokens[i] && ['of','the','every','month'].includes(tokens[i].text)) i++;
      } else if (!tokens[i]) {
        return { state: 'ordinal_needs_weekday', expected: [{ kind: 'weekday' }],
                 partialToken: null, context: ctx };
      }
    }

    // partial word after "every"
    else if (tokens[i].type === 'word') {
      return checkPartialTokenAt(tokens, i, ctx);
    }
  }

  // ----- "once"/"twice" patterns: "once day" -> "every day", "twice week on mon and thu" -----
  else if (first.type === 'kw' && (first.text === 'once' || first.text === 'twice')) {
    ctx.hasEvery = true;
    const freq = first.text;
    i = 1;
    if (tokens[i]?.type === 'unit') {
      if (freq === 'once') {
        ctx.interval = { count: 1, unit: tokens[i].value };
      } else {
        // "twice day" = every 12 hours, "twice week" = 2x/week, "twice month" = 2x/month
        // For candidate generation, map to the base interval
        ctx.interval = { count: 1, unit: tokens[i].value };
      }
      i++;
    }
  }

  // ----- Shorthand keywords: daily, weekly, monthly, etc. -----
  else if (first.type === 'kw' && ['daily','weekly','monthly','quarterly','yearly','annually','hourly','biweekly'].includes(first.text)) {
    ctx.hasEvery = true;
    const map = {
      daily: { count: 1, unit: 'day' },
      weekly: { count: 1, unit: 'week' },
      monthly: { count: 1, unit: 'month' },
      quarterly: { count: 3, unit: 'month' },
      yearly: { count: 1, unit: 'year' },
      annually: { count: 1, unit: 'year' },
      hourly: { count: 1, unit: 'hour' },
      biweekly: { count: 2, unit: 'week' }
    };
    ctx.interval = map[first.text];
    i = 1;
  }

  // ----- "weekdays/weekends" standalone -----
  else if (first.type === 'kw' && ['weekdays','weekday','weekends','weekend'].includes(first.text)) {
    ctx.hasEvery = true;
    ctx.interval = { count: 1, unit: 'week' };
    ctx.weekdays = first.text.startsWith('weekend') ? ['sat','sun'] : ['mon','tue','wed','thu','fri'];
    i = 1;
  }

  // ----- "business days" -----
  else if (first.type === 'kw' && first.text === 'business') {
    ctx.hasEvery = true;
    ctx.interval = { count: 1, unit: 'week' };
    ctx.weekdays = ['mon','tue','wed','thu','fri'];
    i = 1;
    if (tokens[i]?.text === 'day' || tokens[i]?.text === 'days') i++;
  }

  // ----- Ordinal weekday: "first monday of the month" -----
  else if (first.type === 'ordinal_word') {
    ctx.ordinal = first.value;
    i = 1;
    if (tokens[i]?.type === 'weekday') {
      ctx.weekdays.push(WEEKDAY_SHORT[tokens[i].value]);
      i++;
      ctx.interval = { count: 1, unit: 'month' };
      // skip "of the month" / "of every month"
      while (tokens[i] && ['of','the','every','month'].includes(tokens[i].text)) i++;
    } else if (tokens[i]?.type === 'word') {
      return checkPartialTokenAt(tokens, i, ctx);
    } else if (!tokens[i]) {
      return { state: 'ordinal_needs_weekday', expected: [{ kind: 'weekday' }],
               partialToken: null, context: ctx };
    }
  }

  // ----- Plural weekday names: "mondays", "tuesdays and thursdays" -----
  else if (first.type === 'weekday') {
    // Check if the raw input had a plural 's' - indicates schedule not datetime
    const rawFirst = normInput.split(/\s+/)[0] || '';
    if (rawFirst.endsWith('s') && rawFirst.length > 3) {
      ctx.hasEvery = true;
      ctx.interval = { count: 1, unit: 'week' };
      ctx.weekdays.push(WEEKDAY_SHORT[first.value]);
      i = 1;
    }
  }

  // ----- "on mondays" / "on the 1st" / "on weekdays" -----
  else if (first.type === 'kw' && first.text === 'on') {
    i = 1;
    ctx.hasOn = true;
    if (!tokens[i]) {
      return { state: 'on_what', expected: [
        { kind: 'weekday' }, { kind: 'the_nth' }, { kind: 'weekday_set' }
      ], partialToken: null, context: ctx };
    }

    if (tokens[i].type === 'kw' && tokens[i].text === 'the') {
      i++;
      // "on the 1st", "on the last day"
      if (!tokens[i]) {
        return { state: 'on_the_what', expected: [
          { kind: 'month_day' }, { kind: 'ordinal_weekday' }
        ], partialToken: null, context: ctx };
      }
    }

    if (tokens[i]?.type === 'kw' && ['weekdays','weekday','weekends','weekend'].includes(tokens[i].text)) {
      ctx.hasEvery = true;
      ctx.interval = { count: 1, unit: 'week' };
      ctx.weekdays = tokens[i].text.startsWith('weekend') ? ['sat','sun'] : ['mon','tue','wed','thu','fri'];
      i++;
    } else if (tokens[i]?.type === 'weekday') {
      ctx.hasEvery = true;
      ctx.interval = { count: 1, unit: 'week' };
      ctx.weekdays.push(WEEKDAY_SHORT[tokens[i].value]);
      i++;
    } else if (tokens[i]?.type === 'number') {
      // "on the 1st" / "on the 15th" -> monthly
      ctx.hasEvery = true;
      ctx.interval = { count: 1, unit: 'month' };
      ctx.monthDay = tokens[i].value;
      i++;
    } else if (tokens[i]?.type === 'ordinal_word') {
      // "on the first" -> needs more context
      ctx.ordinal = tokens[i].value;
      i++;
    } else if (tokens[i]?.type === 'word') {
      return checkPartialTokenAt(tokens, i, ctx);
    }
  }

  // ----- Time-first: "at 9 am every day", "9am every monday" -----
  else if ((first.type === 'kw' && first.text === 'at') ||
           (first.type === 'number' && tokens[1]?.type === 'meridiem')) {
    // Skip through the time part to find schedule keywords after
    let j = 0;
    if (first.type === 'kw' && first.text === 'at') j = 1;
    // skip number, colon, number, meridiem
    while (j < tokens.length && (tokens[j].type === 'number' || tokens[j].type === 'punct' || tokens[j].type === 'meridiem')) j++;
    // Look for schedule keyword after time
    if (tokens[j]?.type === 'kw' && SCHEDULE_KEYWORDS.has(tokens[j].text)) {
      // This is a time-first schedule pattern
      ctx.hasAt = true;
      // We don't need to fully parse time here - the candidate text will be validated by the parser
      return { state: 'time_first_schedule', expected: [],
               partialToken: null, context: ctx };
    }
    // Also handle "on" + weekday after time: "at 5 pm on friday"
    if (tokens[j]?.type === 'kw' && tokens[j].text === 'on') {
      let k = j + 1;
      if (tokens[k]?.type === 'weekday') {
        ctx.hasAt = true;
        ctx.hasEvery = true;
        ctx.hasOn = true;
        ctx.interval = { count: 1, unit: 'week' };
        ctx.weekdays.push(WEEKDAY_SHORT[tokens[k].value]);
        k++;
        // Pick up additional weekdays with "and"
        while (k < tokens.length) {
          if (tokens[k]?.type === 'kw' && tokens[k].text === 'and') { k++; continue; }
          if (tokens[k]?.type === 'weekday') { ctx.weekdays.push(WEEKDAY_SHORT[tokens[k].value]); k++; continue; }
          break;
        }
        ctx.time = 'explicit';
        ctx.isComplete = true;
        return { state: 'complete', expected: [], partialToken: null, context: ctx };
      }
    }
  }

  // ----- After parsing the head, detect what comes next -----

  // Handle "and" for multi-weekday: "monday and ..."
  while (i < tokens.length && tokens[i]?.type === 'kw' && tokens[i].text === 'and' && ctx.weekdays.length > 0) {
    // skip conjunctions between weekdays
    // Handle "monday and wednesday" or "monday, wednesday"
    i++;
    // skip comma after "and"
    if (tokens[i]?.type === 'punct' && tokens[i].text === ',') i++;
  }
  // Handle comma-separated weekdays: "monday, wednesday, friday"
  while (i < tokens.length && tokens[i]?.type === 'punct' && tokens[i].text === ',' && ctx.weekdays.length > 0) {
    i++;
  }
  // Pick up additional weekdays
  while (i < tokens.length && tokens[i]?.type === 'weekday') {
    ctx.weekdays.push(WEEKDAY_SHORT[tokens[i].value]);
    i++;
    // skip conjunction/comma
    if (tokens[i]?.type === 'kw' && tokens[i].text === 'and') i++;
    if (tokens[i]?.type === 'punct' && tokens[i].text === ',') i++;
  }

  // If we picked up weekdays but haven't determined an interval, infer weekly recurrence
  if (ctx.weekdays.length > 0 && !ctx.interval) {
    ctx.hasEvery = true;
    ctx.interval = { count: 1, unit: 'week' };
  }

  // "except" clause
  if (tokens[i]?.type === 'kw' && tokens[i].text === 'except') {
    ctx.hasExcept = true;
    i++;
    // skip "for" in "except for"
    if (tokens[i]?.type === 'kw' && tokens[i].text === 'for') i++;
    if (!tokens[i]) {
      return { state: 'except_what', expected: [{ kind: 'weekday' }],
               partialToken: null, context: ctx };
    }
    // Consume excepted weekdays
    while (i < tokens.length && tokens[i]?.type === 'weekday') {
      i++;
      if (tokens[i]?.type === 'kw' && tokens[i].text === 'and') i++;
      if (tokens[i]?.type === 'punct' && tokens[i].text === ',') i++;
    }
    if (tokens[i]?.type === 'word') {
      return checkPartialTokenAt(tokens, i, ctx);
    }
  }

  // "on" clause for weekly/monthly
  if (tokens[i]?.type === 'kw' && tokens[i].text === 'on') {
    ctx.hasOn = true;
    i++;
    if (!tokens[i]) {
      if (ctx.interval?.unit === 'month') {
        return { state: 'monthly_on', expected: [
          { kind: 'the_nth' }, { kind: 'ordinal_weekday' }
        ], partialToken: null, context: ctx };
      }
      return { state: 'on_what', expected: [
        { kind: 'weekday' }
      ], partialToken: null, context: ctx };
    }

    // "on the ..."
    if (tokens[i].type === 'kw' && tokens[i].text === 'the') {
      i++;
      if (!tokens[i]) {
        return { state: 'monthly_on_the', expected: [
          { kind: 'month_day' }, { kind: 'ordinal_weekday' }, { kind: 'last_day' }
        ], partialToken: null, context: ctx };
      }
      if (tokens[i].type === 'number') {
        ctx.monthDay = tokens[i].value;
        i++;
      } else if (tokens[i].type === 'ordinal_word') {
        ctx.ordinal = tokens[i].value;
        i++;
        // "on the first ..." could need weekday or "day"
        if (tokens[i]?.type === 'weekday') {
          ctx.weekdays.push(WEEKDAY_SHORT[tokens[i].value]);
          i++;
        }
      } else if (tokens[i].type === 'kw' && tokens[i].text === 'last') {
        ctx.monthDay = 'last';
        i++;
        // skip "day" or "day of the month"
        while (tokens[i] && ['day','of','the','month'].includes(tokens[i].text)) i++;
      }
    }

    // Weekday after "on"
    else if (tokens[i].type === 'weekday') {
      ctx.weekdays.push(WEEKDAY_SHORT[tokens[i].value]);
      i++;
      // Pick up additional weekdays after "on"
      while (i < tokens.length) {
        if (tokens[i]?.type === 'kw' && tokens[i].text === 'and') { i++; continue; }
        if (tokens[i]?.type === 'punct' && tokens[i].text === ',') { i++; continue; }
        if (tokens[i]?.type === 'weekday') {
          ctx.weekdays.push(WEEKDAY_SHORT[tokens[i].value]);
          i++;
          continue;
        }
        break;
      }
    }

    // Month name for yearly: "on march 1"
    else if (tokens[i].type === 'month') {
      i++;
      if (tokens[i]?.type === 'number') i++;
    }

    // day number: "on day 1"
    else if (tokens[i].type === 'kw' && tokens[i].text === 'day') {
      i++;
      if (tokens[i]?.type === 'number') {
        ctx.monthDay = tokens[i].value;
        i++;
      }
    }

    else if (tokens[i].type === 'word') {
      return checkPartialTokenAt(tokens, i, ctx);
    }
  }

  // "starting" clause - skip it, parser handles this
  if (tokens[i]?.type === 'kw' && tokens[i].text === 'starting') {
    // skip "starting tomorrow at 8 am" etc.
    while (i < tokens.length) i++;
  }

  // "until" clause - skip it, parser handles this
  if (tokens[i]?.type === 'kw' && tokens[i].text === 'until') {
    while (i < tokens.length) i++;
  }

  // "at" clause
  if (tokens[i]?.type === 'kw' && tokens[i].text === 'at') {
    ctx.hasAt = true;
    i++;
    if (!tokens[i]) {
      return { state: 'at_partial', expected: [{ kind: 'time' }],
               partialToken: null, context: ctx };
    }
    // Named time
    if (tokens[i].type === 'kw' && NAMED_TIMES[tokens[i].text]) {
      ctx.time = tokens[i].text;
      i++;
    }
    // Numeric time
    else if (tokens[i].type === 'number') {
      const hour = tokens[i].value;
      i++;
      // Check for colon
      if (tokens[i]?.type === 'punct' && tokens[i].text === ':') {
        i++;
        if (tokens[i]?.type === 'number') i++;
      }
      // Check for meridiem
      if (tokens[i]?.type === 'meridiem') {
        ctx.time = 'explicit';
        i++;
      } else if (hour >= 1 && hour <= 12 && !tokens[i]) {
        // Bare hour: "at 8" - needs AM/PM
        return { state: 'at_hour', expected: [{ kind: 'meridiem' }],
                 hour, partialToken: null, context: ctx };
      } else {
        ctx.time = 'explicit';
      }
    }
    // Partial word after "at": "at no" -> "at noon"
    else if (tokens[i].type === 'word') {
      const partial = tokens[i].text;
      const namedMatches = Object.keys(NAMED_TIMES).filter(n => n.startsWith(partial));
      if (namedMatches.length) {
        return { state: 'partial_named_time', expected: [
          { kind: 'named_time', options: namedMatches }
        ], partialToken: partial, context: ctx };
      }
    }
  }

  // Time buckets without "at": "every day morning", "every day afternoon"
  if (tokens[i]?.type === 'kw' && TIME_BUCKETS[tokens[i].text]) {
    ctx.hasAt = true;
    ctx.time = tokens[i].text;
    i++;
  }

  // Partial time bucket: "every day aftern"
  if (tokens[i]?.type === 'word') {
    const partial = tokens[i].text;
    const bucketMatches = TIME_BUCKET_KEYS.filter(b => b.startsWith(partial));
    if (bucketMatches.length && ctx.interval) {
      return { state: 'partial_bucket', expected: [
        { kind: 'time_bucket', options: bucketMatches }
      ], partialToken: partial, context: ctx };
    }
    // Could also be a partial weekday or unit
    return checkPartialTokenAt(tokens, i, ctx);
  }

  // Check for "and" at end for multi-weekday continuation
  if (tokens[i]?.type === 'kw' && tokens[i].text === 'and' && ctx.weekdays.length > 0) {
    return { state: 'and_weekday', expected: [{ kind: 'weekday' }],
             partialToken: null, context: ctx };
  }

  // Determine completeness
  if (i >= tokens.length && ctx.interval) {
    const needsTime = ctx.interval.unit !== 'minute' && ctx.interval.unit !== 'hour';
    if (!ctx.hasAt && needsTime) {
      return { state: 'needs_time', expected: [{ kind: 'at_time' }],
               partialToken: null, context: ctx };
    }
    if (ctx.interval.unit === 'week' && !ctx.weekdays.length && !ctx.hasOn && !ctx.monthDay) {
      return { state: 'needs_on_or_time', expected: [
        { kind: 'on_weekday' }, { kind: 'at_time' }
      ], partialToken: null, context: ctx };
    }
    ctx.isComplete = true;
    return { state: 'complete', expected: [], partialToken: null, context: ctx };
  }

  return { state: 'unknown', expected: [], partialToken: null, context: ctx };
}

/**
 * Check if the token at position i is a partial weekday, month, unit, or bucket.
 */
function checkPartialTokenAt(tokens, i, ctx) {
  const partial = tokens[i].text;
  const weekdayMatches = WEEKDAYS.filter(d => d.startsWith(partial) && d !== partial);
  const unitMatches = UNIT_WORDS.filter(u => u.startsWith(partial) && u !== partial);
  const bucketMatches = TIME_BUCKET_KEYS.filter(b => b.startsWith(partial) && b !== partial);
  const monthMatches = MONTHS.filter(m => m.startsWith(partial) && m !== partial);

  if (weekdayMatches.length) {
    return { state: 'partial_weekday', expected: [
      { kind: 'weekday', options: weekdayMatches }
    ], partialToken: partial, context: ctx };
  }
  if (unitMatches.length) {
    return { state: 'partial_unit', expected: [
      { kind: 'unit', options: [...new Set(unitMatches.map(u => UNIT_CANON[u]))] }
    ], partialToken: partial, context: ctx };
  }
  if (monthMatches.length) {
    return { state: 'partial_month', expected: [
      { kind: 'month', options: monthMatches }
    ], partialToken: partial, context: ctx };
  }
  if (bucketMatches.length && ctx.interval) {
    return { state: 'partial_bucket', expected: [
      { kind: 'time_bucket', options: bucketMatches }
    ], partialToken: partial, context: ctx };
  }

  // Check schedule keyword partials
  const schedKws = ['every','daily','weekly','monthly','quarterly','yearly','annually',
                    'hourly','weekdays','weekday','weekends','weekend','biweekly',
                    'except','other','business'];
  const kwMatches = schedKws.filter(k => k.startsWith(partial) && k !== partial);
  if (kwMatches.length) {
    return { state: 'partial_schedule_kw', expected: [
      { kind: 'schedule_keyword', options: kwMatches }
    ], partialToken: partial, context: ctx };
  }

  return { state: 'unknown', expected: [], partialToken: partial, context: ctx };
}

function replaceLastWord(text, replacement) {
  const parts = text.trim().split(/\s+/);
  parts[parts.length - 1] = replacement;
  return parts.join(' ');
}

function topTimes(n) {
  return COMMON_TIMES.slice(0, n);
}

/**
 * Generate schedule candidate strings from parse state + templates.
 *
 * @param {string} normInput - Normalized input string
 * @param {Array} tokens - Token array from unified tokenizer
 * @param {object} options
 * @returns {Array<{text: string, source: string, popularity: number}>}
 */
function generateScheduleCandidates(normInput, tokens, options = {}) {
  const out = new Map(); // text -> {source, popularity}
  const add = (text, source, popularity) => {
    const t = text.trim();
    if (!t) return;
    if (!out.has(t) || out.get(t).popularity < popularity) {
      out.set(t, { source, popularity });
    }
  };

  const parseState = detectScheduleParseState(tokens, normInput);
  const { state, expected, partialToken, context } = parseState;

  // ----- Template prefix matching -----
  const templates = getAllTemplates();
  const normLower = normInput.toLowerCase();
  const schedNorm = normalizeForScheduleMatch(normInput);
  for (const tmpl of templates) {
    const tmplNorm = normalizeForScheduleMatch(tmpl.input);
    if (tmplNorm.startsWith(schedNorm) || tmplNorm.startsWith(normLower)) {
      add(tmpl.input.toLowerCase(), 'template', tmpl.popularity || 5);
    }
  }

  // ----- Fallback: include normInput if state is unknown/time_first_schedule but input is non-empty -----
  // The parser may handle patterns we don't explicitly detect (e.g., "9:00 am every day", "the 1 of every month")
  if (normInput && (state === 'unknown' || state === 'time_first_schedule')) {
    add(normInput, 'parse_state', 8);
  }

  // ----- Always include the input itself as a candidate if it looks like a schedule -----
  if (normInput && context.interval) {
    add(normInput, 'parse_state', 9);
    // Generate the canonical "every" form for inputs without "every"
    if (!normInput.startsWith('every ')) {
      const isOnceTwice = /^(once|twice)\b/.test(normInput);
      if (isOnceTwice) {
        // For once/twice patterns: "once day" -> "every day", "twice day" -> "every 12 hours"
        if (normInput.startsWith('once')) {
          const rest = normInput.replace(/^once\s+/, '');
          add('every ' + rest, 'parse_state', 9);
        } else {
          const unit = context.interval.unit;
          if (unit === 'day') {
            add('every 12 hours', 'parse_state', 9);
          } else if (unit === 'week' && context.weekdays.length > 0) {
            const wdNames = context.weekdays.map(w => WEEKDAYS[WEEKDAY_SHORT.indexOf(w)]);
            add('every ' + wdNames.join(' and '), 'parse_state', 9);
          } else if (unit === 'week') {
            // "twice week" without specific days
            add('every 3 days', 'parse_state', 8);
          } else if (unit === 'month') {
            add('every 2 weeks', 'parse_state', 8);
          }
        }
      } else if (context.weekdays.length > 0) {
        const wdNames = context.weekdays.map(w => WEEKDAYS[WEEKDAY_SHORT.indexOf(w)]);
        const wdStr = wdNames.join(' and ');
        // For time-first patterns like "at 5 pm on friday", rearrange to "every friday at 5 pm"
        const atMatch = normInput.match(/^at\s+(.+?)\s+on\s+/);
        if (atMatch) {
          add(`every ${wdStr} at ${atMatch[1]}`, 'parse_state', 9);
        } else {
          const stripped = normInput.replace(/^on\s+/, '');
          // "weekdays"/"weekends"/"business day" already imply recurrence
          const impliesRec = /^(weekdays?|weekends?|business\s+day)\b/.test(stripped);
          if (!impliesRec) {
            add('every ' + stripped, 'parse_state', 9);
          }
        }
      }
    }
  }

  // ----- Parse-state-driven generation -----

  if (state === 'empty') {
    // Popular seeds
    const seeds = [
      'every day at 9:00 am', 'every weekday at 9:00 am',
      'every monday at 9:00 am', 'daily at 9:00 am',
      'weekly on monday at 9:00 am', 'monthly on the 1 at 9:00 am'
    ];
    seeds.forEach(s => add(s, 'parse_state', 8));
  }

  if (state === 'partial_schedule_kw') {
    const options_ = expected[0]?.options || [];
    for (const kw of options_) {
      add(kw, 'parse_state', 7);
      // Also generate complete suggestions for the keyword
      if (kw === 'every') {
        for (const u of ['day','week','month','year']) add(`every ${u}`, 'parse_state', 6);
      } else if (kw === 'daily' || kw === 'weekly' || kw === 'monthly') {
        for (const time of topTimes(3)) add(`${kw} at ${time.toLowerCase()}`, 'parse_state', 6);
      }
    }
  }

  if (state === 'every') {
    // Complete with all possible next tokens
    for (const u of CANON_UNITS) add(`every ${u}`, 'parse_state', 7);
    for (const wd of WEEKDAYS) add(`every ${wd}`, 'parse_state', 7);
    add('every other day', 'parse_state', 6);
    add('every other week', 'parse_state', 6);
    add('every weekday', 'parse_state', 7);
    add('every weekend', 'parse_state', 6);
    add('every business day', 'parse_state', 6);
    for (const n of ['2','3','4','5']) {
      for (const u of ['days','weeks','months','hours']) {
        add(`every ${n} ${u}`, 'parse_state', 5);
      }
    }
  }

  if (state === 'every_other') {
    for (const u of ['day','week','month','year']) add(`every other ${u}`, 'parse_state', 7);
    for (const wd of WEEKDAYS) add(`every other ${wd}`, 'parse_state', 6);
  }

  if (state === 'every_N') {
    const m = normInput.match(/^every\s+(\d+)$/);
    if (m) {
      const n = m[1];
      for (const u of ['days','weeks','months','years','hours','minutes']) {
        add(`every ${n} ${u}`, 'parse_state', 7);
      }
    }
  }

  if (state === 'partial_unit') {
    const base = normInput.slice(0, normInput.lastIndexOf(partialToken));
    const opts = expected[0]?.options || [];
    for (const unit of opts) {
      const pluralUnit = normInput.match(/\d+/) ? unit + 's' : unit;
      add(`${base}${pluralUnit}`, 'parse_state', 8);
      // Also add with time
      for (const time of topTimes(2)) {
        add(`${base}${pluralUnit} at ${time.toLowerCase()}`, 'parse_state', 7);
      }
    }
  }

  if (state === 'partial_weekday') {
    const base = normInput.slice(0, normInput.lastIndexOf(partialToken));
    const opts = expected[0]?.options || [];
    for (const wd of opts) {
      add(`${base}${wd}`, 'parse_state', 8);
      for (const time of topTimes(2)) {
        add(`${base}${wd} at ${time.toLowerCase()}`, 'parse_state', 7);
      }
    }
  }

  if (state === 'partial_month') {
    const base = normInput.slice(0, normInput.lastIndexOf(partialToken));
    const opts = expected[0]?.options || [];
    for (const mo of opts) {
      add(`${base}${mo}`, 'parse_state', 7);
      for (const day of [1, 15]) {
        add(`${base}${mo} ${day}`, 'parse_state', 6);
      }
    }
  }

  if (state === 'partial_bucket') {
    const base = normInput.slice(0, normInput.lastIndexOf(partialToken));
    const opts = expected[0]?.options || [];
    for (const bucket of opts) {
      add(`${base}${bucket}`, 'parse_state', 8);
    }
  }

  if (state === 'needs_time' || state === 'needs_on_or_time') {
    // Use "every" form as base for candidates that need to parse
    let base = normInput.replace(/^on\s+/, '');
    // "weekdays", "weekends", "business day" already imply recurrence - don't prepend "every"
    const impliesRecurrence = /^(weekdays?|weekends?|business\s+day)\b/.test(base);
    if (!impliesRecurrence && !base.startsWith('every ')) {
      base = 'every ' + base;
    }
    // Ensure "business" has "day" appended for the parser
    if (/\bbusiness\s*$/.test(base)) base += ' day';
    // Append times
    for (const time of topTimes(6)) {
      add(`${base} at ${time.toLowerCase()}`, 'parse_state', 7);
    }
    add(`${base} at noon`, 'parse_state', 6);
    add(`${base} at midnight`, 'parse_state', 5);
    for (const bucket of ['morning','afternoon','evening','night']) {
      add(`${base} ${bucket}`, 'parse_state', 5);
    }
  }

  if (state === 'needs_on_or_time') {
    // Also suggest weekday completions for "every week"
    let base2 = normInput.replace(/^on\s+/, '');
    if (!base2.startsWith('every ') && !/^(weekdays?|weekends?|business\s+day)\b/.test(base2)) {
      base2 = 'every ' + base2;
    }
    for (const wd of WEEKDAYS) {
      add(`${base2} on ${wd}`, 'parse_state', 6);
      add(`${base2} on ${wd} at ${topTimes(1)[0].toLowerCase()}`, 'parse_state', 5);
    }
  }

  if (state === 'at_partial') {
    for (const time of topTimes(8)) {
      add(`${normInput} ${time.toLowerCase()}`, 'parse_state', 8);
    }
    add(`${normInput} noon`, 'parse_state', 7);
    add(`${normInput} midnight`, 'parse_state', 6);
  }

  if (state === 'at_hour') {
    const hour = parseState.hour;
    if (hour != null) {
      // Strip trailing colon from input like "at 3:" before generating candidates
      const hourBase = normInput.replace(/:+\s*$/, '');
      for (const p of ['am', 'pm']) {
        add(`${hourBase} ${p}`, 'parse_state', 8);
        for (const min of ['00','15','30','45']) {
          add(`${hourBase}:${min} ${p}`, 'parse_state', 7);
        }
      }
    }
  }

  if (state === 'partial_named_time') {
    const base = normInput.slice(0, normInput.lastIndexOf(partialToken));
    const opts = expected[0]?.options || [];
    for (const name of opts) {
      add(`${base}${name}`, 'parse_state', 8);
    }
  }

  if (state === 'on_what' || state === 'monthly_on') {
    if (context.interval?.unit === 'month' || state === 'monthly_on') {
      add(`${normInput} the 1`, 'parse_state', 7);
      add(`${normInput} the 15`, 'parse_state', 7);
      add(`${normInput} the last day`, 'parse_state', 6);
      for (const ord of ['first','second','third','last']) {
        for (const wd of ['monday','tuesday','wednesday','friday']) {
          add(`${normInput} ${ord} ${wd} of the month`, 'parse_state', 5);
        }
      }
      add(`${normInput} day 1`, 'parse_state', 5);
    } else {
      for (const wd of WEEKDAYS) {
        add(`${normInput} ${wd}`, 'parse_state', 7);
      }
    }
  }

  if (state === 'on_the_what' || state === 'monthly_on_the') {
    for (const d of [1, 5, 10, 15, 20, 25]) {
      add(`${normInput} ${d}`, 'parse_state', 7);
    }
    add(`${normInput} last day`, 'parse_state', 7);
    for (const ord of ['first','last']) {
      add(`${normInput} ${ord} monday of the month`, 'parse_state', 5);
    }
  }

  if (state === 'ordinal_needs_weekday') {
    for (const wd of WEEKDAYS.slice(1, 6)) { // mon-fri
      add(`${normInput} ${wd} of the month`, 'parse_state', 7);
    }
  }

  if (state === 'except_what') {
    const mentioned = new Set(context.weekdays);
    const available = WEEKDAYS.filter(d => !mentioned.has(WEEKDAY_SHORT[WEEKDAY_LOOKUP[d]]));
    for (const wd of available.slice(0, 5)) {
      add(`${normInput} ${wd}`, 'parse_state', 7);
    }
  }

  if (state === 'and_weekday') {
    const mentioned = new Set(context.weekdays);
    const available = WEEKDAYS.filter(d => !mentioned.has(WEEKDAY_SHORT[WEEKDAY_LOOKUP[d]]));
    for (const wd of available.slice(0, 5)) {
      add(`${normInput} ${wd}`, 'parse_state', 7);
    }
  }

  if (state === 'time_first_schedule') {
    // The input already has time + schedule keyword, suggest completions
    // Templates should cover these; just make sure we have some
    if (normInput.includes('every')) {
      for (const u of ['day','weekday','week']) {
        if (!normInput.includes(u)) {
          add(`${normInput} ${u}`, 'parse_state', 6);
        }
      }
    }
  }

  // Convert map to array
  return Array.from(out.entries()).map(([text, meta]) => ({
    text,
    source: meta.source,
    popularity: meta.popularity
  }));
}

/**
 * Generate inferred recurrence from ambiguous datetime inputs.
 * "monday at 9 am" -> "every monday at 9:00 am"
 * "at 9 am" -> "every day at 9:00 am"
 */
function generateInferredRecurrence(normInput, tokens) {
  const out = [];

  // Pattern 1: bare weekday (+ optional time) -> "every <weekday> [at time]"
  if (tokens[0]?.type === 'weekday') {
    const weekday = WEEKDAYS[tokens[0].value];
    const rest = normInput.slice(tokens[0].end).trim();
    if (rest) {
      out.push({ text: `every ${weekday} ${rest}`, source: 'inferred', popularity: 5 });
    } else {
      for (const time of topTimes(3)) {
        out.push({ text: `every ${weekday} at ${time.toLowerCase()}`, source: 'inferred', popularity: 4 });
      }
    }
  }

  // Pattern 2: "on <weekday>" -> "every <weekday>"
  if (tokens[0]?.type === 'kw' && tokens[0].text === 'on' && tokens[1]?.type === 'weekday') {
    const weekday = WEEKDAYS[tokens[1].value];
    const rest = normInput.slice(tokens[1].end).trim();
    out.push({ text: `every ${weekday}${rest ? ' ' + rest : ''}`, source: 'inferred', popularity: 4 });
  }

  // Pattern 3: "at <time>" -> "every day at <time>"
  if (tokens[0]?.type === 'kw' && tokens[0].text === 'at') {
    // Check for "at <time> on <weekday>" pattern first
    let j = 1;
    while (j < tokens.length && (tokens[j].type === 'number' || tokens[j].type === 'punct' || tokens[j].type === 'meridiem')) j++;
    if (tokens[j]?.type === 'kw' && tokens[j].text === 'on' && tokens[j + 1]?.type === 'weekday') {
      // "at 5 pm on friday" → "every friday at 5 pm"
      const timePart = normInput.slice(tokens[0].start, tokens[j].start).trim();
      const wds = [];
      let k = j + 1;
      while (k < tokens.length) {
        if (tokens[k]?.type === 'weekday') { wds.push(WEEKDAYS[tokens[k].value]); k++; continue; }
        if (tokens[k]?.type === 'kw' && tokens[k].text === 'and') { k++; continue; }
        break;
      }
      if (wds.length) {
        out.push({ text: `every ${wds.join(' and ')} ${timePart}`, source: 'inferred', popularity: 5 });
      }
    } else {
      const timePart = normInput;
      out.push({ text: `every day ${timePart}`, source: 'inferred', popularity: 3 });
      out.push({ text: `every weekday ${timePart}`, source: 'inferred', popularity: 3 });
    }
  }

  // Pattern 4: "<time> <weekday>" like "5pm friday"
  if (tokens[0]?.type === 'number' && tokens[1]?.type === 'meridiem') {
    let j = 2;
    if (tokens[j]?.type === 'weekday') {
      const weekday = WEEKDAYS[tokens[j].value];
      const time = `${tokens[0].text}${tokens[1].text}`;
      out.push({ text: `every ${weekday} at ${time}`, source: 'inferred', popularity: 4 });
    }
  }

  return out;
}

module.exports = {
  generateScheduleCandidates,
  generateInferredRecurrence,
  detectScheduleParseState
};
