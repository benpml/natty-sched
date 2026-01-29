/**
 * Tokenizer - normalizes and tokenizes input
 */

function normalizeInput(input) {
    if (!input || typeof input !== 'string') {
        throw new Error('Input must be a non-empty string');
    }

    let normalized = input.toLowerCase().trim();

    // Handle common typos and variations
    normalized = normalized
        // Typo corrections - weekdays
        .replace(/\bthrusday\b/g, 'thursday')
        .replace(/\bwensday\b/g, 'wednesday')
        .replace(/\btuseday\b/g, 'tuesday')
        .replace(/\bsaterday\b/g, 'saturday')

        // Typo corrections - months
        .replace(/\bfeburary\b/g, 'february')
        .replace(/\bfebruary\b/g, 'february')
        .replace(/\bseptemeber\b/g, 'september')
        .replace(/\boctobor\b/g, 'october')
        .replace(/\bnovemeber\b/g, 'november')
        .replace(/\bdecemeber\b/g, 'december')

        // Typo corrections - common words
        .replace(/\bevry\b/g, 'every')
        .replace(/\bever\b/g, 'every')
        .replace(/\bdya\b/g, 'day')
        .replace(/\bdaus\b/g, 'days')
        .replace(/\bdyas\b/g, 'days')
        .replace(/\bweekdys\b/g, 'weekdays')
        .replace(/\bbussiness\b/g, 'business')
        .replace(/\bbusness\b/g, 'business')
        .replace(/\bworkday\b/g, 'weekday')
        .replace(/\bworkdays\b/g, 'weekdays')
        .replace(/\bmoth\b/g, 'month')
        .replace(/\bmonhs\b/g, 'months')
        .replace(/\bwekes\b/g, 'weeks')
        .replace(/\bweks\b/g, 'weeks')
        .replace(/\byeras\b/g, 'years')
        .replace(/\bminuts\b/g, 'minutes')
        .replace(/\bminuets\b/g, 'minutes')

        // Variations
        .replace(/\beveryday\b/g, 'every day')
        .replace(/\bweekend day\b/g, 'weekend')

        // Alternative separators
        .replace(/\s+\+\s+/g, ' and ')
        .replace(/\s*\/\s*/g, ' and ')
        .replace(/\bminus\b/g, 'except')
        .replace(/\bbut not\b/g, 'except')

        // Normalize contractions
        .replace(/\bmon\b/g, 'monday')
        .replace(/\btue\b/g, 'tuesday')
        .replace(/\bwed\b/g, 'wednesday')
        .replace(/\bthu\b/g, 'thursday')
        .replace(/\bfri\b/g, 'friday')
        .replace(/\bsat\b/g, 'saturday')
        .replace(/\bsun\b/g, 'sunday')

        .replace(/\bjan\b/g, 'january')
        .replace(/\bfeb\b/g, 'february')
        .replace(/\bmar\b/g, 'march')
        .replace(/\bapr\b/g, 'april')
        .replace(/\bjun\b/g, 'june')
        .replace(/\bjul\b/g, 'july')
        .replace(/\baug\b/g, 'august')
        .replace(/\bsep\b/g, 'september')
        .replace(/\bsept\b/g, 'september')
        .replace(/\boct\b/g, 'october')
        .replace(/\bnov\b/g, 'november')
        .replace(/\bdec\b/g, 'december')

        // Normalize time expressions
        .replace(/\bmidnite\b/g, 'midnight')
        .replace(/\b12\s*am\b/g, 'midnight')
        .replace(/\b12\s*pm\b/g, 'noon')
        .replace(/\b12:00\s*am\b/g, 'midnight')
        .replace(/\b12:00\s*pm\b/g, 'noon')
        .replace(/\b00:00\b/g, 'midnight')

        // Normalize "o'clock"
        .replace(/\b(\d{1,2})\s*o'?clock\b/g, '$1:00')

        // Normalize time qualifiers
        .replace(/\baround\b/g, 'at')
        .replace(/\bvery early\b/g, 'early')
        .replace(/\bvery late\b/g, 'late')
        .replace(/\bfirst thing\b/g, 'early')

        // Normalize ordinals in numbers
        .replace(/\b1st\b/g, '1')
        .replace(/\b2nd\b/g, '2')
        .replace(/\b3rd\b/g, '3')
        .replace(/\b(\d+)th\b/g, '$1')

        // Normalize ordinal words
        .replace(/\b3rd day\b/g, '3 days')
        .replace(/\bthird day\b/g, '3 days')

        // Normalize time references
        .replace(/\bright now\b/g, 'now')
        .replace(/\bthis moment\b/g, 'now')
        .replace(/\blater today\b/g, 'today later')
        .replace(/\bthis coming\b/g, 'next')
        .replace(/\bstart of\b/g, 'beginning of')
        .replace(/\bend of\b/g, 'last day of')
        .replace(/\bvery end\b/g, 'last day')

        // Normalize "forever" and "until end of time"
        .replace(/\bforever\b/g, '')
        .replace(/\buntil the end of time\b/g, '')
        .replace(/\bno matter what\b/g, '')

        // Normalize special dates
        .replace(/\bleap day\b/g, 'february 29')

        // Normalize multiple spaces
        .replace(/\s+/g, ' ');

    return normalized;
}

function tokenize(input) {
    // Split on whitespace but keep punctuation
    return input
        .split(/\s+/)
        .filter(token => token.length > 0);
}

module.exports = {
    normalizeInput,
    tokenize
};
