/**
 * Unified tokenizer - character-by-character state machine producing typed tokens.
 * Extends the datetime-autocomplete tokenizer with schedule-specific token types.
 */

const {
  WEEKDAY_LOOKUP, MONTH_LOOKUP, UNIT_CANON, NAMED_TIMES, ORDINAL_WORDS
} = require('./shared-constants');

// Merged keyword set from both datetime and schedule systems
const KEYWORDS = new Set([
  // Datetime keywords
  'now', 'today', 'tomorrow', 'yesterday',
  'tonight', 'this', 'next', 'last', 'ago',
  'in', 'from', 'on', 'at', 'after', 'before',
  'noon', 'midnight',
  'morning', 'afternoon', 'evening', 'night',
  'early', 'late', 'later', 'sometime', 'whenever',
  'the', 'day', 'of',
  // Schedule keywords
  'every', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'annually', 'hourly',
  'weekdays', 'weekday', 'weekends', 'weekend', 'business',
  'except', 'until', 'biweekly', 'once', 'twice', 'other',
  'and', 'starting', 'beginning', 'for'
]);

/**
 * Tokenize a normalized string into typed tokens.
 * @param {string} norm - Already-normalized string (lowercase, trimmed)
 * @returns {Array<{type: string, text: string, value: any, start: number, end: number}>}
 */
function tokenize(norm) {
  const s = norm;
  const tokens = [];
  let i = 0;

  const push = (type, text, value, start, end) =>
    tokens.push({ type, text, value, start, end });
  const isAlpha = c => /[a-z]/.test(c);
  const isDigit = c => /[0-9]/.test(c);

  while (i < s.length) {
    const c = s[i];
    if (c === ' ') { i++; continue; }
    const start = i;

    // Punctuation
    if (c === ',' || c === '/' || c === ':' || c === '-') {
      push('punct', c, c, start, start + 1);
      i++;
      continue;
    }

    // Numbers
    if (isDigit(c)) {
      let j = i;
      while (j < s.length && isDigit(s[j])) j++;
      const numText = s.slice(i, j);
      push('number', numText, parseInt(numText, 10), start, j);
      i = j;
      continue;
    }

    // Words (letters + apostrophe)
    if (isAlpha(c) || c === "'") {
      let j = i;
      while (j < s.length && (isAlpha(s[j]) || s[j] === "'")) j++;
      const w = s.slice(i, j);

      if (WEEKDAY_LOOKUP[w] != null) push('weekday', w, WEEKDAY_LOOKUP[w], start, j);
      else if (MONTH_LOOKUP[w] != null) push('month', w, MONTH_LOOKUP[w], start, j);
      else if (UNIT_CANON[w] != null) push('unit', w, UNIT_CANON[w], start, j);
      else if (w === 'am' || w === 'pm') push('meridiem', w, w, start, j);
      else if (ORDINAL_WORDS[w] != null) push('ordinal_word', w, ORDINAL_WORDS[w], start, j);
      else if (KEYWORDS.has(w)) push('kw', w, w, start, j);
      else push('word', w, w, start, j);

      i = j;
      continue;
    }

    // Unknown character
    push('unknown', c, c, start, start + 1);
    i++;
  }

  return tokens;
}

module.exports = { tokenize, KEYWORDS };
