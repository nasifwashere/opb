const Fuse = require('fuse.js');

// Normalize string for consistent comparison
function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

// Advanced fuzzy search using Fuse.js for card names
function fuzzyFindCard(cards, input) {
  if (!cards || cards.length === 0) return null;
  
  const normInput = normalize(input);
  
  // First try exact match
  let match = cards.find(card => normalize(card.name) === normInput);
  if (match) return match;
  
  // Configure Fuse.js for fuzzy search
  const fuseOptions = {
    keys: ['name'],
    includeScore: true,
    threshold: 0.6, // 0 = exact match, 1 = match anything
    ignoreLocation: true,
    findAllMatches: true
  };
  
  const fuse = new Fuse(cards, fuseOptions);
  const results = fuse.search(input);
  
  // Return the best match if score is good enough
  if (results.length > 0 && results[0].score <= 0.4) {
    return results[0].item;
  }
  
  // Fallback to partial match
  return cards.find(card => {
    const normName = normalize(card.name);
    return normName.includes(normInput) || normInput.includes(normName);
  });
}

// Simple fuzzy find for backwards compatibility
function simpleFuzzyFindCard(cards, input) {
  const normInput = normalize(input);
  let bestMatch = null;
  let bestScore = 0;

  for (const card of cards) {
    const normName = normalize(card.name);
    let score = 0;

    if (normName === normInput) score = 3;
    else if (normName.includes(normInput)) score = 2;
    else if (normName.startsWith(normInput)) score = 1;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = card;
    }
  }

  return bestMatch;
}

module.exports = {
  normalize,
  fuzzyFindCard,
  simpleFuzzyFindCard
};