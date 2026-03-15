/**
 * Unified autocomplete - single entry point for both schedule and datetime suggestions.
 *
 * Usage:
 *   autocomplete(input, { allowRecurring: true, allowOneTime: true })   // both types
 *   autocompleteSchedule(input, options)                                // schedule only
 *   autocompleteDatetime(input, options)                                // datetime only
 */

const { parseNaturalSchedule } = require('./parser');
const { getAllTemplates, parseTemplate } = require('./autocomplete-templates');
const { getDatetimeSuggestions } = require('./datetime-autocomplete');
const { normalizeUnified, normalizeForScheduleMatch } = require('./unified-normalizer');
const { tokenize } = require('./unified-tokenizer');
const { scoreCandidate } = require('./unified-scorer');
const { generateScheduleCandidates, generateInferredRecurrence } = require('./schedule-candidates');
const { SCHEDULE_KEYWORDS, WEEKDAYS, WEEKDAY_LOOKUP } = require('./shared-constants');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function normalizeAutocompleteArgs(partialInput, referenceDateOrOptions, excludePastOrOptions, maybeOptions) {
  if (isPlainObject(referenceDateOrOptions) || referenceDateOrOptions === undefined) {
    return {
      partialInput,
      options: isPlainObject(referenceDateOrOptions) ? { ...referenceDateOrOptions } : {}
    };
  }

  const options = isPlainObject(maybeOptions) ? { ...maybeOptions } : {};

  if (isPlainObject(excludePastOrOptions)) {
    Object.assign(options, excludePastOrOptions);
  } else if (typeof excludePastOrOptions === 'boolean' && options.excludePast === undefined) {
    options.excludePast = excludePastOrOptions;
  }

  if (typeof referenceDateOrOptions === 'boolean') {
    if (options.excludePast === undefined) options.excludePast = referenceDateOrOptions;
  } else if (options.referenceDate === undefined) {
    options.referenceDate = referenceDateOrOptions;
  }

  return { partialInput, options };
}

function toDatetimePopularEntries(results) {
  return results.map(s => ({
    ...s,
    type: 'datetime'
  }));
}

function toDatetimeEntries(results) {
  return results.map(s => ({
    ...s,
    type: 'datetime'
  }));
}

function finalizeSuggestions(scored, limit) {
  scored.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

  const seenLabels = new Set();
  const result = [];
  for (const s of scored) {
    const key = s.label.toLowerCase();
    if (!seenLabels.has(key)) {
      seenLabels.add(key);
      result.push(s);
      if (result.length >= limit) break;
    }
  }

  return result;
}

function findResolvedValueFromSuggestions(rawInput, suggestions) {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return null;

  const inputNorm = normalizeUnified(trimmed).norm;
  const exact = suggestions.find(s => normalizeUnified(s.input).norm === inputNorm);
  if (exact) return exact.value;
  return suggestions[0]?.value || null;
}

// ------- Input Classification -------

/**
 * Classify input as schedule, datetime, or both.
 */
function classifyInput(tokens, normInput, options) {
  const { allowRecurring = true, allowOneTime = true } = options;

  // Explicit mode
  if (!allowRecurring && allowOneTime) return { isSchedule: false, isDatetime: true, ambiguous: false };
  if (allowRecurring && !allowOneTime) return { isSchedule: true, isDatetime: false, ambiguous: false };

  if (!tokens.length) return { isSchedule: true, isDatetime: true, ambiguous: true };

  const first = tokens[0];

  // Definitive schedule signals
  const startsWithEvery = first.type === 'kw' && first.text === 'every';
  const startsWithScheduleShorthand = first.type === 'kw' &&
    ['daily','weekly','monthly','quarterly','yearly','annually','hourly','biweekly',
     'weekdays','weekday','weekends','weekend','business'].includes(first.text);
  const hasExcept = tokens.some(t => t.type === 'kw' && t.text === 'except');
  // Schedule keyword anywhere (not just first): "9 am every day", "morning every weekday"
  const hasEveryAnywhere = tokens.some(t => t.type === 'kw' &&
    ['every','daily','weekly','monthly','quarterly','yearly','annually','hourly',
     'biweekly','weekdays','weekday','weekends','weekend'].includes(t.text));

  // Check for plural weekday names ("mondays", "tuesdays")
  const firstWord = normInput.split(/\s+/)[0] || '';
  const isPluralWeekday = first.type === 'weekday' && firstWord.endsWith('s') && firstWord.length > 3;

  // "on mondays" (plural) = schedule
  const isOnPluralWeekday = first.type === 'kw' && first.text === 'on' &&
    tokens[1]?.type === 'weekday' && (normInput.split(/\s+/)[1] || '').endsWith('s');

  // Ordinal weekday at start: "first monday of the month"
  const startsWithOrdinal = first.type === 'ordinal_word' && tokens[1]?.type === 'weekday';

  // Check for "once"/"twice" which are schedule frequency indicators
  const hasOnce = tokens.some(t => t.type === 'kw' && (t.text === 'once' || t.text === 'twice'));

  // Partial schedule keyword: "ev", "dai", "wee" etc.
  const partialScheduleKw = first.type === 'word' && tokens.length === 1 &&
    ['every','daily','weekly','monthly','quarterly','yearly','annually','hourly',
     'weekdays','weekends','biweekly'].some(k => k.startsWith(first.text) && k !== first.text);

  if (startsWithEvery || startsWithScheduleShorthand || hasExcept || isPluralWeekday ||
      isOnPluralWeekday || startsWithOrdinal || hasOnce || partialScheduleKw || hasEveryAnywhere) {
    return { isSchedule: true, isDatetime: false, ambiguous: false };
  }

  // Definitive datetime signals
  const startsWithDatetimeKw = first.type === 'kw' &&
    ['now','today','tomorrow','yesterday','tonight','whenever','sometime'].includes(first.text);
  const startsWithIn = first.type === 'kw' && first.text === 'in';
  const startsWithNumericDate = first.type === 'number' &&
    tokens[1]?.type === 'punct' && (tokens[1].text === '/' || tokens[1].text === '-');
  const startsWithMonth = first.type === 'month';
  const startsWithThis = first.type === 'kw' && first.text === 'this';
  const startsWithNext = first.type === 'kw' && first.text === 'next';
  const startsWithLast = first.type === 'kw' && first.text === 'last';

  // "in 5 days" is datetime, but "every 5 days" is schedule
  if (startsWithDatetimeKw || startsWithIn || startsWithNumericDate || startsWithMonth) {
    return { isSchedule: false, isDatetime: true, ambiguous: false };
  }

  // "this/next/last" could be either, but lean datetime
  if (startsWithThis || startsWithNext || startsWithLast) {
    return { isSchedule: false, isDatetime: true, ambiguous: false };
  }

  // Number + unit + from/ago = datetime: "5 days from now", "3 weeks ago"
  if (first.type === 'number' && tokens[1]?.type === 'unit') {
    return { isSchedule: false, isDatetime: true, ambiguous: false };
  }

  // Ambiguous: bare weekday, "on monday" (singular), "at N"
  if (first.type === 'weekday' || (first.type === 'kw' && first.text === 'on') ||
      (first.type === 'kw' && first.text === 'at') ||
      (first.type === 'number' && tokens[1]?.type === 'meridiem') ||
      (first.type === 'kw' && first.text === 'the')) {
    return { isSchedule: true, isDatetime: true, ambiguous: true };
  }

  // Single partial word that could be a weekday or datetime keyword
  if (first.type === 'word' && tokens.length === 1) {
    const w = first.text;
    const isPartialWeekday = WEEKDAYS.some(d => d.startsWith(w));
    const isPartialDatetime = ['now','today','tomorrow','yesterday','tonight','whenever',
                               'noon','midnight'].some(k => k.startsWith(w));
    if (isPartialWeekday || isPartialDatetime) {
      return { isSchedule: true, isDatetime: true, ambiguous: true };
    }
  }

  // Fallback: try both
  return { isSchedule: true, isDatetime: true, ambiguous: true };
}

// ------- Display Formatting -------

function toTitle(text) {
  // Clean up malformed text before title-casing
  let cleaned = text
    .replace(/:(?=:)/g, '')      // Remove double colons "3::00" -> "3:00"
    .replace(/:\s+(am|pm)/gi, ' $1') // "3: pm" -> "3 pm"
    .replace(/\s+/g, ' ').trim();
  return cleaned
    .split(' ')
    .map(w => (w === 'am' || w === 'pm') ? w.toUpperCase()
            : (w ? (w[0].toUpperCase() + w.slice(1)) : w))
    .join(' ');
}

/**
 * Adjust suggestion text to match user's input format.
 * Preserves: "each" vs "every", time format, weekday casing, etc.
 */
function adjustToUserFormat(userInput, suggestionText) {
  const userLower = userInput.toLowerCase().trim();
  let adjusted = suggestionText;

  // Handle "each" vs "every"
  if (userLower.startsWith('each ') && adjusted.toLowerCase().startsWith('every ')) {
    adjusted = userInput.substring(0, userInput.indexOf(' ') + 1) + adjusted.replace(/^every\s+/i, '');
  }
  if (userLower.startsWith('all ') && adjusted.toLowerCase().startsWith('every ')) {
    adjusted = userInput.substring(0, userInput.indexOf(' ') + 1) + adjusted.replace(/^every\s+/i, '');
  }

  // Handle time format: "9am" vs "9:00 AM"
  const userTimeMatch = userInput.match(/(\d{1,2})(am|pm)\b/i);
  if (userTimeMatch) {
    const hour = userTimeMatch[1];
    const period = userTimeMatch[2];
    adjusted = adjusted.replace(
      new RegExp(`\\b${hour}:00\\s+(AM|PM)\\b`, 'gi'),
      `${hour}${period.toLowerCase()}`
    );
  }

  return adjusted;
}

/**
 * Preserve user's typed prefix in the display label.
 */
function preserveTypedPrefix(rawInput, normInput, candidateNorm) {
  const raw = (rawInput || '').trim();
  if (!raw) return toTitle(candidateNorm);
  if (raw.toLowerCase() === normInput && candidateNorm.startsWith(normInput)) {
    return raw + candidateNorm.slice(normInput.length);
  }
  return toTitle(candidateNorm);
}

function buildScoredScheduleSuggestions(rawInput, normInput, candidates, options = {}) {
  const {
    limit = 10,
    category = null,
    minScore = 0.3,
    includeValue = true
  } = options;

  const deduped = [];
  const seen = new Map();
  for (const c of candidates) {
    const key = normalizeUnified(c.text).norm;
    if (!seen.has(key)) {
      seen.set(key, c);
      deduped.push(c);
      continue;
    }

    const existing = seen.get(key);
    if ((c.popularity || 0) > (existing.popularity || 0)) {
      const idx = deduped.indexOf(existing);
      deduped[idx] = c;
      seen.set(key, c);
    }
  }

  const scored = [];
  for (const c of deduped) {
    if (/:\s*$/.test(c.text) || /\bat\s*$/.test(c.text)) continue;

    try {
      const scheduleJSON = parseNaturalSchedule(c.text);
      if (!scheduleJSON.repeat) continue;

      const isComplete = Boolean(
        scheduleJSON.repeat.at ||
        scheduleJSON.repeat.interval?.unit === 'minute' ||
        scheduleJSON.repeat.interval?.unit === 'hour'
      );
      const hasTime = Boolean(scheduleJSON.repeat.at);
      const candidateNorm = normalizeUnified(c.text).norm;
      const score = scoreCandidate(normInput, candidateNorm, {
        source: c.source,
        popularity: c.popularity,
        isComplete,
        hasTime
      });

      if (score < minScore) continue;

      const publicSource = c.source === 'template' ? 'template' : 'dynamic';
      const displayText = adjustToUserFormat(rawInput, toTitle(c.text));
      const entry = {
        label: displayText,
        input: displayText,
        value: includeValue ? scheduleJSON : undefined,
        score,
        source: publicSource,
        type: 'schedule'
      };
      if (category) entry.category = category;
      scored.push(entry);
    } catch {
      continue;
    }
  }

  return finalizeSuggestions(scored, limit);
}

function buildScheduleSuggestions(partialInput, options = {}) {
  const {
    limit = 10,
    category = null,
    minScore = 0.3,
    includeValue = true
  } = options;

  if (!partialInput || !String(partialInput).trim()) {
    return getPopularSuggestions(limit, includeValue, {
      ...options,
      allowRecurring: true,
      allowOneTime: false,
      category
    });
  }

  const rawInput = String(partialInput).trim();
  const { norm } = normalizeUnified(rawInput);
  const tokens = tokenize(norm);
  const candidates = generateScheduleCandidates(norm, tokens, options).map(c => ({
    text: c.text,
    source: c.source,
    popularity: c.popularity
  }));

  return buildScoredScheduleSuggestions(rawInput, norm, candidates, {
    ...options,
    limit,
    category,
    minScore,
    includeValue
  });
}

// ------- Main Entry Point -------

/**
 * Get autocomplete suggestions - unified entry point.
 *
 * @param {string} partialInput - The partial input from the user
 * @param {object} options
 * @param {number} options.limit - Max suggestions (default 10)
 * @param {boolean} options.allowRecurring - Include schedule suggestions (default true)
 * @param {boolean} options.allowOneTime - Include datetime suggestions (default true)
 * @param {string} options.mode - 'schedule' | 'datetime' (backward compat, overrides allow*)
 * @param {string} options.category - Filter by template category
 * @param {number} options.minScore - Minimum score threshold (default 0.3)
 * @param {boolean} options.includeValue - Parse and include value (default true)
 * @param {Date|string} options.referenceDate - Reference date for resolution
 * @param {object} options.defaultTime - Default time {h,m}
 * @param {number} options.wheneverDays - Range for "whenever" (default 60)
 * @returns {Array<{label, input, value, score, source, type}>}
 */
function autocomplete(partialInput, referenceDateOrOptions, excludePastOrOptions, maybeOptions) {
  const { options } = normalizeAutocompleteArgs(partialInput, referenceDateOrOptions, excludePastOrOptions, maybeOptions);
  let {
    limit = 10,
    allowRecurring,
    allowOneTime,
    mode,
    category = null,
    minScore = 0.3,
    includeValue = true,
    referenceDate,
    excludePast = false,
    defaultTime,
    wheneverDays
  } = options;

  // Backward compatibility: mode overrides allow* flags
  if (mode === 'schedule') { allowRecurring = true; allowOneTime = false; }
  else if (mode === 'datetime') { allowRecurring = false; allowOneTime = true; }
  if (allowRecurring === undefined) allowRecurring = true;
  if (allowOneTime === undefined) allowOneTime = true;

  // Handle empty input
  if (!partialInput || !partialInput.trim()) {
    return getPopularSuggestions(limit, includeValue, {
      allowRecurring,
      allowOneTime,
      category,
      referenceDate,
      excludePast,
      defaultTime,
      wheneverDays
    });
  }

  const rawInput = partialInput.trim();
  const { norm } = normalizeUnified(rawInput);
  const tokens = tokenize(norm);
  const classification = classifyInput(tokens, norm, { allowRecurring, allowOneTime });

  const scored = [];

  // ---- Schedule candidates ----
  if (classification.isSchedule) {
    const scheduleCandidates = generateScheduleCandidates(norm, tokens, options).map(c => ({
      text: c.text,
      source: c.source,
      popularity: c.popularity
    }));

    if (classification.isDatetime && allowRecurring && classification.ambiguous) {
      const inferred = generateInferredRecurrence(norm, tokens).map(c => ({
        text: c.text,
        source: 'inferred',
        popularity: c.popularity
      }));
      scheduleCandidates.push(...inferred);
    }
    scored.push(...buildScoredScheduleSuggestions(rawInput, norm, scheduleCandidates, {
      ...options,
      limit: limit * 2,
      category,
      minScore,
      includeValue
    }));
  }

  // ---- Datetime candidates ----
  if (classification.isDatetime) {
    const dtSuggestions = getDatetimeSuggestions(rawInput, {
      limit: limit * 2,
      minScore: 0.1,
      includeValue,
      referenceDate,
      excludePast,
      defaultTime,
      wheneverDays
    });
    for (const s of dtSuggestions) {
      const candidateNorm = normalizeUnified(s.input).norm;
      const score = scoreCandidate(norm, candidateNorm, {
        source: 'datetime',
        popularity: 6,
        isComplete: true,
        hasTime: true
      });
      const finalScore = Math.max(score, s.score || 0);
      scored.push({
        label: s.label,
        input: s.input,
        value: includeValue ? s.value : undefined,
        score: finalScore,
        source: 'datetime',
        type: 'datetime'
      });
    }
  }

  return finalizeSuggestions(scored.filter(s => s.score >= minScore), limit);
}

function autocompleteSchedule(partialInput, referenceDateOrOptions, excludePastOrOptions, maybeOptions) {
  const { options } = normalizeAutocompleteArgs(partialInput, referenceDateOrOptions, excludePastOrOptions, maybeOptions);
  return buildScheduleSuggestions(partialInput, options);
}

function autocompleteDatetime(partialInput, referenceDateOrOptions, excludePastOrOptions, maybeOptions) {
  const { options } = normalizeAutocompleteArgs(partialInput, referenceDateOrOptions, excludePastOrOptions, maybeOptions);
  return toDatetimeEntries(getDatetimeSuggestions(partialInput, options));
}

function resolveScheduleString(input, referenceDateOrOptions, excludePastOrOptions, maybeOptions) {
  const { options } = normalizeAutocompleteArgs(input, referenceDateOrOptions, excludePastOrOptions, maybeOptions);
  const suggestions = buildScheduleSuggestions(input, {
    ...options,
    includeValue: true,
    limit: Number.MAX_SAFE_INTEGER,
    minScore: 0
  });
  return findResolvedValueFromSuggestions(input, suggestions);
}

function resolveString(input, referenceDateOrOptions, excludePastOrOptions, maybeOptions) {
  const { options } = normalizeAutocompleteArgs(input, referenceDateOrOptions, excludePastOrOptions, maybeOptions);
  const suggestions = autocomplete(input, {
    ...options,
    includeValue: true,
    limit: Number.MAX_SAFE_INTEGER,
    minScore: 0
  });
  return findResolvedValueFromSuggestions(input, suggestions);
}

/**
 * Get popular suggestions for empty input.
 */
function getPopularSuggestions(limit = 10, includeValue = true, opts = {}) {
  const {
    allowRecurring = true,
    allowOneTime = true,
    category = null,
    referenceDate,
    excludePast = false,
    defaultTime,
    wheneverDays
  } = opts;

  const datetimeDefaults = allowOneTime && !category
    ? toDatetimePopularEntries(getDatetimeSuggestions('', {
      limit,
      includeValue,
      referenceDate,
      excludePast,
      defaultTime,
      wheneverDays
    }))
    : [];

  // Empty-input default state is datetime-first unless the caller explicitly
  // requests schedule-only or a schedule category.
  if (datetimeDefaults.length && (allowOneTime && (!allowRecurring || !category))) {
    return datetimeDefaults.slice(0, limit);
  }

  if (!allowRecurring && allowOneTime) {
    return toDatetimePopularEntries(getDatetimeSuggestions('', {
      limit,
      includeValue,
      referenceDate,
      excludePast,
      defaultTime,
      wheneverDays
    }));
  }

  const results = [];

  if (allowRecurring) {
    let templates = getAllTemplates();
    if (category) templates = templates.filter(t => t.category === category);
    const popular = templates.sort((a, b) => b.popularity - a.popularity).slice(0, limit);

    for (const t of popular) {
      let value;
      if (includeValue) {
        try {
          const parsed = parseTemplate(t);
          value = parsed.value;
        } catch { continue; }
      }
      results.push({
        label: t.label || t.input,
        input: t.input,
        value,
        score: (t.popularity || 5) / 10,
        source: 'template',
        type: 'schedule'
      });
      if (category) {
        results[results.length - 1].category = category;
      }
    }
  }

  if (allowOneTime) {
    const dtSeeds = ['tomorrow', 'next week', 'in 1 hour', 'next monday'];
    const dtSuggestions = [];
    for (const seed of dtSeeds) {
      const results_ = getDatetimeSuggestions(seed, {
        limit: 1,
        includeValue,
        referenceDate,
        excludePast,
        defaultTime,
        wheneverDays
      });
      dtSuggestions.push(...results_);
    }
    for (const s of dtSuggestions) {
      results.push({
        label: s.label,
        input: s.input,
        value: s.value,
        score: s.score * 0.8, // Slightly lower than schedule popular
        source: 'datetime',
        type: 'datetime'
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Get suggestions filtered by category (backward compat).
 */
function getSuggestionsByCategory(category, limit = 20, includeValue = true) {
  const templates = getAllTemplates().filter(t => t.category === category);
  const sorted = templates.sort((a, b) => b.popularity - a.popularity).slice(0, limit);

  return sorted.map(t => {
    let value;
    if (includeValue) {
      try {
        const parsed = parseTemplate(t);
        value = parsed.value;
      } catch { return null; }
    }
    return {
      label: t.label || t.input,
      input: t.input,
      category: t.category,
      value,
      score: (t.popularity || 5) / 10,
      source: 'template',
      type: 'schedule'
    };
  }).filter(Boolean);
}

module.exports = {
  autocomplete,
  autocompleteSchedule,
  autocompleteDatetime,
  resolveScheduleString,
  resolveString,
  getSuggestionsByCategory,
  getPopularSuggestions
};
