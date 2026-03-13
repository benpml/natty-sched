/**
 * Shared constants used by both schedule and datetime autocomplete systems.
 */

const WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const WEEKDAY_LOOKUP = Object.fromEntries(WEEKDAYS.map((d, i) => [d, i]));

const MONTHS = ['january','february','march','april','may','june',
                'july','august','september','october','november','december'];
const MONTH_LOOKUP = Object.fromEntries(MONTHS.map((m, i) => [m, i]));

const UNIT_CANON = {
  minute: 'minute', minutes: 'minute', min: 'minute', mins: 'minute',
  hour: 'hour', hours: 'hour', hr: 'hour', hrs: 'hour',
  day: 'day', days: 'day',
  week: 'week', weeks: 'week',
  month: 'month', months: 'month',
  year: 'year', years: 'year'
};
const UNIT_WORDS = Object.keys(UNIT_CANON);
const CANON_UNITS = ['minute','hour','day','week','month','year'];

const NUMBER_WORDS = {
  a: 1, an: 1,
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90
};

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
  'early': { h: 8, m: 0 },
  'late': { h: 17, m: 0 },
  'tonight': { h: 20, m: 0 },
  'this morning': { h: 9, m: 0 },
  'later today': { h: 17, m: 0 }
};
const TIME_BUCKET_KEYS = ['morning','afternoon','evening','night','early','late'];

const COMMON_TIMES = [
  '9:00 AM', '10:00 AM', '2:00 PM', '5:00 PM',
  '9:30 AM', '11:00 AM', '3:00 PM', '6:00 PM'
];

// Keywords that signal schedule/recurring context
const SCHEDULE_KEYWORDS = new Set([
  'every','daily','weekly','monthly','quarterly','yearly','annually','hourly',
  'weekdays','weekday','weekends','weekend','business','biweekly',
  'once','twice','each','all','per'
]);

const ORDINAL_WORDS = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, last: -1
};

module.exports = {
  WEEKDAYS, WEEKDAY_LOOKUP,
  MONTHS, MONTH_LOOKUP,
  UNIT_CANON, UNIT_WORDS, CANON_UNITS,
  NUMBER_WORDS,
  NAMED_TIMES, TIME_BUCKETS, TIME_BUCKET_KEYS,
  COMMON_TIMES,
  SCHEDULE_KEYWORDS,
  ORDINAL_WORDS
};
