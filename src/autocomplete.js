/**
 * Main autocomplete engine - combines templates and dynamic generation
 */

const { getAllTemplates, parseTemplate } = require('./autocomplete-templates');
const { generateFromPatterns, validateSuggestions } = require('./autocomplete-patterns');
const { generatePrefixCompletions, validatePrefixCompletions } = require('./autocomplete-prefix');
const { normalizeInput } = require('./tokenizer');

/**
 * Calculate string similarity score (0-1)
 * PREFIX-ONLY matching - only returns high scores if target starts with input
 */
function calculateSimilarity(input, target) {
    const inputLower = input.toLowerCase().trim();
    const targetLower = target.toLowerCase().trim();

    // Exact match
    if (inputLower === targetLower) {
        return 1.0;
    }

    // Prefix match (REQUIRED for autocomplete)
    if (targetLower.startsWith(inputLower)) {
        // Score based on how complete the input is
        const completeness = inputLower.length / targetLower.length;
        return 0.85 + (0.15 * completeness);
    }

    // No match - not a prefix
    return 0;
}

/**
 * Match templates against input
 */
function matchTemplates(input, templates) {
    const inputLower = input.toLowerCase().trim();
    const matches = [];

    // Try typo correction using tokenizer normalization
    const corrected = normalizeInput(input);
    const correctedLower = corrected.toLowerCase().trim();

    for (const template of templates) {
        // Calculate similarity with original input
        const similarityOriginal = calculateSimilarity(inputLower, template.input);

        // Calculate similarity with corrected input
        const similarityCorrected = corrected !== input ?
            calculateSimilarity(correctedLower, template.input) : 0;

        const similarity = Math.max(similarityOriginal, similarityCorrected);

        // Also check against keywords
        let keywordScore = 0;
        if (template.keywords) {
            const inputWords = inputLower.split(/\s+/);
            const matchedKeywords = template.keywords.filter(keyword =>
                inputWords.some(word => keyword.includes(word) || word.includes(keyword))
            );
            keywordScore = matchedKeywords.length / template.keywords.length;
        }

        const finalSimilarity = Math.max(similarity, keywordScore * 0.5);

        if (finalSimilarity > 0.2) {
            matches.push({
                ...template,
                similarity: finalSimilarity,
                source: 'template'
            });
        }
    }

    return matches;
}

/**
 * Calculate final score for ranking
 */
function calculateScore(suggestion, options = {}) {
    const {
        similarityWeight = 0.7,
        popularityWeight = 0.3
    } = options;

    const similarity = suggestion.similarity || 0;
    const popularity = (suggestion.popularity || 5) / 10; // Normalize to 0-1

    return (similarity * similarityWeight) + (popularity * popularityWeight);
}

/**
 * Deduplicate suggestions based on input text
 */
function deduplicate(suggestions) {
    const seen = new Set();
    const unique = [];

    for (const suggestion of suggestions) {
        const key = suggestion.input.toLowerCase().trim();
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(suggestion);
        }
    }

    return unique;
}

/**
 * Get autocomplete suggestions
 *
 * @param {string} partialInput - The partial input from the user
 * @param {Object} options - Configuration options
 * @param {number} options.limit - Maximum number of suggestions (default: 10)
 * @param {string} options.category - Filter by category (optional)
 * @param {number} options.minScore - Minimum score threshold (default: 0.3)
 * @param {number} options.similarityWeight - Weight for similarity in ranking (default: 0.7)
 * @param {number} options.popularityWeight - Weight for popularity in ranking (default: 0.3)
 * @param {boolean} options.includeDynamic - Include dynamically generated suggestions (default: true)
 * @param {boolean} options.includeValue - Parse and include JSON value (default: true)
 *
 * @returns {Array} Array of suggestion objects with label, input, value, score, source
 */
function getSuggestions(partialInput, options = {}) {
    const {
        limit = 10,
        category = null,
        minScore = 0.3,
        similarityWeight = 0.7,
        popularityWeight = 0.3,
        includeDynamic = true,
        includeValue = true
    } = options;

    // Handle empty input
    if (!partialInput || partialInput.trim().length === 0) {
        return getPopularSuggestions(limit, includeValue);
    }

    const input = partialInput.trim();
    const correctedInput = normalizeInput(input).toLowerCase();
    let allSuggestions = [];

    // 1. Match against templates (PREFIX ONLY)
    let templates = getAllTemplates();
    if (category) {
        templates = templates.filter(t => t.category === category);
    }

    const templateMatches = matchTemplates(input, templates);
    // Filter to only prefix matches
    const prefixTemplates = templateMatches.filter(t =>
        t.input.toLowerCase().startsWith(correctedInput) ||
        t.label.toLowerCase().startsWith(correctedInput)
    );
    allSuggestions.push(...prefixTemplates);

    // 2. Generate prefix-preserving completions (if enabled)
    if (includeDynamic) {
        const prefixCompletions = generatePrefixCompletions(input);
        const validatedPrefixCompletions = validatePrefixCompletions(prefixCompletions);

        // Calculate similarity for prefix completions
        validatedPrefixCompletions.forEach(suggestion => {
            suggestion.similarity = calculateSimilarity(correctedInput, suggestion.input.toLowerCase());
            suggestion.popularity = 8; // High popularity for direct completions
        });

        allSuggestions.push(...validatedPrefixCompletions);

        // Also try old pattern-based generation (filtered for prefix match)
        const dynamicSuggestions = generateFromPatterns(input, limit);
        dynamicSuggestions.forEach(suggestion => {
            suggestion.similarity = calculateSimilarity(correctedInput, suggestion.input.toLowerCase());
            suggestion.popularity = 7;
        });

        // Only keep dynamic suggestions that start with corrected input
        const prefixDynamic = dynamicSuggestions.filter(s =>
            s.input.toLowerCase().startsWith(correctedInput)
        );
        allSuggestions.push(...prefixDynamic);
    }

    // 3. Deduplicate
    allSuggestions = deduplicate(allSuggestions);

    // 4. Calculate scores and filter (use lower threshold since we're strict on prefix)
    allSuggestions = allSuggestions.map(suggestion => ({
        ...suggestion,
        score: calculateScore(suggestion, { similarityWeight, popularityWeight })
    })).filter(suggestion => suggestion.score >= Math.max(0.3, minScore));

    // 5. Sort by score (descending)
    allSuggestions.sort((a, b) => b.score - a.score);

    // 6. Limit results
    const topSuggestions = allSuggestions.slice(0, limit);

    // 7. Parse and add JSON values if requested
    if (includeValue) {
        return validateSuggestions(topSuggestions);
    }

    // 8. Return without values
    return topSuggestions.map(s => ({
        label: s.label || s.input,
        input: s.input,
        category: s.category,
        score: s.score,
        source: s.source
    }));
}

/**
 * Get popular suggestions for empty input
 */
function getPopularSuggestions(limit = 10, includeValue = true) {
    const templates = getAllTemplates();

    // Sort by popularity
    const popular = templates
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, limit);

    if (includeValue) {
        return popular.map(template => {
            const parsed = parseTemplate(template);
            return {
                label: template.label,
                input: template.input,
                category: template.category,
                value: parsed.value,
                score: template.popularity / 10,
                source: 'template'
            };
        });
    }

    return popular.map(template => ({
        label: template.label,
        input: template.input,
        category: template.category,
        score: template.popularity / 10,
        source: 'template'
    }));
}

/**
 * Get suggestions by category
 */
function getSuggestionsByCategory(category, limit = 20, includeValue = true) {
    const templates = getAllTemplates().filter(t => t.category === category);

    // Sort by popularity
    const sorted = templates
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, limit);

    if (includeValue) {
        return sorted.map(template => {
            const parsed = parseTemplate(template);
            return {
                label: template.label,
                input: template.input,
                category: template.category,
                value: parsed.value,
                score: template.popularity / 10,
                source: 'template'
            };
        });
    }

    return sorted.map(template => ({
        label: template.label,
        input: template.input,
        category: template.category,
        score: template.popularity / 10,
        source: 'template'
    }));
}

module.exports = {
    getSuggestions,
    getSuggestionsByCategory,
    getPopularSuggestions
};
