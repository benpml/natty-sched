/**
 * Deterministic scoring algorithm for autocomplete suggestions.
 * No Math.random() - uses a string hash for tiebreaking.
 */

/**
 * Compute a deterministic hash from a string, used for tiebreaking.
 * @param {string} str
 * @returns {number} 0.000000 to 0.000999
 */
function deterministicTiebreaker(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 1000) / 1000000;
}

/**
 * Score a candidate suggestion deterministically.
 *
 * @param {string} normInput - Normalized user input
 * @param {string} candidateNorm - Normalized candidate text
 * @param {object} metadata
 * @param {string} metadata.source - 'parse_state' | 'template' | 'dynamic' | 'datetime' | 'inferred'
 * @param {number} metadata.popularity - 0-10 popularity rating
 * @param {boolean} metadata.isComplete - Whether the candidate is a complete parseable expression
 * @param {boolean} metadata.hasTime - Whether the candidate includes a time specification
 * @returns {number} Score between 0.0 and 1.0
 */
function scoreCandidate(normInput, candidateNorm, metadata = {}) {
  const { source = 'dynamic', popularity = 5, isComplete = false, hasTime = false } = metadata;

  // COMPONENT 1: Prefix affinity (0.0 - 0.60)
  let prefixAffinity = 0;
  if (!normInput) {
    // Empty input: use popularity only
    prefixAffinity = 0.30;
  } else if (candidateNorm === normInput) {
    prefixAffinity = 0.60;
  } else if (candidateNorm.startsWith(normInput)) {
    const ratio = normInput.length / candidateNorm.length;
    prefixAffinity = 0.30 + ratio * 0.30;
  } else {
    // Word overlap fallback
    const inputWords = new Set(normInput.split(/\s+/).filter(Boolean));
    const candidateWords = new Set(candidateNorm.split(/\s+/).filter(Boolean));
    let overlap = 0;
    for (const w of inputWords) if (candidateWords.has(w)) overlap++;
    prefixAffinity = Math.min(0.25, overlap * 0.08);
  }

  // COMPONENT 2: Completeness bonus (0.0 - 0.15)
  let completeness = 0;
  if (isComplete) completeness = 0.15;
  else if (hasTime) completeness = 0.10;

  // COMPONENT 3: Source quality (0.0 - 0.10)
  const sourceScores = {
    parse_state: 0.10,
    template: 0.07,
    dynamic: 0.05,
    datetime: 0.08,
    inferred: 0.03
  };
  const sourceScore = sourceScores[source] || 0.05;

  // COMPONENT 4: Popularity (0.0 - 0.10)
  const popularityScore = (popularity / 10) * 0.10;

  // COMPONENT 5: Brevity preference (0.0 - 0.05)
  const brevity = Math.max(0, 0.05 - (candidateNorm.length / 500));

  // COMPONENT 6: Deterministic tiebreaker (0.0 - 0.001)
  const tiebreaker = deterministicTiebreaker(candidateNorm);

  const total = prefixAffinity + completeness + sourceScore + popularityScore + brevity + tiebreaker;
  return Math.min(1.0, Math.max(0, total));
}

module.exports = { scoreCandidate };
