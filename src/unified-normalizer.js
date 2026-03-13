/**
 * Unified normalization pipeline.
 * Merges rules from tokenizer.js, autocomplete-normalizer.js, and datetime-autocomplete.js
 * into a single ordered pipeline applied exactly once per input.
 */

const { NUMBER_WORDS } = require('./shared-constants');

function replaceNumberWords(text) {
  const tokens = text.split(' ');
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i];
    const nxt = tokens[i + 1];
    // Handle compound numbers: "twenty one" -> "21"
    if (NUMBER_WORDS[cur] != null && NUMBER_WORDS[cur] >= 20 && NUMBER_WORDS[cur] % 10 === 0
        && NUMBER_WORDS[nxt] != null && NUMBER_WORDS[nxt] < 10) {
      out.push(String(NUMBER_WORDS[cur] + NUMBER_WORDS[nxt]));
      i += 1;
      continue;
    }
    out.push(NUMBER_WORDS[cur] != null ? String(NUMBER_WORDS[cur]) : cur);
  }
  return out.join(' ');
}

/**
 * Normalize raw input into a canonical form for matching and parsing.
 * @param {string} rawInput
 * @returns {{ raw: string, norm: string, changed: boolean }}
 */
function normalizeUnified(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return { raw: '', norm: '', changed: false };

  let t = rawInput.toLowerCase().trim();
  const before = t;

  // PHASE 1: Unicode normalization
  t = t.replace(/[\u2019\u2018]/g, "'");

  // PHASE 2: Typo corrections (superset of all three normalizers)
  // Weekday typos
  t = t.replace(/\bthrusday\b/g, 'thursday');
  t = t.replace(/\bwensday\b/g, 'wednesday');
  t = t.replace(/\bwedsday\b/g, 'wednesday');
  t = t.replace(/\bwendsday\b/g, 'wednesday');
  t = t.replace(/\btuseday\b/g, 'tuesday');
  t = t.replace(/\bsaterday\b/g, 'saturday');
  // Month typos
  t = t.replace(/\bfeburary\b/g, 'february');
  t = t.replace(/\bseptemeber\b/g, 'september');
  t = t.replace(/\boctobor\b/g, 'october');
  t = t.replace(/\bnovemeber\b/g, 'november');
  t = t.replace(/\bdecemeber\b/g, 'december');
  // Common word typos
  t = t.replace(/\bevry\b/g, 'every');
  t = t.replace(/\bever\b(?!\s+after)/g, 'every');
  t = t.replace(/\bdya\b/g, 'day');
  t = t.replace(/\bdaus\b/g, 'days');
  t = t.replace(/\bdyas\b/g, 'days');
  t = t.replace(/\bweekdys\b/g, 'weekdays');
  t = t.replace(/\bbussiness\b/g, 'business');
  t = t.replace(/\bbusness\b/g, 'business');
  t = t.replace(/\bworkday\b/g, 'weekday');
  t = t.replace(/\bworkdays\b/g, 'weekdays');
  t = t.replace(/\bmoth\b/g, 'month');
  t = t.replace(/\bmonhs\b/g, 'months');
  t = t.replace(/\bwekes\b/g, 'weeks');
  t = t.replace(/\bweks\b/g, 'weeks');
  t = t.replace(/\byeras\b/g, 'years');
  t = t.replace(/\bminuts\b/g, 'minutes');
  t = t.replace(/\bminuets\b/g, 'minutes');
  // Datetime-specific typos
  t = t.replace(/\byesturday\b/g, 'yesterday');
  t = t.replace(/\btomm?or+ow\b/g, 'tomorrow');
  t = t.replace(/\btommorow\b/g, 'tomorrow');
  t = t.replace(/\btmrw\b/g, 'tomorrow');
  t = t.replace(/\btmr\b/g, 'tomorrow');
  t = t.replace(/\btomo\b/g, 'tomorrow');
  t = t.replace(/\bmidnite\b/g, 'midnight');

  // PHASE 3: Abbreviation expansion (word-boundary anchored, only full abbreviations)
  // Weekday abbreviations
  t = t.replace(/\bmon\b/g, 'monday');
  t = t.replace(/\btues?\b/g, 'tuesday');
  t = t.replace(/\bweds?\b/g, 'wednesday');
  t = t.replace(/\bthurs?\b/g, 'thursday');
  t = t.replace(/\bthur\b/g, 'thursday');
  t = t.replace(/\bthu\b/g, 'thursday');
  t = t.replace(/\bfri\b/g, 'friday');
  t = t.replace(/\bsat\b/g, 'saturday');
  t = t.replace(/\bsun\b/g, 'sunday');
  // Month abbreviations
  t = t.replace(/\bjan\b/g, 'january');
  t = t.replace(/\bfeb\b/g, 'february');
  t = t.replace(/\bmar\b/g, 'march');
  t = t.replace(/\bapr\b/g, 'april');
  t = t.replace(/\bjun\b/g, 'june');
  t = t.replace(/\bjul\b/g, 'july');
  t = t.replace(/\baug\b/g, 'august');
  t = t.replace(/\bsept?\b/g, 'september');
  t = t.replace(/\boct\b/g, 'october');
  t = t.replace(/\bnov\b/g, 'november');
  t = t.replace(/\bdec\b/g, 'december');

  // PHASE 3.5: Plural weekday normalization
  t = t.replace(/\b(mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays)\b/g, m => m.slice(0, -1));

  // PHASE 4: Compound word normalization
  t = t.replace(/\beveryday\b/g, 'every day');
  t = t.replace(/\bweekend day\b/g, 'weekend');

  // PHASE 5: Alternative vocabulary normalization
  t = t.replace(/\beach\b/g, 'every');
  t = t.replace(/\ball\b(?=\s+(days?|weeks?|months?|monday|tuesday|wednesday|thursday|friday|saturday|sunday))/g, 'every');
  // Singularize unit after "every" (e.g., "every days" -> "every day")
  t = t.replace(/\bevery\s+days\b/g, 'every day');
  t = t.replace(/\bevery\s+weeks\b/g, 'every week');
  t = t.replace(/\bevery\s+months\b/g, 'every month');
  t = t.replace(/\bevery\s+years\b/g, 'every year');
  t = t.replace(/\bper\b/g, 'a');
  t = t.replace(/\bone time\b/g, 'once');

  // PHASE 6: Separator normalization
  t = t.replace(/\s*\+\s*/g, ' and ');
  t = t.replace(/\bminus\b/g, 'except');
  t = t.replace(/\bbut not\b/g, 'except');
  // "/" separator: only convert when between weekday names/abbreviations, not numeric dates
  t = t.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*\/\s*/g, '$1 and ');
  // NOTE: general "/" separator normalization is NOT applied here because it conflicts with
  // numeric dates like "12/31/2020". The schedule-specific code handles this contextually.

  // PHASE 7: Time expression normalization
  t = t.replace(/\b12\s*am\b/g, 'midnight');
  t = t.replace(/\b12\s*pm\b/g, 'noon');
  t = t.replace(/\b12:00\s*am\b/g, 'midnight');
  t = t.replace(/\b12:00\s*pm\b/g, 'noon');
  t = t.replace(/\b00:00\b/g, 'midnight');
  t = t.replace(/\b(\d{1,2})\s*o'?clock\b/g, '$1:00');
  t = t.replace(/\baround\b/g, 'at');
  t = t.replace(/\bvery early\b/g, 'early');
  t = t.replace(/\bvery late\b/g, 'late');
  t = t.replace(/\bfirst thing\b/g, 'early');
  t = t.replace(/\bin the (morning|afternoon|evening)\b/g, '$1');
  t = t.replace(/\bearly in the morning\b/g, 'early morning');

  // PHASE 8: Time reference normalization
  t = t.replace(/\bright now\b/g, 'now');
  t = t.replace(/\bthis moment\b/g, 'now');
  t = t.replace(/\blater today\b/g, 'today later');
  t = t.replace(/\bthis coming\b/g, 'next');
  t = t.replace(/\bstart of\b/g, 'beginning of');
  t = t.replace(/\bend of\b/g, 'last day of');
  t = t.replace(/\bvery end\b/g, 'last day');

  // PHASE 9: Filler removal
  t = t.replace(/\bforever\b/g, '');
  t = t.replace(/\buntil the end of time\b/g, '');
  t = t.replace(/\bno matter what\b/g, '');

  // PHASE 10: Special date normalization
  t = t.replace(/\bleap day\b/g, 'february 29');

  // PHASE 10.5: Frequency normalization (before number words to protect "a" from becoming "1")
  t = t.replace(/\bonce\s+a\s+(day|week|month|year)\b/g, 'once $1');
  t = t.replace(/\btwice\s+a\s+(day|week|month|year)\b/g, 'twice $1');

  // PHASE 11: Number word replacement
  t = replaceNumberWords(t);

  // PHASE 12: Ordinal normalization
  t = t.replace(/\b(\d+)th\b/g, '$1');
  t = t.replace(/\b1st\b/g, '1');
  t = t.replace(/\b2nd\b/g, '2');
  t = t.replace(/\b3rd\b/g, '3');
  // Convert ordinal words to numbers ONLY when NOT followed by a weekday (preserves "first monday")
  const weekdayLookahead = '(?!\\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))';
  t = t.replace(new RegExp('\\bfirst\\b' + weekdayLookahead, 'g'), '1');
  t = t.replace(new RegExp('\\bsecond\\b' + weekdayLookahead, 'g'), '2');
  t = t.replace(new RegExp('\\bthird\\b' + weekdayLookahead, 'g'), '3');
  t = t.replace(new RegExp('\\bfourth\\b' + weekdayLookahead, 'g'), '4');
  t = t.replace(new RegExp('\\bfifth\\b' + weekdayLookahead, 'g'), '5');

  // PHASE 13: Whitespace cleanup
  t = t.replace(/\s*,\s*/g, ', ');
  t = t.replace(/\s+/g, ' ').trim();

  return { raw: rawInput, norm: t, changed: before !== t };
}

/**
 * Lighter normalization for schedule template matching.
 * Applies all the rules above PLUS schedule-specific grammar and format normalization.
 */
function normalizeForScheduleMatch(input) {
  if (!input) return '';
  const { norm } = normalizeUnified(input);
  let t = norm;

  // Time format normalization: "9am" -> "9:00 am", "9 am" -> "9:00 am" for template matching
  t = t.replace(/\b(\d{1,2})(am|pm)\b/gi, '$1:00 $2');
  t = t.replace(/\b(\d{1,2})\s+(am|pm)\b/gi, (m, h, p) => `${h}:00 ${p}`);

  // Grammar forgiveness: "every weeks" -> "every week"
  t = t.replace(/\bevery\s+weeks?\b/g, 'every week');
  t = t.replace(/\bevery\s+months?\b/g, 'every month');
  t = t.replace(/\bevery\s+years?\b/g, 'every year');

  // Article/filler removal for matching
  t = t.replace(/\bthe\s+(\d+)\b/g, '$1');
  t = t.replace(/\bday\s+(\d+)\b/g, '$1');
  t = t.replace(/\bat\s+the\s+(beginning|end|start)\s+of\b/g, 'at $1 of');
  t = t.replace(/\bonce\s+a\s+(day|week|month|year)\b/g, 'once $1');
  t = t.replace(/\btwice\s+a\s+(day|week|month|year)\b/g, 'twice $1');

  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

/**
 * Check if input ends with a word that shouldn't have time appended.
 */
function endsWithIncompletePhrase(input) {
  const incomplete = [
    /\bof$/, /\bthe$/, /\beach$/, /\bbeginning$/, /\bend$/, /\bstart$/,
    /\bfrom$/, /\bfirst$/, /\blast$/, /\band$/, /\b,$/, /\bon$/, /\bexcept$/,
    /\bevery$/, /\bother$/
  ];
  const trimmed = input.trim().toLowerCase();
  return incomplete.some(pattern => pattern.test(trimmed));
}

function endsWithAt(input) {
  return /\bat\s*$/i.test(input.trim());
}

function endsWithOn(input) {
  return /\bon\s*$/i.test(input.trim());
}

module.exports = {
  normalizeUnified,
  normalizeForScheduleMatch,
  endsWithIncompletePhrase,
  endsWithAt,
  endsWithOn,
  replaceNumberWords
};
