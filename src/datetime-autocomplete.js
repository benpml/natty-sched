/**
 * Datetime autocomplete + resolver (single point in time).
 *
 * Goals:
 * - High-coverage natural language date/time parsing (single datetime)
 * - Autocomplete that works well on partial inputs and partial tokens
 * - Suggestions always resolve to a valid datetime (no nonsense phrases)
 * - Default time = the current time-of-day from referenceDate when no time is indicated
 *
 * Key behavior:
 * - Relative minute/hour keeps time-of-day (e.g. "24 hours from now" = now + 24h)
 * - "now" returns exact now unless user explicitly specifies a time/bucket
 * - "next week/month/year" supported (regression fixed)
 * - Correct singular/plural grammar in generated suggestions (e.g. "in 4 minutes", "2 weeks from now")
 * - Partial bucket completion (e.g. "tuesday aftern" -> "tuesday afternoon")
 * - "on ..." suggestions prefer weekdays and never suggest "on today/yesterday/now"
 *
 * Usage:
 *   getDatetimeSuggestions(input, { limit, minScore, includeValue, referenceDate, excludePast, defaultTime, wheneverDays })
 *   getDatetimeSuggestions(input, referenceDate, excludePast, { limit, minScore, includeValue, defaultTime, wheneverDays })
 *   resolveDatetimeString(input, { referenceDate, excludePast, defaultTime, wheneverDays })
 *   resolveDateTime(input, { referenceDate, excludePast, defaultTime, wheneverDays })
 */

const WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

const WEEKDAY_LOOKUP = Object.fromEntries(WEEKDAYS.map((d,i)=>[d,i]));
const MONTH_LOOKUP = Object.fromEntries(MONTHS.map((m,i)=>[m,i]));

const UNIT_CANON = {
  minute: 'minute', minutes: 'minute', min: 'minute', mins: 'minute',
  hour: 'hour', hours: 'hour', hr: 'hour', hrs: 'hour',
  day: 'day', days: 'day',
  week: 'week', weeks: 'week',
  month: 'month', months: 'month',
  year: 'year', years: 'year'
};
const UNIT_WORDS = Object.keys(UNIT_CANON);
const CANON_UNITS = Array.from(new Set(Object.values(UNIT_CANON))); // minute/hour/day/week/month/year

const KEYWORDS = new Set([
  'now','today','tomorrow','yesterday',
  'tonight','this','next','last','ago',
  'in','from','on','at','after','before',
  'noon','midnight',
  'morning','afternoon','evening','night',
  'early','late','later','sometime','whenever',
  'the','first','day','of','month','week','year',
  'every' // parsed as "unknown/unsupported" for datetime; kept for autocomplete tokenization
]);

const NAMED_TIMES = {
  noon: { h: 12, m: 0 },
  midnight: { h: 0, m: 0 }
};

const TIME_BUCKETS = {
  'early morning': { h: 6, m: 0 },
  'morning': { h: 9, m: 0 },
  'afternoon': { h: 14, m: 0 },
  'evening': { h: 18, m: 0 },
  'night': { h: 20, m: 0 },

  // only suggested when user types early/late explicitly
  'early': { h: 8, m: 0 },
  'late': { h: 17, m: 0 },

  'tonight': { h: 20, m: 0 },
  'this morning': { h: 9, m: 0 },
  'later today': { h: 17, m: 0 }
};

const TIME_BUCKET_KEYS = ['morning','afternoon','evening','night','early','late'];
const DEFAULT_TIME_VARIANTS = ['at 9 am','at 12 pm','at 3 pm','at 5 pm'];

const IMPLIED_TIME_RULES = {
  'tonight': { minHour: 18, bucketKeys: new Set(['night', 'tonight']) },
  'night': { minHour: 18, bucketKeys: new Set(['night', 'tonight']) },
  'this morning': { minHour: 5, maxHour: 11, bucketKeys: new Set(['early', 'early morning', 'morning', 'this morning']) },
  'later today': { minHour: 12, bucketKeys: new Set(['afternoon', 'evening', 'night', 'late', 'later today']) }
};

const IMPLIED_TIME_VARIANTS = {
  'tonight': ['at 6 pm', 'at 8 pm', 'at 9 pm', 'at 10 pm'],
  'night': ['at 6 pm', 'at 8 pm', 'at 9 pm', 'at 10 pm'],
  'this morning': ['at 6 am', 'at 8 am', 'at 9 am', 'at 11 am'],
  'later today': ['at 1 pm', 'at 3 pm', 'at 5 pm', 'at 8 pm']
};

const DEFAULT_BLANK_SEEDS = [
  'now',
  'in 1 hour',
  'tomorrow morning',
  'monday at 8 am',
  'in 1 week',
  '1 month from now',
  'next year',
  'tonight',
  'friday at 5 pm',
  'christmas'
];

const DEFAULT_BLANK_FALLBACKS = [
  'tomorrow at noon',
  'next month',
  'next tuesday at 9 am',
  'thanksgiving',
  'labor day'
];

const NORMALIZE_MAP = [
  [/[\u2019\u2018]/g, "'"],
  [/\byesturday\b/g, 'yesterday'],
  [/\btomm?or+ow\b/g, 'tomorrow'],
  [/\btmrw\b/g, 'tomorrow'],
  [/\btmr\b/g, 'tomorrow'],
  [/\btomo\b/g, 'tomorrow'],
  [/\bthur?s\b/g, 'thursday'],
  [/\bthursda\b/g, 'thursday'],
  [/\bweds?\b/g, 'wednesday'],
  [/\btues?\b/g, 'tuesday'],
  [/\bjan\b/g, 'january'],
  [/\bfeb\b/g, 'february'],
  [/\bmar\b/g, 'march'],
  [/\bapr\b/g, 'april'],
  [/\bjun\b/g, 'june'],
  [/\bjul\b/g, 'july'],
  [/\baug\b/g, 'august'],
  [/\bsept?\b/g, 'september'],
  [/\boct\b/g, 'october'],
  [/\bnov\b/g, 'november'],
  [/\bdec\b/g, 'december'],
  [/\s*,\s*/g, ', '],
  [/\s+/g, ' '],
];

const NUMBER_WORDS = {
  a: 1, an: 1,
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
};

const HOLIDAYS = {
  'christmas': { type:'fixed', month:11, day:25, aliases:['xmas','christmas day'] },
  'kwanzaa': { type:'fixed', month:11, day:26, aliases:['kwanza'] },
  "new year's day": { type:'fixed', month:0, day:1, observed:true, aliases:['new years day','nyd'] },
  "new year's eve": { type:'fixed', month:11, day:31, aliases:['new years eve','nye'] },
  "valentine's day": { type:'fixed', month:1, day:14, aliases:['valentines day'] },
  'halloween': { type:'fixed', month:9, day:31, aliases:[] },
  'mlk day': { type:'nth_weekday', month:0, weekday:1, nth:3, aliases:['martin luther king day','martin luther king jr day'] },
  'presidents day': { type:'nth_weekday', month:1, weekday:1, nth:3, aliases:["washington's birthday",'washington birthday'] },
  'memorial day': { type:'last_weekday', month:4, weekday:1, aliases:[] },
  'labor day': { type:'nth_weekday', month:8, weekday:1, nth:1, aliases:['labour day'] },
  'thanksgiving': { type:'nth_weekday', month:10, weekday:4, nth:4, aliases:['thanksgiving day'] },
  "mother's day": { type:'nth_weekday', month:4, weekday:0, nth:2, aliases:['mothers day'] },
  "father's day": { type:'nth_weekday', month:5, weekday:0, nth:3, aliases:['fathers day'] },
  'juneteenth': { type:'fixed', month:5, day:19, observed:true, aliases:['juneteenth national independence day'] },
  'independence day': { type:'fixed', month:6, day:4, observed:true, aliases:['fourth of july','4th of july','july 4'] },
  "veterans day": { type:'fixed', month:10, day:11, observed:true, aliases:["veterans' day"] },
  'easter': { type:'easter_offset', offset:0, aliases:['easter sunday'] },
  'good friday': { type:'easter_offset', offset:-2, aliases:[] }
};

function normalizeHolidayText(str){
  return String(str || '')
    .toLowerCase()
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const HOLIDAY_ALIAS_TO_KEY = {};
for (const [key, def] of Object.entries(HOLIDAYS)){
  HOLIDAY_ALIAS_TO_KEY[normalizeHolidayText(key)] = key;
  for (const alias of def.aliases) HOLIDAY_ALIAS_TO_KEY[normalizeHolidayText(alias)] = key;
}
const HOLIDAY_NAME_LIST = Array.from(new Set(Object.keys(HOLIDAY_ALIAS_TO_KEY)));
const HOLIDAY_CANONICAL_NAMES = Object.keys(HOLIDAYS);

function canonicalizeHolidayName(name){
  return HOLIDAY_ALIAS_TO_KEY[normalizeHolidayText(name)] || null;
}

function holidayMatchesPrefix(prefix){
  const p = normalizeHolidayText(prefix);
  if (!p) return [];
  const out = [];
  for (const name of HOLIDAY_NAME_LIST){
    if (!name.startsWith(p)) continue;
    const key = HOLIDAY_ALIAS_TO_KEY[name];
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

function easterSunday(year){
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function nthWeekdayOfMonth(year, month0, weekday0, nth){
  const d = new Date(year, month0, 1);
  const delta = (weekday0 - d.getDay() + 7) % 7;
  d.setDate(1 + delta + (nth - 1) * 7);
  return d;
}

function lastWeekdayOfMonth(year, month0, weekday0){
  const d = new Date(year, month0 + 1, 0);
  const delta = (d.getDay() - weekday0 + 7) % 7;
  d.setDate(d.getDate() - delta);
  return d;
}

function applyObservedRule(date){
  const d = cloneDate(date);
  if (d.getDay() === 6) d.setDate(d.getDate() - 1);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
}

function resolveHolidayByYear(key, year, observedFlag){
  const def = HOLIDAYS[key];
  if (!def) return null;
  let d = null;
  if (def.type === 'fixed') d = new Date(year, def.month, def.day);
  if (def.type === 'nth_weekday') d = nthWeekdayOfMonth(year, def.month, def.weekday, def.nth);
  if (def.type === 'last_weekday') d = lastWeekdayOfMonth(year, def.month, def.weekday);
  if (def.type === 'easter_offset'){
    d = easterSunday(year);
    d.setDate(d.getDate() + def.offset);
  }
  if (!d) return null;
  if (observedFlag && def.observed) d = applyObservedRule(d);
  return startOfDay(d);
}

function resolveHolidayOccurrence(key, referenceDate, mode = 'next_or_this', observedFlag){
  const refDay = startOfDay(referenceDate);
  const year = refDay.getFullYear();
  if (mode === 'this') return resolveHolidayByYear(key, year, observedFlag);
  if (mode === 'next') return resolveHolidayByYear(key, year + 1, observedFlag);
  if (mode === 'last') return resolveHolidayByYear(key, year - 1, observedFlag);

  const current = resolveHolidayByYear(key, year, observedFlag);
  if (!current) return null;
  return current >= refDay ? current : resolveHolidayByYear(key, year + 1, observedFlag);
}

function cloneDate(d){ return new Date(d.getTime()); }
function isPlainObject(value){ return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date); }
function startOfDay(d){ const x=cloneDate(d); x.setHours(0,0,0,0); return x; }
function setTime(d, t){ const x=cloneDate(d); x.setHours(t.h, t.m, 0, 0); return x; }
function defaultTime(referenceDate){
  return { h: referenceDate.getHours(), m: referenceDate.getMinutes() };
}

function isAllowedResolvedDate(datetime, referenceDate, excludePast){
  if (!excludePast) return true;
  return datetime.getTime() >= referenceDate.getTime();
}

function isValidYMD(y, mo, da){
  const d = new Date(y, mo, da);
  return d.getFullYear()===y && d.getMonth()===mo && d.getDate()===da;
}

function addUnits(base, amount, unit){
  const d = cloneDate(base);
  // IMPORTANT: for minute/hour we keep exact time-of-day
  if (unit !== 'minute' && unit !== 'hour') d.setHours(0,0,0,0);

  if (unit==='minute') d.setMinutes(d.getMinutes()+amount);
  if (unit==='hour') d.setHours(d.getHours()+amount);
  if (unit==='day') d.setDate(d.getDate()+amount);
  if (unit==='week') d.setDate(d.getDate()+amount*7);
  if (unit==='month') d.setMonth(d.getMonth()+amount);
  if (unit==='year') d.setFullYear(d.getFullYear()+amount);
  return d;
}

function nextWeekday(reference, weekdayIndex, includeToday){
  const d = startOfDay(reference);
  let delta = (weekdayIndex - d.getDay() + 7) % 7;
  if (delta===0 && !includeToday) delta = 7;
  d.setDate(d.getDate()+delta);
  return d;
}

function prevWeekday(reference, weekdayIndex, includeToday){
  const d = startOfDay(reference);
  let delta = (d.getDay() - weekdayIndex + 7) % 7;
  if (delta===0 && !includeToday) delta = 7;
  d.setDate(d.getDate()-delta);
  return d;
}

function asInt(x){
  const n = parseInt(String(x), 10);
  return Number.isFinite(n) ? n : null;
}

function unitForm(unitCanon, n){
  return n === 1 ? unitCanon : `${unitCanon}s`;
}

function canonicalUnit(unit){
  return UNIT_CANON[unit] || unit;
}

function canonCountUnit(n, unit){
  const unitCanon = canonicalUnit(unit);
  return `${n} ${unitForm(unitCanon, n)}`;
}

function canonInPhrase(n, unit){
  return `in ${canonCountUnit(n, unit)}`;
}

function canonCountUnitSuffix(n, unit, suffix){
  return `${canonCountUnit(n, unit)} ${suffix}`;
}

function parseCountUnitPhrase(text){
  const m = text.match(/^(\d+)\s+([a-z]+)$/);
  if (!m) return null;
  const n = asInt(m[1]);
  const unitCanon = UNIT_CANON[m[2]];
  if (n == null || !unitCanon) return null;
  return { n, unit: unitCanon, text: canonCountUnit(n, unitCanon) };
}

function bucketMatches(prefix){
  if (!prefix) return [];
  return TIME_BUCKET_KEYS.filter(k => k.startsWith(prefix));
}

function escapeRegExp(text){
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeInput(raw){
  if (!raw || typeof raw !== 'string') return { raw:'', norm:'', changed:false };
  let t = raw.toLowerCase().trim();
  const before = t;
  for (const [re, rep] of NORMALIZE_MAP) t = t.replace(re, rep);
  t = replaceNumberWords(t);
  return { raw, norm: t.trim(), changed: before !== t };
}

function replaceNumberWords(text){
  const tokens = text.split(' ');
  const out = [];
  for (let i=0;i<tokens.length;i++){
    const cur = tokens[i];
    const nxt = tokens[i+1];
    if (NUMBER_WORDS[cur] && NUMBER_WORDS[cur] >= 20 && NUMBER_WORDS[cur] % 10 === 0 && NUMBER_WORDS[nxt] && NUMBER_WORDS[nxt] < 10) {
      out.push(String(NUMBER_WORDS[cur] + NUMBER_WORDS[nxt]));
      i += 1;
      continue;
    }
    out.push(NUMBER_WORDS[cur] != null ? String(NUMBER_WORDS[cur]) : cur);
  }
  return out.join(' ');
}

function tokenize(norm){
  const s = norm;
  const tokens = [];
  let i = 0;

  const push = (type, text, value, start, end) => tokens.push({ type, text, value, start, end });
  const isAlpha = c => /[a-z]/.test(c);
  const isDigit = c => /[0-9]/.test(c);

  while (i < s.length){
    const c = s[i];
    if (c === ' '){ i++; continue; }
    const start = i;

    if (c === ',' || c === '/' || c === ':' || c === '-'){
      push('punct', c, c, start, start+1);
      i++;
      continue;
    }

    if (isDigit(c)){
      let j = i;
      while (j < s.length && isDigit(s[j])) j++;
      const numText = s.slice(i, j);
      push('number', numText, parseInt(numText,10), start, j);
      i = j;
      continue;
    }

    if (isAlpha(c) || c === "'"){
      let j = i;
      while (j < s.length && (isAlpha(s[j]) || s[j]==="'" )) j++;
      const w = s.slice(i, j);

      if (WEEKDAY_LOOKUP[w] != null) push('weekday', w, WEEKDAY_LOOKUP[w], start, j);
      else if (MONTH_LOOKUP[w] != null) push('month', w, MONTH_LOOKUP[w], start, j);
      else if (UNIT_CANON[w] != null) push('unit', w, UNIT_CANON[w], start, j);
      else if (w === 'am' || w === 'pm') push('meridiem', w, w, start, j);
      else if (KEYWORDS.has(w)) push('kw', w, w, start, j);
      else push('word', w, w, start, j);

      i = j;
      continue;
    }

    push('unknown', c, c, start, start+1);
    i++;
  }

  return tokens;
}

// ---------- Parsing ----------

function parseDateTime(tokens){
  if (looksTimeLeading(tokens)) {
    const tlead = parseTimeLeading(tokens);
    if (tlead.ok || tlead.incomplete) return tlead;
  }
  return parseDateWithOptionalTime(tokens);
}

function looksTimeLeading(tokens){
  if (!tokens.length) return false;
  if (tokens[0].type === 'kw' && NAMED_TIMES[tokens[0].text]) return true;
  if (tokens[0].type === 'kw' && TIME_BUCKETS[tokens[0].text]) return true;
  if (tokens[0].text === 'in' && tokens[1]?.text === 'the') return true;
  if (tokens[0] && tokens[1] && TIME_BUCKETS[`${tokens[0].text} ${tokens[1].text}`]) return true;
  if (tokens[0].type === 'kw' && tokens[0].text === 'at' && tokens[1]?.type === 'kw' && NAMED_TIMES[tokens[1].text]) return true;
  if (tokens[0].type === 'kw' && tokens[0].text === 'at') return true;
  if (tokens[0].type === 'number'){
    // numeric date MM/DD... or MM-DD-... => not time-leading
    if ((tokens[1]?.type==='punct' && (tokens[1].text==='/' || tokens[1].text==='-'))) return false;
    // N unit => relative, not time-leading
    if (tokens[1]?.type === 'unit' || (tokens[1]?.type === 'word' && UNIT_WORDS.some(u => u.startsWith(tokens[1].text)))) return false;
    // 12:30 or 5:00
    if (tokens[1]?.type==='punct' && tokens[1].text === ':') return true;
    // 5 pm
    if (tokens[1]?.type==='meridiem') return true;
    return false;
  }
  return false;
}

function parseTimeLeading(tokens){
  let idx = 0;
  if (tokens[idx]?.type === 'kw' && tokens[idx].text === 'at'){
    idx++;
    if (!tokens[idx]) return { ok:false, incomplete:true, reason:'awaiting_time', expected:[{ kind:'time' }] };
  }

  let timeRes = parseSpecialTimePhrases(tokens, idx);
  if (!timeRes.ok) timeRes = parseBucketTime(tokens, idx);
  if (!timeRes.ok) timeRes = parseTimeAt(tokens, idx);
  if (!timeRes.ok) return timeRes.incomplete ? timeRes : { ok:false, incomplete:false };
  idx = timeRes.next;

  if (tokens[idx]?.type==='kw' && tokens[idx].text==='on') idx++;

  const dateTokens = tokens.slice(idx);
  if (!dateTokens.length){
    return { ok:true, ast:{ type:'datetime', date:{ type:'today' }, time: timeRes.time } };
  }

  const dateRes = parseDatePhrase(dateTokens);
  if (!dateRes.ok) return dateRes;

  return finalizeDateTimeAst({ type:'datetime', date: dateRes.date, time: timeRes.time });
}

function parseDateWithOptionalTime(tokens){
  const dateRes = parseDatePhrase(tokens);
  if (!dateRes.ok) return dateRes;
  let idx = dateRes.next;

  if (tokens[idx]?.type==='punct' && tokens[idx].text===',') idx++;

  if (idx < tokens.length){
    if (tokens[idx]?.type==='kw' && tokens[idx].text==='at' && !tokens[idx+1]){
      return { ok:false, incomplete:true, reason:'awaiting_time', expected:[{ kind:'time' }] };
    }

    const special = parseSpecialTimePhrases(tokens, idx);
    if (special.ok){
      idx = special.next;
      if (idx !== tokens.length) return { ok:false, incomplete:false };
      return finalizeDateTimeAst({ type:'datetime', date: dateRes.date, time: special.time });
    }

    const bucket = parseBucketTime(tokens, idx);
    if (bucket.ok){
      idx = bucket.next;
      if (idx !== tokens.length) return { ok:false, incomplete:false };
      return finalizeDateTimeAst({ type:'datetime', date: dateRes.date, time: bucket.time });
    }
    if (bucket.incomplete) return bucket;

    // If trailing word looks like a partial bucket, treat as incomplete for autocomplete.
    const trailing = tokens[idx];
    if (trailing?.type === 'word'){
      const matches = bucketMatches(trailing.text);
      if (matches.length){
        return {
          ok:false,
          incomplete:true,
          reason:'partial_time_bucket',
          expected:[{ kind:'time_bucket', options: matches }]
        };
      }
    }

    const timeRes = parseTimeAt(tokens, idx);
    if (timeRes.ok){
      idx = timeRes.next;
      if (idx !== tokens.length) return { ok:false, incomplete:false };
      return finalizeDateTimeAst({ type:'datetime', date: dateRes.date, time: timeRes.time });
    }
    if (timeRes.incomplete) return timeRes;

    return { ok:false, incomplete:false };
  }

  return finalizeDateTimeAst({ type:'datetime', date: dateRes.date });
}

function finalizeDateTimeAst(ast){
  return isCompatibleDateTimeAst(ast) ? { ok:true, ast } : { ok:false, incomplete:false };
}

function getExplicitTimeRule(dateExpr){
  const impliedKey = dateExpr?.impliedTime?.key;
  return impliedKey ? IMPLIED_TIME_RULES[impliedKey] || null : null;
}

function isCompatibleDateTimeAst(ast){
  if (!ast || ast.type !== 'datetime') return false;

  const rule = getExplicitTimeRule(ast.date);
  if (!rule || !ast.time) return true;

  if (ast.time.type === 'bucket'){
    return rule.bucketKeys ? rule.bucketKeys.has(ast.time.key) : true;
  }

  if (ast.time.type === 'time'){
    if (rule.minHour != null && ast.time.h < rule.minHour) return false;
    if (rule.maxHour != null && ast.time.h > rule.maxHour) return false;
  }

  return true;
}

function isCompatibleExplicitTime(dateExpr, timeExpr){
  if (!timeExpr) return true;
  return isCompatibleDateTimeAst({ type:'datetime', date: dateExpr, time: timeExpr });
}

function getTimeVariantsForAst(ast){
  const impliedKey = ast?.date?.impliedTime?.key;
  if (impliedKey && IMPLIED_TIME_VARIANTS[impliedKey]) return IMPLIED_TIME_VARIANTS[impliedKey];
  return DEFAULT_TIME_VARIANTS;
}

function parseSpecialTimePhrases(tokens, idx){
  const w1 = tokens[idx]?.text;
  const w2 = tokens[idx+1]?.text;
  const phrase2 = w1 && w2 ? `${w1} ${w2}` : null;

  if (phrase2 && TIME_BUCKETS[phrase2]) return { ok:true, time:{ type:'bucket', key: phrase2 }, next: idx+2 };
  if (w1 && TIME_BUCKETS[w1]) return { ok:true, time:{ type:'bucket', key: w1 }, next: idx+1 };
  return { ok:false };
}

function parseBucketTime(tokens, idx){
  const t1 = tokens[idx];
  const t2 = tokens[idx+1];
  const t3 = tokens[idx+2];

  const w1 = t1?.text;
  const w2 = t2?.text;
  const w3 = t3?.text;
  const phrase2 = w1 && w2 ? `${w1} ${w2}` : null;

  if (w1 === 'in' && w2 === 'the'){
    if (!t3){
      return {
        ok:false,
        incomplete:true,
        reason:'partial_time_bucket',
        expected:[{ kind:'time_bucket', options: ['morning', 'afternoon', 'evening'] }]
      };
    }
    if (w3 === 'morning' || w3 === 'afternoon' || w3 === 'evening'){
      return { ok:true, time:{ type:'bucket', key: w3 }, next: idx+3 };
    }
    if (t3.type === 'word'){
      const matches = ['morning', 'afternoon', 'evening'].filter(bucket => bucket.startsWith(t3.text));
      if (matches.length){
        return {
          ok:false,
          incomplete:true,
          reason:'partial_time_bucket',
          expected:[{ kind:'time_bucket', options: matches }]
        };
      }
    }
  }

  if (w1 === 'at'){
    if (!t2){
      return {
        ok:false,
        incomplete:true,
        reason:'partial_time_bucket',
        expected:[{ kind:'time_bucket', options: ['night'] }]
      };
    }
    if (w2 === 'night'){
      return { ok:true, time:{ type:'bucket', key:'night' }, next: idx+2 };
    }
    if (t2.type === 'word' && 'night'.startsWith(t2.text)){
      return {
        ok:false,
        incomplete:true,
        reason:'partial_time_bucket',
        expected:[{ kind:'time_bucket', options: ['night'] }]
      };
    }
  }

  if (phrase2 && TIME_BUCKETS[phrase2]) return { ok:true, time:{ type:'bucket', key: phrase2 }, next: idx+2 };
  if (w1 && TIME_BUCKETS[w1]) return { ok:true, time:{ type:'bucket', key: w1 }, next: idx+1 };

  if (t1?.type === 'word'){
    const matches = bucketMatches(t1.text);
    if (matches.length){
      return { ok:false, incomplete:true, reason:'partial_time_bucket', expected:[{ kind:'time_bucket', options: matches }] };
    }
  }

  return { ok:false };
}

function parseTimeAt(tokens, idx){
  let i = idx;
  if (tokens[i]?.type==='kw' && tokens[i].text==='at'){
    i++;
    if (!tokens[i]) return { ok:false, incomplete:true, reason:'awaiting_time', expected:[{ kind:'time' }] };
  }

  const named = tokens[i];
  if (named?.type === 'kw' && NAMED_TIMES[named.text]){
    const t = NAMED_TIMES[named.text];
    return { ok:true, time:{ type:'time', h:t.h, m:t.m }, next:i+1 };
  }

  const n1 = tokens[i];
  if (!n1 || n1.type !== 'number') return { ok:false, incomplete:false };

  const colon = tokens[i+1]?.type==='punct' && tokens[i+1].text === ':';
  const n2 = colon ? tokens[i+2] : null;
  const mer = colon ? tokens[i+3] : tokens[i+1];

  let hours = n1.value;
  let minutes = 0;
  let next = i+1;

  if (colon){
    if (!n2 || n2.type !== 'number') return { ok:false, incomplete:true, reason:'awaiting_minutes', expected:[{ kind:'minutes' }] };
    minutes = n2.value;
    next = i+3;
  }

  const hasMeridiem = mer && mer.type === 'meridiem';
  if (hasMeridiem){
    const period = mer.text;
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return { ok:false, incomplete:false };
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    next = colon ? i+4 : i+2;
    return { ok:true, time:{ type:'time', h: hours, m: minutes }, next };
  }

  // Partial meridiem: "a" or "p" as a word token
  const partialMer = mer && mer.type === 'word' && mer.text.length <= 2 &&
    ('am'.startsWith(mer.text) || 'pm'.startsWith(mer.text));
  if (partialMer) {
    return { ok:false, incomplete:true, reason:'partial_meridiem', hour: hours, minutes,
             expected:[{ kind:'meridiem' }] };
  }

  if (colon){
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return { ok:false, incomplete:false };
    return { ok:true, time:{ type:'time', h: hours, m: minutes }, next };
  }

  // bare hour => ambiguous
  if (hours >= 1 && hours <= 12){
    return { ok:false, incomplete:true, reason:'ambiguous_hour', hour: hours, expected:[{ kind:'meridiem' },{ kind:'time_examples' }] };
  }

  if (hours >= 0 && hours <= 23){
    return { ok:true, time:{ type:'time', h: hours, m: 0 }, next };
  }

  return { ok:false, incomplete:false };
}

function parseHolidayAt(tokens, i){
  if (!tokens[i]) return { ok:false };

  for (const size of [3, 2, 1]){
    const slice = tokens.slice(i, i + size);
    if (slice.length !== size) continue;
    if (slice.some(t => t.type === 'punct' || t.type === 'unknown')) continue;
    const candidate = slice.map(t => t.text).join(' ');
    const key = canonicalizeHolidayName(candidate);
    if (key) return { ok:true, key, next:i + size };
  }

  const rest = tokens.slice(i);
  if (!rest.length) return { ok:false };
  if (rest.some(t => t.type === 'punct' || t.type === 'unknown')) return { ok:false };

  const prefix = rest.map(t => t.text).join(' ');
  if (normalizeHolidayText(prefix).length < 2) return { ok:false };
  const matches = holidayMatchesPrefix(prefix);
  if (matches.length){
    return { ok:false, incomplete:true, reason:'partial_holiday', expected:[{ kind:'holiday', options: matches }] };
  }

  return { ok:false };
}

function parseDatePhrase(tokens){
  if (!tokens.length){
    return { ok:false, incomplete:true, reason:'empty', expected:[{ kind:'date' }] };
  }

  let i = 0;
  let sawOn = false;
  if (tokens[i]?.type==='kw' && tokens[i].text==='on'){
    sawOn = true;
    i++;
    if (!tokens[i]) return { ok:false, incomplete:true, reason:'on_what', expected:[{ kind:'on_target' }] };
  }

  // Multiword specials (limited, deterministic)
  {
    const w1 = tokens[i]?.text;
    const w2 = tokens[i+1]?.text;
    const w3 = tokens[i+2]?.text;

    if (w1==='last' && w2==='night'){
      return { ok:true, date:{ type:'yesterday', impliedTime:{ type:'bucket', key:'night' } }, next:i+2 };
    }
    if (w1==='this' && w2==='morning'){
      return { ok:true, date:{ type:'today', impliedTime:{ type:'bucket', key:'this morning' } }, next:i+2 };
    }
    if (w1==='later' && w2==='today'){
      return { ok:true, date:{ type:'today', impliedTime:{ type:'bucket', key:'later today' } }, next:i+2 };
    }
    if (w1==='sometime' && w2==='next' && w3==='week'){
      // deterministic: choose mid-week of next week
      return { ok:true, date:{ type:'range_hint', base:{ type:'next_unit', unit:'week' } }, next:i+3 };
    }
  }

  const kw = tokens[i];
  if (kw.type==='kw'){
    if (kw.text==='now') return { ok:true, date:{ type:'now' }, next:i+1 };
    if (kw.text==='today') return { ok:true, date:{ type:'today' }, next:i+1 };
    if (kw.text==='tomorrow') return { ok:true, date:{ type:'tomorrow' }, next:i+1 };
    if (kw.text==='yesterday') return { ok:true, date:{ type:'yesterday' }, next:i+1 };
    if (kw.text==='tonight') return { ok:true, date:{ type:'today', impliedTime:{ type:'bucket', key:'tonight' } }, next:i+1 };
    if (kw.text==='whenever') return { ok:true, date:{ type:'whenever' }, next:i+1 };
    if (kw.text==='in') return parseRelative(tokens, i);
  }

  // this/next/last + weekday OR unit (week/month/year)
  const mod = parseModifierLead(tokens, i);
  if (mod.ok || mod.incomplete) return mod;

  // weekday
  if (tokens[i]?.type==='weekday'){
    return { ok:true, date:{ type:'weekday', mode:'next_or_today', weekday: tokens[i].value }, next:i+1 };
  }

  const holiday = parseHolidayAt(tokens, i);
  if (holiday.ok) return { ok:true, date:{ type:'holiday', mode:'next_or_this', key: holiday.key }, next:holiday.next };
  if (holiday.incomplete) return holiday;

  // month day [year]
  const absMonth = parseAbsoluteMonthDay(tokens, i);
  if (absMonth.ok || absMonth.incomplete) return absMonth;

  // numeric date (supports / and -)
  const absNum = parseNumericDate(tokens, i);
  if (absNum.ok || absNum.incomplete) return absNum;

  // relative
  const rel = parseRelative(tokens, i);
  if (rel.ok || rel.incomplete) return rel;

  // If user typed "on <partial>", produce partial expected for weekday/month
  if (sawOn && tokens[i]?.type === 'word'){
    const w = tokens[i].text;
    const weekdayMatches = WEEKDAYS.filter(d=>d.startsWith(w));
    const monthMatches = MONTHS.filter(m=>m.startsWith(w));
    if (weekdayMatches.length || monthMatches.length){
      return {
        ok:false,
        incomplete:true,
        reason:'partial_on_target',
        expected:[
          weekdayMatches.length ? { kind:'weekday', options: weekdayMatches } : null,
          monthMatches.length ? { kind:'month', options: monthMatches } : null
        ].filter(Boolean)
      };
    }
  }

  // generic partials
  if (tokens[i]?.type === 'word'){
    const w = tokens[i].text;
    const weekdayMatches = WEEKDAYS.filter(d=>d.startsWith(w));
    if (weekdayMatches.length) return { ok:false, incomplete:true, reason:'partial_weekday', expected:[{ kind:'weekday', options: weekdayMatches }] };
    const monthMatches = MONTHS.filter(m=>m.startsWith(w));
    if (monthMatches.length) return { ok:false, incomplete:true, reason:'partial_month', expected:[{ kind:'month', options: monthMatches }] };
    const unitMatches = UNIT_WORDS.filter(u=>u.startsWith(w)).map(u => UNIT_CANON[u]);
    if (unitMatches.length) return { ok:false, incomplete:true, reason:'partial_unit', expected:[{ kind:'unit', options: Array.from(new Set(unitMatches)) }] };
    const kwMatches = Array.from(KEYWORDS).filter(k=>k.startsWith(w));
    if (kwMatches.length) return { ok:false, incomplete:true, reason:'partial_keyword', expected:[{ kind:'keyword', options: kwMatches }] };
  }

  return { ok:false, incomplete:false };
}

function parseModifierLead(tokens, i){
  const t = tokens[i];
  if (!(t?.type==='kw' && (t.text==='this' || t.text==='next' || t.text==='last'))) return { ok:false };

  const mode = t.text;
  const nxt = tokens[i+1];
  if (!nxt){
    return { ok:false, incomplete:true, reason:`${mode}_what`, expected:[{ kind:'weekday_or_unit' }] };
  }

  // this/next/last weekday
  if (nxt.type==='weekday'){
    return { ok:true, date:{ type:'weekday', mode, weekday:nxt.value }, next:i+2 };
  }

  // this/next/last week|month|year
  const modifierUnit = nxt.type === 'unit' ? nxt.value : (nxt.type === 'kw' ? nxt.text : null);
  if (modifierUnit && (modifierUnit === 'week' || modifierUnit === 'month' || modifierUnit === 'year')){
    if (mode==='this') return { ok:true, date:{ type:'this_unit', unit:modifierUnit }, next:i+2 };
    if (mode==='next') return { ok:true, date:{ type:'next_unit', unit:modifierUnit }, next:i+2 };
    if (mode==='last') return { ok:true, date:{ type:'last_unit', unit:modifierUnit }, next:i+2 };
  }

  const holiday = parseHolidayAt(tokens, i+1);
  if (holiday.ok) return { ok:true, date:{ type:'holiday', mode, key: holiday.key }, next:holiday.next };
  if (holiday.incomplete) return holiday;

  // partial weekday/unit after modifier
  if (nxt.type==='word'){
    const w = nxt.text;
    const weekdayMatches = WEEKDAYS.filter(d=>d.startsWith(w));
    const unitMatches = ['week','month','year'].filter(u=>u.startsWith(w));

    if (weekdayMatches.length || unitMatches.length){
      return {
        ok:false,
        incomplete:true,
        reason:'partial_after_modifier',
        expected:[
          weekdayMatches.length ? { kind:'weekday', options: weekdayMatches } : null,
          unitMatches.length ? { kind:'unit', options: unitMatches } : null
        ].filter(Boolean)
      };
    }
  }

  return { ok:false, incomplete:false };
}

function parseAbsoluteMonthDay(tokens, i){
  if (tokens[i]?.type !== 'month') return { ok:false };
  const monthIdx = tokens[i].value;

  const dayTok = tokens[i+1];
  if (!dayTok) return { ok:false, incomplete:true, reason:'awaiting_month_day', expected:[{ kind:'day' }] };
  if (dayTok.type !== 'number') return { ok:false, incomplete:false };
  const day = dayTok.value;

  let j = i+2;
  let year = null;
  const yearTok = tokens[j];
  if (yearTok && yearTok.type==='number'){
    let y = yearTok.value;
    if (y >= 0 && y <= 99) y = 2000 + y;
    year = y;
    j++;
  }

  return { ok:true, date:{ type:'absolute', month:monthIdx, day, year }, next:j };
}

function parseNumericDate(tokens, i){
  // supports 12/31[/2020] and 12-31-2020
  const t1 = tokens[i];
  if (!t1 || t1.type !== 'number') return { ok:false };

  const sep = tokens[i+1];
  const t2 = tokens[i+2];
  if (!(sep?.type==='punct' && (sep.text==='/' || sep.text==='-') && t2?.type==='number')) return { ok:false };

  const mm = t1.value;
  const dd = t2.value;

  let j = i+3;
  let year = null;

  const sep2 = tokens[j];
  if (sep2?.type==='punct' && (sep2.text==='/' || sep2.text==='-')){
    const yTok = tokens[j+1];
    if (!yTok) return { ok:false, incomplete:true, reason:'awaiting_year', expected:[{ kind:'year' }] };
    if (yTok.type !== 'number') return { ok:false, incomplete:false };
    let y = yTok.value;
    if (y >= 0 && y <= 99) y = 2000 + y;
    year = y;
    j += 2;
  }

  if (mm < 1 || mm > 12) return { ok:false, incomplete:false };
  if (dd < 1 || dd > 31) return { ok:false, incomplete:false };

  return { ok:true, date:{ type:'numeric', month:mm, day:dd, year }, next:j };
}

function parseRelative(tokens, i){
  // in N unit
  if (tokens[i]?.type==='kw' && tokens[i].text==='in'){
    const nTok = tokens[i+1];
    if (!nTok) return { ok:false, incomplete:true, reason:'awaiting_number', expected:[{ kind:'number_examples' }] };
    if (nTok.type !== 'number') return { ok:false, incomplete:false };

    const uTok = tokens[i+2];
    if (!uTok) return { ok:false, incomplete:true, reason:'awaiting_unit', expected:[{ kind:'unit', options: CANON_UNITS }] };

    if (uTok.type==='word'){
      const matches = UNIT_WORDS.filter(u => u.startsWith(uTok.text));
      if (matches.length){
        const opts = Array.from(new Set(matches.map(u => UNIT_CANON[u])));
        return { ok:false, incomplete:true, reason:'partial_unit', expected:[{ kind:'unit', options: opts }] };
      }
      return { ok:false, incomplete:false };
    }

    const unit = uTok.type==='unit' ? uTok.value : (UNIT_CANON[uTok.text] || null);
    if (!unit) return { ok:false, incomplete:true, reason:'partial_unit', expected:[{ kind:'unit', options: CANON_UNITS }] };

    return { ok:true, date:{ type:'relative', base:{ type:'now' }, amount:nTok.value, unit }, next:i+3 };
  }

  // N unit [from ... | ago]
  const nTok = tokens[i];
  const uTok = tokens[i+1];
  if (nTok?.type==='number'){
    if (uTok?.type==='word'){
      const matches = UNIT_WORDS.filter(u => u.startsWith(uTok.text));
      if (matches.length){
        const opts = Array.from(new Set(matches.map(u => UNIT_CANON[u])));
        return { ok:false, incomplete:true, reason:'partial_unit', expected:[{ kind:'unit', options: opts }] };
      }
    }

    if (uTok?.type==='unit' || (uTok?.type==='kw' && UNIT_CANON[uTok.text])){
      const unit = uTok.type==='unit' ? uTok.value : UNIT_CANON[uTok.text];
      const after = tokens[i+2];

      if (!after){
        return { ok:false, incomplete:true, reason:'awaiting_from_clause', expected:[{ kind:'from_now' },{ kind:'from_base' },{ kind:'ago' }] };
      }
      if (after.type==='kw' && after.text==='ago'){
        return { ok:true, date:{ type:'relative', base:{ type:'now' }, amount:-nTok.value, unit }, next:i+3 };
      }
      if (after.type==='kw' && after.text==='from'){
        const baseRes = parseBaseRef(tokens, i+3);
        if (!baseRes.ok) return { ok:false, incomplete:true, reason:'awaiting_base', expected:[{ kind:'base_ref' }] };
        return { ok:true, date:{ type:'relative', base:baseRes.base, amount:nTok.value, unit }, next: baseRes.next };
      }
    }
  }

  return { ok:false };
}

function parseBaseRef(tokens, i){
  if (!tokens[i]) return { ok:false, incomplete:true, reason:'awaiting_base', expected:[{ kind:'base_ref' }] };

  if (tokens[i].type==='kw' && ['now','today','tomorrow','yesterday'].includes(tokens[i].text)){
    return { ok:true, base:{ type: tokens[i].text }, next:i+1 };
  }

  if (tokens[i].type==='kw' && ['next','this','last'].includes(tokens[i].text)){
    const wd = tokens[i+1];
    if (!wd) return { ok:false, incomplete:true, reason:'awaiting_weekday', expected:[{ kind:'weekday' }] };
    if (wd.type==='weekday'){
      return { ok:true, base:{ type:'weekday', mode:tokens[i].text, weekday:wd.value }, next:i+2 };
    }
    if (wd.type==='word'){
      const matches = WEEKDAYS.filter(d=>d.startsWith(wd.text));
      if (matches.length) return { ok:false, incomplete:true, reason:'partial_weekday', expected:[{ kind:'weekday', options:matches }] };
    }
    return { ok:false, incomplete:false };
  }

  if (tokens[i].type==='weekday'){
    return { ok:true, base:{ type:'weekday', mode:'next_or_today', weekday:tokens[i].value }, next:i+1 };
  }

  if (tokens[i].type==='word'){
    const matches = WEEKDAYS.filter(d=>d.startsWith(tokens[i].text));
    if (matches.length) return { ok:false, incomplete:true, reason:'partial_weekday', expected:[{ kind:'weekday', options:matches }] };
  }

  return { ok:false, incomplete:false };
}

// ---------- Resolve ----------

function resolve(ast, opts){
  const referenceDate = opts?.referenceDate ? new Date(opts.referenceDate) : new Date();
  const cfg = {
    defaultTime: opts?.defaultTime || defaultTime(referenceDate),
    buckets: opts?.buckets || TIME_BUCKETS,
    wheneverDays: Number.isFinite(opts?.wheneverDays) ? opts.wheneverDays : 60,
    observed: Boolean(opts?.observed)
  };

  if (ast.type !== 'datetime') throw new Error('Expected datetime AST');

  const computed = resolveDateExpr(ast.date, referenceDate, cfg);

  // now with no explicit/implied time => exact now
  if (ast.date.type === 'now' && !ast.time && !ast.date?.impliedTime) return cloneDate(referenceDate);

  // relative hour/minute with no explicit/implied time => keep computed exact time
  if (ast.date.type === 'relative' && (ast.date.unit === 'hour' || ast.date.unit === 'minute') && !ast.time && !ast.date?.impliedTime){
    return computed;
  }

  const timeExpr = ast.time || ast.date?.impliedTime || null;
  const time = timeExpr ? resolveTimeExpr(timeExpr, cfg) : cfg.defaultTime;
  return setTime(computed, time);
}

function resolveDateExpr(dateExpr, referenceDate, cfg){
  const today = startOfDay(referenceDate);

  switch(dateExpr.type){
    case 'now': return cloneDate(referenceDate);
    case 'today': return today;
    case 'tomorrow': { const d=cloneDate(today); d.setDate(d.getDate()+1); return d; }
    case 'yesterday': { const d=cloneDate(today); d.setDate(d.getDate()-1); return d; }

    case 'weekday': {
      const wd = dateExpr.weekday;
      if (dateExpr.mode === 'this') return nextWeekday(referenceDate, wd, true);
      if (dateExpr.mode === 'next') return nextWeekday(referenceDate, wd, false);
      if (dateExpr.mode === 'last') return prevWeekday(referenceDate, wd, false);
      return nextWeekday(referenceDate, wd, true);
    }

    case 'absolute': {
      const y = dateExpr.year != null ? dateExpr.year : referenceDate.getFullYear();
      const m = dateExpr.month;
      const d = dateExpr.day;
      if (dateExpr.year == null){
        if (!isValidYMD(y, m, d)) return new Date(NaN);
        const candidate = new Date(y, m, d);
        if (candidate < today) return new Date(y+1, m, d);
        return candidate;
      }
      if (!isValidYMD(y, m, d)) return new Date(NaN);
      return new Date(y, m, d);
    }

    case 'numeric': {
      const mm = dateExpr.month;
      const dd = dateExpr.day;
      if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return new Date(NaN);
      const m = mm - 1;
      let y = dateExpr.year != null ? dateExpr.year : referenceDate.getFullYear();
      if (!isValidYMD(y, m, dd)) return new Date(NaN);
      const candidate = new Date(y, m, dd);
      if (dateExpr.year == null && candidate < today) return new Date(y+1, m, dd);
      return candidate;
    }

    case 'relative': {
      const base = resolveBase(dateExpr.base, referenceDate, cfg);
      return addUnits(base, dateExpr.amount, dateExpr.unit);
    }

    case 'whenever': {
      const d = startOfDay(referenceDate);
      d.setDate(d.getDate() + Math.floor(Math.random() * Math.max(1, cfg.wheneverDays)));
      return d;
    }

    case 'holiday': {
      return resolveHolidayOccurrence(dateExpr.key, referenceDate, dateExpr.mode, cfg.observed) || new Date(NaN);
    }

    case 'this_unit': return startOfDay(referenceDate);

    case 'next_unit': {
      const d = startOfDay(referenceDate);
      if (dateExpr.unit === 'week') d.setDate(d.getDate()+7);
      if (dateExpr.unit === 'month') d.setMonth(d.getMonth()+1);
      if (dateExpr.unit === 'year') d.setFullYear(d.getFullYear()+1);
      return d;
    }

    case 'last_unit': {
      const d = startOfDay(referenceDate);
      if (dateExpr.unit === 'week') d.setDate(d.getDate()-7);
      if (dateExpr.unit === 'month') d.setMonth(d.getMonth()-1);
      if (dateExpr.unit === 'year') d.setFullYear(d.getFullYear()-1);
      return d;
    }

    case 'range_hint': {
      // "sometime next week" => mid of next week
      const base = resolveDateExpr(dateExpr.base, referenceDate, cfg);
      const mid = cloneDate(base);
      mid.setDate(mid.getDate() + 3);
      return mid;
    }

    default:
      return new Date(NaN);
  }
}

function resolveBase(baseExpr, referenceDate, cfg){
  if (!baseExpr || baseExpr.type === 'now') return cloneDate(referenceDate);
  if (baseExpr.type === 'today') return startOfDay(referenceDate);
  if (baseExpr.type === 'tomorrow') { const d=startOfDay(referenceDate); d.setDate(d.getDate()+1); return d; }
  if (baseExpr.type === 'yesterday') { const d=startOfDay(referenceDate); d.setDate(d.getDate()-1); return d; }
  if (baseExpr.type === 'weekday') return resolveDateExpr(baseExpr, referenceDate, cfg);
  return cloneDate(referenceDate);
}

function resolveTimeExpr(timeExpr, cfg){
  if (timeExpr.type === 'time') return { h: timeExpr.h, m: timeExpr.m };
  if (timeExpr.type === 'bucket'){
    const t = cfg.buckets[timeExpr.key];
    return t ? { h: t.h, m: t.m } : cfg.defaultTime;
  }
  return cfg.defaultTime;
}

function formatValue(d){
  const y = d.getFullYear();
  const mo = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  const ss = String(d.getSeconds()).padStart(2,'0');
  return `${y}-${mo}-${da}T${hh}:${mm}:${ss}`;
}

// ---------- Suggestions ----------

const DISPLAY_PHRASES = [
  ["new year's day", "New Year's Day"],
  ["new year's eve", "New Year's Eve"],
  ["valentine's day", "Valentine's Day"],
  ["mother's day", "Mother's Day"],
  ["father's day", "Father's Day"],
  ['martin luther king jr day', 'Martin Luther King Jr Day'],
  ['martin luther king day', 'Martin Luther King Day'],
  ['presidents day', 'Presidents Day'],
  ["washington's birthday", "Washington's Birthday"],
  ['memorial day', 'Memorial Day'],
  ['labor day', 'Labor Day'],
  ['thanksgiving day', 'Thanksgiving Day'],
  ['thanksgiving', 'Thanksgiving'],
  ['independence day', 'Independence Day'],
  ['veterans day', 'Veterans Day'],
  ['good friday', 'Good Friday'],
  ['christmas', 'Christmas'],
  ['kwanzaa', 'Kwanzaa'],
  ['halloween', 'Halloween'],
  ['easter', 'Easter'],
  ['juneteenth', 'Juneteenth'],
  ['mlk day', 'MLK Day'],
  ['sunday', 'Sunday'],
  ['monday', 'Monday'],
  ['tuesday', 'Tuesday'],
  ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'],
  ['friday', 'Friday'],
  ['saturday', 'Saturday'],
  ['january', 'January'],
  ['february', 'February'],
  ['march', 'March'],
  ['april', 'April'],
  ['may', 'May'],
  ['june', 'June'],
  ['july', 'July'],
  ['august', 'August'],
  ['september', 'September'],
  ['october', 'October'],
  ['november', 'November'],
  ['december', 'December']
].sort((a, b) => b[0].length - a[0].length);

function formatSuggestionText(text){
  let formatted = String(text || '').trim().toLowerCase();
  if (!formatted) return formatted;

  formatted = formatted.replace(/\bam\b/g, 'AM').replace(/\bpm\b/g, 'PM');

  for (const [lower, display] of DISPLAY_PHRASES){
    formatted = formatted.replace(new RegExp(`\\b${escapeRegExp(lower)}\\b`, 'g'), display);
  }

  return formatted.replace(/^[a-z]/, ch => ch.toUpperCase());
}

function preserveTypedPrefix(rawInput, normalizedInput, candidateNorm){
  const raw = (rawInput || '').trim();
  if (!raw) return formatSuggestionText(candidateNorm);
  if (raw.toLowerCase() === normalizedInput && candidateNorm.startsWith(normalizedInput)){
    return formatSuggestionText(raw + candidateNorm.slice(normalizedInput.length));
  }
  return formatSuggestionText(candidateNorm);
}

function usesPrepositionalBucket(ast, baseText){
  if (!ast || ast.type !== 'datetime') return false;

  const dateType = ast.date?.type;
  if (dateType === 'weekday' || dateType === 'today' || dateType === 'tomorrow' ||
      dateType === 'yesterday' || dateType === 'holiday') {
    return false;
  }

  if ((baseText || '').startsWith('on ') && (dateType === 'weekday' || dateType === 'holiday')) {
    return false;
  }

  return true;
}

function bucketSuffix(bucket, prepositional){
  if (!prepositional) return bucket;
  if (bucket === 'night') return 'at night';
  if (bucket === 'morning' || bucket === 'afternoon' || bucket === 'evening') {
    return `in the ${bucket}`;
  }
  return bucket;
}

function appendBucketPhrase(baseText, bucket, ast, referenceDate){
  const base = String(baseText || '').trim();
  if (!base) return bucket;

  let parsedAst = ast || null;
  if (!parsedAst) {
    const parsed = parseAndResolve(base, { referenceDate });
    parsedAst = parsed.ok ? parsed.ast : null;
  }

  if (parsedAst?.date?.type === 'today' && !parsedAst?.date?.impliedTime) {
    if (bucket === 'night') return 'tonight';
    if (bucket === 'morning' || bucket === 'afternoon' || bucket === 'evening') {
      return `this ${bucket}`;
    }
  }

  return `${base} ${bucketSuffix(bucket, usesPrepositionalBucket(parsedAst, base))}`.trim();
}

function parseAndResolve(normInput, options){
  const toks = tokenize(normInput);
  const pr = parseDateTime(toks);
  if (!pr.ok) return pr;
  const referenceDate = options?.referenceDate ? new Date(options.referenceDate) : new Date();
  const dt = resolve(pr.ast, { ...options, referenceDate });
  if (Number.isNaN(dt.getTime())) return { ok:false, incomplete:false };
  if (!isAllowedResolvedDate(dt, referenceDate, options?.excludePast)) return { ok:false, incomplete:false };
  return { ok:true, datetime: dt, ast: pr.ast };
}

// Only expand early/late if user started typing it
function userWantsEarlyLate(normInput){
  return /\b(ea|ear|early|la|lat|late)\b/.test(normInput);
}

function allowTimeVariants(ast, normInput){
  if (!ast || ast.type !== 'datetime') return false;
  if (ast.date?.type === 'now') return false;
  if (ast.time) return false;
  if (ast.date?.type === 'relative' && (ast.date.unit === 'hour' || ast.date.unit === 'minute')) return false;
  return true;
}

function buildCandidates(normInput, parseResult, rawLower, referenceDate = new Date()){
  const out = new Set();
  const add = s => { if (s && s.trim()) out.add(s.trim()); };

  if (!normInput){
    ['now','today','tomorrow','yesterday','next week','next month','next year','next tuesday','in 1 hour','in 30 minutes','12/31/2020','february 14','whenever'].forEach(add);
    return Array.from(out);
  }

  if (parseResult.ok) add(normInput);

  const expected = parseResult.expected || [];

  // "in" should yield valid phrases immediately (all valid)
  if (normInput === 'in'){
    ['in 30 minutes','in 1 hour','in 2 hours','in 1 day','in 1 week','in 1 month','in 1 year'].forEach(add);
  }

  if (normInput === 'next'){
    ['christmas','easter','labor day','thanksgiving'].forEach(h => add(`next ${h}`));
    add('next week');
    add('next month');
    add('next year');
    WEEKDAYS.forEach(d => add(`next ${d}`));
  }

  {
    const mNextPartial = normInput.match(/^next\s+([a-z]+)$/);
    if (mNextPartial){
      const partial = mNextPartial[1];
      ['week','month','year'].filter(u => u.startsWith(partial)).forEach(u => add(`next ${u}`));
      WEEKDAYS.filter(d => d.startsWith(partial)).forEach(d => add(`next ${d}`));
    }
  }

  if (normInput === 'at'){
    add('at noon');
    add('at midnight');
  }

  if (normInput === 'this'){
    ['christmas','easter','labor day','thanksgiving'].forEach(h => add(`this ${h}`));
  }

  if (/^at\s+[nm]$/.test(normInput) || /^at\s+(no|mid|midn|midni|midnig|midnigh)$/.test(normInput)){
    if ('noon'.startsWith(normInput.slice(3))) add('at noon');
    if ('midnight'.startsWith(normInput.slice(3))) add('at midnight');
  }

  // bare number: suggest both "in N ..." and "N ... from now" (valid and grammatical)
  if (/^\d+$/.test(normInput)){
    const n = asInt(normInput);
    if (n != null){
      for (const u of ['minute','hour','day','week','month','year']){
        add(canonInPhrase(n, u));
      }
      for (const u of ['day','week','month','year']){
        add(canonCountUnitSuffix(n, u, 'from now'));
      }
    }
  }

  // "on" seed candidates: prefer weekdays and valid date forms; never "on today/yesterday/now"
  if (normInput === 'on'){
    WEEKDAYS.forEach(d => add(`on ${d}`));
    WEEKDAYS.forEach(d => add(`on this ${d}`));
    WEEKDAYS.forEach(d => add(`on next ${d}`));
    MONTHS.forEach(m => add(`on ${m} 1`));
    ['christmas','easter','labor day','thanksgiving',"new year's day",'halloween','kwanzaa'].forEach(h => add(`on ${h}`));
    add('on 5/20/2026');
    add('on 12/31/2020');
  }

  if (!normInput.includes(' ') && normInput.length >= 2 && /^[a-z0-9']+$/.test(normInput)){
    holidayMatchesPrefix(normInput).forEach(h => add(h));
  }

  {
    const onHolidayPartial = normInput.match(/^on\s+([a-z0-9'\s]+)$/);
    if (onHolidayPartial){
      holidayMatchesPrefix(onHolidayPartial[1]).forEach(h => add(`on ${h}`));
    }
  }

  {
    const modHolidayPartial = normInput.match(/^(this|next|last)\s+([a-z0-9'\s]+)$/);
    if (modHolidayPartial){
      holidayMatchesPrefix(modHolidayPartial[2]).forEach(h => add(`${modHolidayPartial[1]} ${h}`));
    }
  }

  for (const exp of expected){
    if (exp.kind === 'number_examples'){
      ['1','2','3','4','5','10','15','30','44'].forEach(n => add(`${normInput} ${n}`));
    }

    if (exp.kind === 'unit'){
      const options = exp.options || CANON_UNITS;
      const last = normInput.split(' ').slice(-1)[0];
      const lastIsPartial = /^[a-z]+$/.test(last) && !KEYWORDS.has(last) && !MONTH_LOOKUP[last] && !WEEKDAY_LOOKUP[last];
      options.forEach(u => {
        const inCountMatch = normInput.match(/^in\s+(\d+)(?:\s+[a-z]+)?$/);
        const countMatch = normInput.match(/^(\d+)(?:\s+[a-z]+)?$/);
        if (inCountMatch){
          const n = asInt(inCountMatch[1]);
          if (n != null){
            add(canonInPhrase(n, u));
            return;
          }
        }
        if (countMatch){
          const n = asInt(countMatch[1]);
          if (n != null){
            add(canonCountUnit(n, u));
            return;
          }
        }
        add(lastIsPartial ? replaceLastWord(normInput, canonicalUnit(u)) : `${normInput} ${canonicalUnit(u)}`);
      });
    }

    if (exp.kind === 'weekday_or_unit'){
      WEEKDAYS.forEach(w => add(`${normInput} ${w}`));
      ['week','month','year'].forEach(u => add(`${normInput} ${u}`));
    }

    if (exp.kind === 'weekday'){
      (exp.options || WEEKDAYS).forEach(w => add(replaceLastWord(normInput, w)));
    }

    if (exp.kind === 'month'){
      (exp.options || MONTHS).forEach(m => add(replaceLastWord(normInput, m)));
    }

    if (exp.kind === 'holiday'){
      const holidayBase = normInput.startsWith('on ') ? 'on'
        : /^(this|next|last)\b/.test(normInput) ? normInput.split(' ')[0]
        : '';
      (exp.options || []).forEach(h => add(holidayBase ? `${holidayBase} ${h}` : h));
    }

    if (exp.kind === 'time_bucket'){
      const last = normInput.split(' ').slice(-1)[0];
      const lastIsPartial = /^[a-z]+$/.test(last) && !KEYWORDS.has(last) && !MONTH_LOOKUP[last] && !WEEKDAY_LOOKUP[last];
      const baseText = lastIsPartial ? normInput.split(' ').slice(0, -1).join(' ') : normInput;
      const baseParsed = parseAndResolve(baseText, { referenceDate });
      (exp.options || []).forEach(b => {
        if (baseParsed.ok && !isCompatibleExplicitTime(baseParsed.ast.date, { type:'bucket', key:b })) return;
        add(appendBucketPhrase(baseText, b, baseParsed.ok ? baseParsed.ast : null, referenceDate));
      });
    }

    if (exp.kind === 'time'){
      const partial = normInput.split(' ').slice(-1)[0] || '';
      if ('noon'.startsWith(partial)) add(`${normInput} noon`);
      if ('midnight'.startsWith(partial)) add(`${normInput} midnight`);
      ['9 am','12 pm','3 pm','5 pm','6 am','8 am','9 pm','10 pm','11 am','1 pm','4 pm'].forEach(t => add(`${normInput} ${t}`));
    }

    if (exp.kind === 'meridiem'){
      const m = normInput.match(/(\d{1,2})$/);
      if (m){
        const h = m[1];
        ['am','pm'].forEach(p=>{
          add(`${normInput} ${p}`);
          ['00','15','30','45'].forEach(min=> add(`${normInput}:${min} ${p}`));
        });
      }
    }

    if (exp.kind === 'from_now'){
      const countUnit = parseCountUnitPhrase(normInput);
      if (countUnit){
        add(canonCountUnitSuffix(countUnit.n, countUnit.unit, 'from now'));
      } else {
        add(`${normInput} from now`);
      }
    }

    if (exp.kind === 'from_base'){
      const countUnit = parseCountUnitPhrase(normInput);
      if (countUnit){
        add(canonCountUnitSuffix(countUnit.n, countUnit.unit, 'from now'));
        add(canonCountUnitSuffix(countUnit.n, countUnit.unit, 'from today'));
      } else {
        add(`${normInput} from now`);
        add(`${normInput} from today`);
      }
    }

    if (exp.kind === 'ago'){
      const countUnit = parseCountUnitPhrase(normInput);
      if (countUnit){
        add(canonCountUnitSuffix(countUnit.n, countUnit.unit, 'ago'));
      } else {
        add(`${normInput} ago`);
      }
    }

    if (exp.kind === 'base_ref'){
      ['now','today','tomorrow','yesterday','friday','next friday','this friday','last friday','next week','next month','next year'].forEach(b => add(`${normInput} ${b}`));
    }

    if (exp.kind === 'on_target'){
      WEEKDAYS.forEach(d => add(`on ${d}`));
      WEEKDAYS.forEach(d => add(`on this ${d}`));
      WEEKDAYS.forEach(d => add(`on next ${d}`));
      MONTHS.forEach(m => add(`on ${m} 1`));
      add('on 5/20/2026');
      add('on 12/31/2020');
    }

    // "1 w" → expected unit is "week" → "1 week from now", "in 1 week", etc.
    if (exp.kind === 'unit') {
      for (const u of (exp.options || [])) {
        const nm = normInput.match(/(\d+)/);
        if (nm) {
          const num = parseInt(nm[1]);
          const plural = num === 1 ? u : u + 's';
          add(`${num} ${plural} from now`);
          add(`${num} ${plural} from today`);
          add(`${num} ${plural} ago`);
          add(`in ${num} ${plural}`);
        }
      }
    }

    // "fri a" → expected weekday is "friday" → "friday", "this friday", "next friday at ..."
    if (exp.kind === 'weekday') {
      for (const d of (exp.options || [])) {
        add(d);
        add(`this ${d}`);
        add(`next ${d}`);
        add(`${d} at 9 am`);
        add(`${d} at 3 pm`);
        add(`${d} at 5 pm`);
      }
    }
  }

  // Add time variants for date-only phrases
  const pr2 = parseAndResolve(normInput, { referenceDate });
  if (pr2.ok && allowTimeVariants(pr2.ast, normInput)){
    getTimeVariantsForAst(pr2.ast).forEach(v => add(`${normInput} ${v}`));
    if (!pr2.ast.date?.impliedTime) {
      ['morning','afternoon','evening','night'].forEach(v => add(appendBucketPhrase(normInput, v, pr2.ast, referenceDate)));
    }
    if (userWantsEarlyLate(normInput)){
      ['early','late'].forEach(v => add(`${normInput} ${v}`));
    }
  }

  // Partial single-token weekday/month
  if (!normInput.includes(' ') && /^[a-z]+$/.test(normInput)){
    const wds = WEEKDAYS.filter(d => d.startsWith(normInput));
    wds.forEach(d => { add(d); add(`this ${d}`); add(`next ${d}`); });
    const mos = MONTHS.filter(m => m.startsWith(normInput));
    mos.forEach(m => [1,5,14,15].forEach(day => add(`${m} ${day}`)));
  }

  // "in <number>" => valid phrases immediately with correct pluralization
  {
    const m = normInput.match(/^in\s+(\d+)$/);
    if (m){
      const n = asInt(m[1]);
      if (n != null){
        for (const u of ['minute','hour','day','week','month','year']){
          add(canonInPhrase(n, u));
        }
      }
    }
  }

  // "<n> weeks" => canonicalize and suggest full valid endings
  {
    const countUnit = parseCountUnitPhrase(normInput);
    if (countUnit){
      add(canonCountUnitSuffix(countUnit.n, countUnit.unit, 'from now'));
      add(canonCountUnitSuffix(countUnit.n, countUnit.unit, 'from today'));
      add(canonCountUnitSuffix(countUnit.n, countUnit.unit, 'ago'));
    }
  }

  // "in <partial-word-number>" → "in tw" → "in 2 days", "in th" → "in 3 hours", etc.
  {
    const rawForIn = rawLower || normInput;
    const inPartialNum = rawForIn.match(/^in\s+([a-z]+)$/);
    if (inPartialNum) {
      const NUM_WORDS = {two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10,
                         twenty:20, thirty:30, forty:40, fifty:50, sixty:60};
      const partial = inPartialNum[1];
      const matches = Object.entries(NUM_WORDS).filter(([w]) => w.startsWith(partial));
      for (const [, num] of matches) {
        for (const u of ['minute','hour','day','week','month','year']) {
          add(canonInPhrase(num, u));
        }
      }
    }
  }

  // "<n> weeks from" => base ref completions
  if (/^\d+\s+(day|days|week|weeks|month|months|year|years)\s+from$/.test(normInput)){
    ['now','today','tomorrow','yesterday','friday','next friday','this friday','next week','next month','next year'].forEach(b => add(`${normInput} ${b}`));
  }

  // "<n> <unit> from <partial>" → "1 week from t" → "1 week from today", "1 week from tomorrow"
  {
    const fromPartial = normInput.match(/^(\d+\s+(?:day|days|week|weeks|month|months|year|years)\s+from)\s+([a-z]*)$/);
    if (fromPartial) {
      const base = fromPartial[1];
      const p = fromPartial[2];
      ['now','today','tomorrow','friday','next friday','this friday','next week'].filter(b => b.startsWith(p)).forEach(b => add(`${base} ${b}`));
    }
  }

  // "<n> <unit> <partial-suffix-keyword>" - handles "1 week a" → "1 week ago" when normInput is like this
  {
    const unitSuffixPartial = normInput.match(/^(\d+)\s+(minute|hour|day|week|month|year)s?\s+([a-z]+)$/);
    if (unitSuffixPartial) {
      const n = parseInt(unitSuffixPartial[1]);
      const u = unitSuffixPartial[2];
      const p = unitSuffixPartial[3];
      const plural = n === 1 ? u : u + 's';
      if ('from'.startsWith(p) && p !== 'from') {
        add(`${n} ${plural} from now`);
        add(`${n} ${plural} from today`);
      }
      if ('ago'.startsWith(p) && p !== 'ago') {
        add(`${n} ${plural} ago`);
      }
    }
  }

  // ---- PARTIAL KEYWORD COMPLETIONS ----
  // Single-token keyword prefix matching (handles "tod"→"today", "tom"→"tomorrow", "noo"→"noon", etc.)
  const KW_SEEDS = ['today','tomorrow','yesterday','tonight','whenever','now','noon','midnight'];
  if (!normInput.includes(' ') && normInput.length >= 2 && /^[a-z]+$/.test(normInput)) {
    KW_SEEDS.filter(k => k.startsWith(normInput) && k !== normInput).forEach(k => add(k));
  }

  // Handle kind:'keyword' from expected (parser returns this for partial keyword matches)
  for (const exp of expected) {
    if (exp.kind === 'keyword') {
      for (const kw of (exp.options || [])) {
        add(kw);
        // Also add with time variants for date keywords
        if (['today','tomorrow','yesterday','tonight'].includes(kw)) {
          const kwParsed = parseAndResolve(kw, { referenceDate });
          if (kwParsed.ok) {
            getTimeVariantsForAst(kwParsed.ast).slice(0, 2).forEach(variant => add(`${kw} ${variant}`));
          }
        }
        if (['this','next','last'].includes(kw)) {
          WEEKDAYS.forEach(d => add(`${kw} ${d}`));
          ['week','month','year'].forEach(u => add(`${kw} ${u}`));
        }
      }
    }
  }

  // ---- MERIDIEM PARTIAL COMPLETIONS ----
  // Use rawLower to avoid "a"→"1" normalization issues
  // "at 3 a" → "at 3 am", "at 3 p" → "at 3 pm", "at 4p" → "4 pm", "5p" → "5 pm"
  {
    const rawForMer = rawLower || normInput;
    // Pattern: trailing partial meridiem after a number: "at 3 a", "at 3 p", "at 3:15 p"
    const merPartial = rawForMer.match(/(\d{1,2}(?::\d{1,2})?)\s*(a|p)$/);
    if (merPartial) {
      const timeBase = rawForMer.slice(0, rawForMer.length - merPartial[2].length).trim();
      const p = merPartial[2];
      if ('am'.startsWith(p)) add(`${timeBase} am`);
      if ('pm'.startsWith(p)) add(`${timeBase} pm`);
    }
    // Pattern: "5p" or "4a" (digit immediately followed by partial meridiem)
    const bareTimeP = rawForMer.match(/^(?:at\s+)?(\d{1,2})(a|p)$/);
    if (bareTimeP) {
      const h = bareTimeP[1];
      const p = bareTimeP[2];
      if ('am'.startsWith(p)) { add(`${h} am`); add(`${h}:00 am`); add(`${h}:30 am`); }
      if ('pm'.startsWith(p)) { add(`${h} pm`); add(`${h}:00 pm`); add(`${h}:30 pm`); }
    }
  }

  // ---- INCOMPLETE TIME EXPRESSIONS ----
  // "at 3:" → "at 3:00 am", "at 3:15 pm", etc.  "12:" → "12:00 pm", etc.
  {
    const colonPartial = normInput.match(/((?:at\s+)?\d{1,2}):(\d{0,1})$/);
    if (colonPartial) {
      const base = normInput.replace(/:\d{0,1}$/, '');
      for (const min of ['00','15','30','45']) {
        add(`${base}:${min} am`);
        add(`${base}:${min} pm`);
      }
    }
  }

  // ---- MULTI-WORD PARTIAL COMPLETIONS ----
  // Use rawLower (pre-normalization) to avoid "a"→"1" conversion breaking patterns
  // "tod a" → "today at ...", "fri a" → "friday at ...", "thi f" → "this friday", etc.
  {
    const rawForPartial = rawLower || normInput;
    const twoWords = rawForPartial.match(/^([a-z]+)\s+([a-z]*)$/);
    if (twoWords) {
      const w1 = twoWords[1];
      const w2 = twoWords[2];
      const w1Weekdays = WEEKDAYS.filter(d => d.startsWith(w1));
      const w1Kws = KW_SEEDS.filter(k => k.startsWith(w1));
      const w1Modifiers = ['this','next','last'].filter(m => m.startsWith(w1));

      // Resolve first word and complete second
      for (const r1 of [...w1Weekdays, ...w1Kws]) {
        // "fri a" → "friday at ..."
        if (w2 && 'at'.startsWith(w2)) {
          const parsedR1 = parseAndResolve(r1, { referenceDate });
          const variants = parsedR1.ok ? getTimeVariantsForAst(parsedR1.ast) : DEFAULT_TIME_VARIANTS;
          variants.forEach(variant => add(`${r1} ${variant}`));
        }
        // "tod a" → "today at ..."
        if (r1 === 'today' || r1 === 'tomorrow' || r1 === 'yesterday') {
          if (w2 && 'at'.startsWith(w2)) {
            add(`${r1} at 9 am`);
            add(`${r1} at 12 pm`);
            add(`${r1} at 3 pm`);
          }
        }
      }

      // Modifier completions: "thi f" → "this friday", "nex t" → "next tuesday"
      for (const mod of w1Modifiers) {
        WEEKDAYS.filter(d => d.startsWith(w2)).forEach(d => add(`${mod} ${d}`));
        ['week','month','year'].filter(u => u.startsWith(w2)).forEach(u => add(`${mod} ${u}`));
        // "las n" → "last night"
        if (mod === 'last' && 'night'.startsWith(w2)) add('last night');
      }

      // "lat t" → "later today"
      if ('later'.startsWith(w1) && w2 && 'today'.startsWith(w2)) add('later today');

      // "to n" → "tonight"
      if (w1.length >= 2 && 'tonight'.startsWith(w1) && (!w2 || 'tonight'.startsWith(w1 + w2))) add('tonight');

      // Word-number + partial-unit: "one d" → "1 day from now", "three mo" → "3 months from now"
      const NUM_WORD_MAP = {a:1, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10};
      const numVal = NUM_WORD_MAP[w1];
      if (numVal !== undefined && w2) {
        const UNITS = ['minute','hour','day','week','month','year'];
        const unitMatches = UNITS.filter(u => u.startsWith(w2));
        for (const u of unitMatches) {
          const plural = numVal === 1 ? u : u + 's';
          add(`${numVal} ${plural} from now`);
          add(`${numVal} ${plural} from today`);
          add(`${numVal} ${plural} ago`);
          add(`in ${numVal} ${plural}`);
        }
      }
    }

    const timeThenDate = rawForPartial.match(/^(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s+([a-z]+)$/);
    if (timeThenDate) {
      const hour = timeThenDate[1];
      const minutes = timeThenDate[2];
      const partialDate = timeThenDate[3];
      const timeBase = minutes ? `${hour}:${minutes}` : hour;
      const dateTargets = [
        ...WEEKDAYS,
        'today',
        'tomorrow',
        'yesterday'
      ].filter(target => target.startsWith(partialDate));

      dateTargets.forEach(target => {
        add(`${timeBase} am ${target}`);
        add(`${timeBase} pm ${target}`);
      });
    }

    // Three-word partial: "at 4pm to" → "at 4 pm today", "5pm tom" → "5 pm tomorrow"
    const threeWords = rawForPartial.match(/^(.+\s)([a-z]+)$/);
    if (threeWords) {
      const prefix = threeWords[1].trim();
      const partial = threeWords[2];
      const targets = ['today','tomorrow','yesterday'];
      for (const t of targets) {
        if (t.startsWith(partial) && t !== partial) add(`${prefix} ${t}`);
      }
      // "5am o" → "5 am on ..."
      if ('on'.startsWith(partial)) {
        WEEKDAYS.forEach(d => add(`${prefix} on ${d}`));
      }
      // "5am on dec" → "5 am on december 15", etc.
      if (/\bon\s*$/.test(prefix)) {
        const moPart = partial;
        MONTHS.filter(m => m.startsWith(moPart)).forEach(m => {
          [1,15,25].forEach(day => add(`${prefix} ${m} ${day}`));
        });
        WEEKDAYS.filter(d => d.startsWith(moPart)).forEach(d => add(`${prefix} ${d}`));
      }

      // Word-number + unit + partial-suffix: "one day a" → "1 day ago", "a week f" → "1 week from now"
      const NUM_WORD_MAP3 = {a:1, one:1, two:2, three:3, four:4, five:5, six:6};
      const prefixWords = prefix.split(/\s+/);
      if (prefixWords.length >= 2) {
        const pw1 = prefixWords[0];
        const pw2 = prefixWords.slice(1).join(' ');
        const numVal3 = NUM_WORD_MAP3[pw1];
        const UNITS3 = ['minute','minutes','hour','hours','day','days','week','weeks','month','months','year','years'];
        if (numVal3 !== undefined && UNITS3.some(u => pw2 === u || pw2.replace(/s$/, '') === u.replace(/s$/, ''))) {
          const baseUnit = pw2.replace(/s$/, '');
          const plural3 = numVal3 === 1 ? baseUnit : baseUnit + 's';
          if ('from'.startsWith(partial)) {
            add(`${numVal3} ${plural3} from now`);
            add(`${numVal3} ${plural3} from today`);
          }
          if ('ago'.startsWith(partial)) {
            add(`${numVal3} ${plural3} ago`);
          }
        }
      }

      // Also handle "<n> <unit> <partial>": "1 week a" → "1 week ago"
      const numUnitPartial = rawForPartial.match(/^(\d+)\s+(minute|hour|day|week|month|year)s?\s+([a-z]*)$/);
      if (numUnitPartial) {
        const n3 = parseInt(numUnitPartial[1]);
        const u3 = numUnitPartial[2];
        const p3 = numUnitPartial[3];
        const plural3b = n3 === 1 ? u3 : u3 + 's';
        if ('from'.startsWith(p3)) {
          add(`${n3} ${plural3b} from now`);
          add(`${n3} ${plural3b} from today`);
        }
        if ('ago'.startsWith(p3)) {
          add(`${n3} ${plural3b} ago`);
        }
      }
    }
  }

  // ---- NUMERIC DATE PARTIAL COMPLETIONS ----
  // "12/" or "on 12/" → suggest day completions
  {
    const slashMonthPartial = normInput.match(/^(?:on\s+)?(\d{1,2})\/$/);
    if (slashMonthPartial) {
      for (const d of [1,5,10,15,20,25,28,30,31]) add(`${normInput}${d}`);
    }
    // "12/31/" or "on 5/20/" → suggest year completions
    const slashYearPartial = normInput.match(/(?:^|on\s+)\d{1,2}\/\d{1,2}\/$/);
    if (slashYearPartial) {
      for (const y of [2024,2025,2026,2027]) add(`${normInput}${y}`);
    }
    // "12-" or "on 12-" → suggest day completions
    const dashPartial = normInput.match(/^(?:on\s+)?(\d{1,2})-$/);
    if (dashPartial) {
      for (const d of [1,5,10,15,20,25,28,30]) add(`${normInput}${d}`);
    }
    // "12/34" → invalid date, but suggest valid alternatives
    const slashInvalid = normInput.match(/^(?:on\s+)?(\d{1,2})\/(\d{2,})$/);
    if (slashInvalid && parseInt(slashInvalid[2]) > 31) {
      const m = slashInvalid[1];
      for (const d of [1,15,25]) add(`${m}/${d}`);
    }
  }

  // ---- "on mar" pattern (month prefix after "on") ----
  {
    const onMonthPartial = normInput.match(/^on\s+([a-z]+)$/);
    if (onMonthPartial) {
      const moPart = onMonthPartial[1];
      MONTHS.filter(m => m.startsWith(moPart) && m !== moPart).forEach(m => {
        [1,5,14,15].forEach(day => add(`on ${m} ${day}`));
      });
    }
  }

  // ---- "the first/last" patterns ----
  // Generate resolvable candidates like "march 1" instead of "the first of march"
  {
    const theFirst = normInput.match(/^the\s+(first|1|last)$/);
    if (theFirst) {
      const ord = theFirst[1];
      if (ord === 'first' || ord === '1') {
        MONTHS.forEach(m => add(`${m} 1`));
        MONTHS.forEach(m => add(`${m} 1 2026`));
      } else {
        MONTHS.forEach(m => { add(`${m} 28`); add(`${m} 30`); add(`${m} 31`); });
      }
    }

    const theFirstOf = normInput.match(/^the\s+(?:first|1|last(?:\s+day)?)\s+(?:of\s+)?(.*)$/);
    if (theFirstOf) {
      const rest = theFirstOf[1].trim();
      const isLast = /^the\s+last/.test(normInput);
      // "the first of t" → current month as reference
      if (!rest || 'the month'.startsWith(rest) || 'the'.startsWith(rest)) {
        // Current and nearby months
        MONTHS.forEach(m => {
          if (isLast) { add(`${m} 28`); add(`${m} 30`); }
          else { add(`${m} 1`); add(`${m} 1 2026`); }
        });
      }
      // "the first of mar" → "march 1"
      if (rest) {
        MONTHS.filter(m => m.startsWith(rest)).forEach(m => {
          if (isLast) { add(`${m} 28`); add(`${m} 30`); add(`${m} 31`); }
          else { add(`${m} 1`); add(`${m} 1 2025`); add(`${m} 1 2026`); }
        });
      }
    }

    // "the first of the month" as complete phrase → current month 1st
    if (normInput === 'the first of the month' || normInput === 'the 1 of the month') {
      MONTHS.forEach(m => { add(`${m} 1`); add(`${m} 1 2026`); });
    }

    // "the last day of the month" → last days of months
    if (normInput === 'the last day of the month') {
      MONTHS.forEach(m => { add(`${m} 28`); add(`${m} 30`); add(`${m} 31`); });
    }

    // "the first of the month, 3" → "in 3 months"
    const monthComma = normInput.match(/^the (?:first|1) of the month,?\s+(\d+)(.*)$/);
    if (monthComma) {
      const n = parseInt(monthComma[1]);
      add(`in ${n} months`);
    }

    // "the first of the month, 3 months from now" → "in 3 months"
    const monthCommaFull = normInput.match(/^the (?:first|1) of the month,?\s+(\d+)\s+months?\s+from\s+now$/);
    if (monthCommaFull) {
      add(`in ${parseInt(monthCommaFull[1])} months`);
    }

    // "the first of the month, 3 mo" → "in 3 months"
    const monthCommaPart = normInput.match(/^the (?:first|1) of the month,?\s+(\d+)\s+([a-z]*)$/);
    if (monthCommaPart) {
      const n = parseInt(monthCommaPart[1]);
      const rest = monthCommaPart[2];
      if ('months from now'.startsWith(rest) || 'months'.startsWith(rest) || 'mo'.startsWith(rest)) {
        add(`in ${n} months`);
      }
    }

    // "the fir" → "the first" partial
    if (/^the\s+[a-z]+$/.test(normInput)) {
      const partial = normInput.split(' ')[1];
      if ('first'.startsWith(partial)) {
        MONTHS.forEach(m => { add(`${m} 1`); add(`${m} 1 2026`); });
      }
      if ('last'.startsWith(partial)) {
        MONTHS.forEach(m => { add(`${m} 28`); add(`${m} 30`); });
      }
    }
  }

  // ---- "march 5th 2028" pattern (absolute date with ordinal + year) ----
  {
    const absDateOrd = normInput.match(/^([a-z]+)\s+(\d+)(?:st|nd|rd|th)\s+(\d{4})$/);
    if (absDateOrd) {
      const mo = absDateOrd[1];
      const day = absDateOrd[2];
      const yr = absDateOrd[3];
      // Re-add without ordinal for parsing
      add(`${mo} ${day} ${yr}`);
      add(`${mo} ${day} ${yr} at 9 am`);
      add(`${mo} ${day} ${yr} at 12 pm`);
    }
    // Also handle year-less: "the first of march 2025" → ordinal issues
    const theFirstOfMonth = normInput.match(/^the (?:first|1) of ([a-z]+)\s+(\d{4})$/);
    if (theFirstOfMonth) {
      add(`${theFirstOfMonth[1]} 1 ${theFirstOfMonth[2]}`);
      add(`${theFirstOfMonth[1]} 1 ${theFirstOfMonth[2]} at 9 am`);
    }
  }

  // ---- "the <weekday>" patterns ----
  // "the mon" → "this monday", "next monday"; "the monday a" → "this monday", "next monday"
  // "the friday after next" → "in 2 weeks on friday" (or just "next friday" as approximation)
  {
    // "the <partial-weekday>" or "the <weekday>"
    const theWeekday = normInput.match(/^the\s+([a-z]+)$/);
    if (theWeekday) {
      const partial = theWeekday[1];
      const wdMatches = WEEKDAYS.filter(d => d.startsWith(partial));
      for (const d of wdMatches) {
        add(`this ${d}`);
        add(`next ${d}`);
        add(`${d} at 9 am`);
        add(`${d} at 3 pm`);
      }
    }

    // "the monday a" or "the monday after" or "the monday after next"
    // Use rawLower to avoid "a"→"1" normalization
    const rawForTheWd = rawLower || normInput;
    const theWdAfter = rawForTheWd.match(/^the\s+(\w+)\s+(.*)$/);
    if (theWdAfter) {
      const wd = theWdAfter[1];
      const rest = theWdAfter[2].trim();
      const wdMatch = WEEKDAYS.find(d => d === wd || d.startsWith(wd));
      if (wdMatch) {
        // "the monday a" → could be "after next" or "at"
        if ('after next'.startsWith(rest) || 'after'.startsWith(rest)) {
          // "the monday after next" = 2 weeks from this/next monday
          add(`${wdMatch} in 2 weeks`);
          add(`next ${wdMatch}`);
          add(`this ${wdMatch}`);
        }
        if ('at'.startsWith(rest)) {
          add(`${wdMatch} at 9 am`);
          add(`${wdMatch} at 3 pm`);
          add(`${wdMatch} at 5 pm`);
          add(`this ${wdMatch}`);
          add(`next ${wdMatch}`);
        }
        // Default: add this/next variants
        if (!rest) {
          add(`this ${wdMatch}`);
          add(`next ${wdMatch}`);
        }
      }
    }
  }

  // ---- "two mondays from now" / "two mondays ago" patterns ----
  {
    const rawForRel = rawLower || normInput;
    const relWeekday = rawForRel.match(/^(\w+)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\s*(.*)$/);
    if (relWeekday) {
      const NUM_WORDS_REL = {a:1, one:1, two:2, three:3, four:4, five:5, six:6, two:2};
      const numStr = relWeekday[1];
      const rest = relWeekday[3].trim();
      const num = NUM_WORDS_REL[numStr] || parseInt(numStr);
      if (!isNaN(num) && num > 0) {
        // "two mondays from now" → "in N weeks" (approximate)
        // "two mondays ago" → "N weeks ago"
        if (!rest || 'from now'.startsWith(rest) || 'from'.startsWith(rest) || 'f'.startsWith(rest)) {
          add(`${num} weeks from now`);
          add(`in ${num} weeks`);
        }
        if (!rest || 'ago'.startsWith(rest) || 'a'.startsWith(rest)) {
          add(`${num} weeks ago`);
        }
      }
    }
  }

  // ---- "this mor" → "this morning", "sometime n" → "sometime next week" ----
  {
    const rawForMisc = rawLower || normInput;
    // "this <partial-time-bucket>" → "this morning", "this afternoon", etc.
    const thisBucket = rawForMisc.match(/^this\s+([a-z]+)$/);
    if (thisBucket) {
      const partial = thisBucket[1];
      for (const b of ['morning','afternoon','evening','night']) {
        if (b.startsWith(partial)) add(`this ${b}`);
      }
    }

    // "sometime <partial>" → "sometime next week", "sometime this week"
    const sometimePartial = rawForMisc.match(/^sometime\s+(.*)$/);
    if (sometimePartial) {
      const rest = sometimePartial[1].trim();
      const targets = ['next week','next month','next year','today','tomorrow'];
      for (const t of targets) {
        if (t.startsWith(rest)) add(`sometime ${t}`);
      }
      // "sometime next w" → "sometime next week"
      if (rest.startsWith('next ')) {
        const afterNext = rest.slice(5);
        ['week','month','year'].filter(u => u.startsWith(afterNext)).forEach(u => add(`sometime next ${u}`));
      }
    }
  }

  // ---- "12 30" → "12:30 pm" (space instead of colon) ----
  {
    const spaceTime = normInput.match(/^(\d{1,2})\s+(\d{1,2})$/);
    if (spaceTime) {
      const h = spaceTime[1];
      const m = spaceTime[2].padStart(2, '0');
      add(`${h}:${m} am`);
      add(`${h}:${m} pm`);
    }
  }

  // ---- "on dec 12th 2020" → strip ordinal suffix ----
  {
    const onDateOrd = normInput.match(/^on\s+([a-z]+)\s+(\d+)(?:st|nd|rd|th)\s+(\d{4})$/);
    if (onDateOrd) {
      add(`${onDateOrd[1]} ${onDateOrd[2]} ${onDateOrd[3]}`);
      add(`on ${onDateOrd[1]} ${onDateOrd[2]} ${onDateOrd[3]}`);
    }
    // Without year: "on dec 12th"
    const onDateOrdNoYear = normInput.match(/^on\s+([a-z]+)\s+(\d+)(?:st|nd|rd|th)$/);
    if (onDateOrdNoYear) {
      add(`${onDateOrdNoYear[1]} ${onDateOrdNoYear[2]}`);
      add(`on ${onDateOrdNoYear[1]} ${onDateOrdNoYear[2]}`);
    }
  }

  // ---- "every day", "every d", "eve d" → these are schedule-like but in datetime mode, offer "today", "tomorrow" ----
  {
    const rawForEvery = rawLower || normInput;
    if (/^(?:every|eve)\s/.test(rawForEvery) || rawForEvery === 'every') {
      add('today');
      add('tomorrow');
      add('next week');
    }
  }

  // ---- "i" / "in o" / "in on" → very short partial ----
  {
    if (normInput === 'i' || normInput === 'in') {
      for (const n of [1,2,5,10,15,30]) {
        for (const u of ['minute','hour','day','week','month']) {
          add(canonInPhrase(n, u));
        }
      }
    }
    // "in o" or "in on" → "in 1 hour"
    const rawForIn2 = rawLower || normInput;
    const inPartialWord = rawForIn2.match(/^in\s+([a-z]+)$/);
    if (inPartialWord) {
      const p = inPartialWord[1];
      // "in o" → could be "one" → "in 1 ..."
      const NUM_WORDS_IN = {one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10};
      const wordMatches = Object.entries(NUM_WORDS_IN).filter(([w]) => w.startsWith(p));
      for (const [, num] of wordMatches) {
        for (const u of ['minute','hour','day','week','month','year']) {
          add(canonInPhrase(num, u));
        }
      }
    }
  }

  // ---- "a week from next f" → "1 week from next friday" ----
  {
    const fromNextPartial = normInput.match(/^(\d+)\s+(day|week|month|year)s?\s+from\s+next\s+([a-z]*)$/);
    if (fromNextPartial) {
      const n = fromNextPartial[1];
      const u = fromNextPartial[2];
      const p = fromNextPartial[3];
      WEEKDAYS.filter(d => d.startsWith(p)).forEach(d => add(`${n} ${u}${parseInt(n)>1?'s':''} from next ${d}`));
      ['week','month','year'].filter(t => t.startsWith(p)).forEach(t => add(`${n} ${u}${parseInt(n)>1?'s':''} from next ${t}`));
    }
  }

  // ---- "two weeks from now on m" → approximate with "in N weeks" or "next <weekday>" ----
  {
    const fromNowOn = normInput.match(/^(\d+)\s+(day|week|month|year)s?\s+from\s+now\s+(?:on\s+)?([a-z]*)$/);
    if (fromNowOn) {
      const n = parseInt(fromNowOn[1]);
      const u = fromNowOn[2];
      const p = fromNowOn[3];
      const plural = n === 1 ? u : u + 's';
      // "2 weeks from now on monday" → generate "in 2 weeks" and "next monday"
      add(`in ${n} ${plural}`);
      add(`${n} ${plural} from now`);
      if (p) {
        WEEKDAYS.filter(d => d.startsWith(p)).forEach(d => {
          add(`next ${d}`);
          add(`${d} in ${n} ${plural}`);
        });
      }
    }
  }

  return Array.from(out);
}

function replaceLastWord(text, replacement){
  const parts = text.trim().split(' ');
  parts[parts.length-1] = replacement;
  return parts.join(' ');
}

// Ranking
function prefixScore(a, b){
  if (a === b) return 1;
  if (b.startsWith(a)) return Math.min(0.99, 0.8 + (a.length / Math.max(1, b.length)) * 0.19);
  const A = new Set(a.split(' ').filter(Boolean));
  const B = new Set(b.split(' ').filter(Boolean));
  let overlap = 0;
  for (const x of A) if (B.has(x)) overlap++;
  return 0.3 + Math.min(0.3, overlap * 0.1);
}

function semanticPreference(normInput, candidateNorm){
  const hasAt = /\bat\s+\d/.test(candidateNorm);
  const hasBucket = /\b(morning|afternoon|evening|night|early|late)\b/.test(candidateNorm);
  const hasHoliday = HOLIDAY_CANONICAL_NAMES.some(h => candidateNorm.includes(h));

  // Strong preference for weekday completions after "on"
  if (normInput === 'on' || normInput.startsWith('on ')){
    const isWeekday = /\bon\s+(this|next)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/.test(candidateNorm);
    const isNumeric = /\bon\s+\d{1,2}[\/-]\d{1,2}/.test(candidateNorm);
    const isMonth = /\bon\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(candidateNorm);

    if (isWeekday) return 0.08;
    if (isMonth) return 0.03;
    if (isNumeric) return 0.01;
  }

  // Promote explicit times over buckets generally
  if (hasAt) return 0.03;
  if (hasHoliday) return 0.025;
  if (hasBucket) return -0.005;
  return 0.01;
}

function normalizeDateTimeArgs(partialInput, referenceDateOrOptions, excludePastOrOptions, maybeOptions){
  if (isPlainObject(referenceDateOrOptions) || referenceDateOrOptions === undefined){
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

function buildDefaultBlankSuggestions(options){
  const { limit=10, includeValue=true } = options;
  const referenceDate = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const out = [];
  const seen = new Set();

  for (const seed of [...DEFAULT_BLANK_SEEDS, ...DEFAULT_BLANK_FALLBACKS]){
    const resolved = parseAndResolve(seed, { ...options, referenceDate });
    if (!resolved.ok) continue;

    const text = formatSuggestionText(seed);
    const key = normalizeInput(text).norm;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      label: text,
      input: text,
      value: includeValue ? { datetime: formatValue(resolved.datetime), timestamp: resolved.datetime.getTime() } : undefined,
      score: Math.max(0.7, 1 - out.length * 0.02),
      source: 'datetime'
    });

    if (out.length >= limit) break;
  }

  if (includeValue) return out;
  return out.map(({label,input,score,source})=>({label,input,score,source}));
}

function buildDateTimeSuggestions(partialInput, options = {}){
  const { limit=10, minScore=0.2, includeValue=true } = options;
  const referenceDate = options.referenceDate ? new Date(options.referenceDate) : new Date();

  const { raw, norm } = normalizeInput(partialInput || '');
  if (!norm) {
    return buildDefaultBlankSuggestions({ ...options, limit, includeValue, referenceDate });
  }

  const toks = tokenize(norm);
  const pr = parseDateTime(toks);

  const candidates = buildCandidates(norm, pr, (partialInput || '').toLowerCase().trim(), referenceDate);
  const suggestions = [];

  for (const c of candidates){
    const resolved = parseAndResolve(c, { ...options, referenceDate });
    if (!resolved.ok) continue;

    const score = prefixScore(norm, c);
    if (score < minScore) continue;

    const finalScore = Math.max(0, Math.min(1, score + semanticPreference(norm, c)));

    const text = preserveTypedPrefix(raw, norm, c);
    suggestions.push({
      label: text,
      input: text,
      value: includeValue ? { datetime: formatValue(resolved.datetime), timestamp: resolved.datetime.getTime() } : undefined,
      score: finalScore,
      source: 'datetime'
    });
  }

  suggestions.sort((a,b)=> b.score - a.score || a.label.localeCompare(b.label));

  const seen = new Set();
  const out = [];
  for (const s of suggestions){
    const k = normalizeInput(s.input).norm;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= limit) break;
  }

  if (includeValue) return out;
  return out.map(({label,input,score,source})=>({label,input,score,source}));
}

function getDatetimeSuggestions(partialInput, referenceDateOrOptions, excludePastOrOptions, maybeOptions){
  const { options } = normalizeDateTimeArgs(partialInput, referenceDateOrOptions, excludePastOrOptions, maybeOptions);
  return buildDateTimeSuggestions(partialInput, options);
}

function getDateTimeSuggestions(partialInput, referenceDateOrOptions, excludePastOrOptions, maybeOptions){
  return getDatetimeSuggestions(partialInput, referenceDateOrOptions, excludePastOrOptions, maybeOptions);
}

function resolveDatetimeString(input, referenceDateOrOptions, excludePastOrOptions, maybeOptions){
  const { options } = normalizeDateTimeArgs(input, referenceDateOrOptions, excludePastOrOptions, maybeOptions);
  const { norm } = normalizeInput(input || '');
  if (!norm) return null;

  const suggestions = buildDateTimeSuggestions(input, {
    ...options,
    includeValue: true,
    limit: Number.MAX_SAFE_INTEGER,
    minScore: 0
  });

  const exact = suggestions.find(s => normalizeInput(s.input).norm === norm);
  if (exact) return exact.value;
  return suggestions[0]?.value || null;
}

function resolveDateTime(input, options = {}){
  const resolved = resolveDatetimeString(input, options);
  if (!resolved) return null;
  return new Date(resolved.timestamp);
}

module.exports = {
  normalizeInput,
  tokenize,
  getDatetimeSuggestions,
  getDateTimeSuggestions,
  resolveDatetimeString,
  resolveDateTime,

  // debug
  _parse: (s)=>parseDateTime(tokenize(normalizeInput(s).norm)),
  _resolve: (s,opts)=>parseAndResolve(normalizeInput(s).norm,opts),
};
