const fs = require('fs');
const path = require('path');

const cardsPath = path.resolve('data', 'cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

/**
 * Normalize string for consistent comparison
 */
function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

/**
 * Find the highest evolved form that a user owns for a given card
 * @param {Object} user - User object
 * @param {string} cardName - Name of the card to check
 * @returns {Object|null} - The highest evolved card the user owns, or null
 */
function findHighestEvolutionOwned(user, cardName) {
  if (!user.cards || user.cards.length === 0) return null;
  
  // Get the full evolution chain for this card
  const evolutionChain = getEvolutionChain(cardName);
  
  // Check from highest to lowest evolution
  for (let i = evolutionChain.length - 1; i >= 0; i--) {
    const evolutionName = evolutionChain[i];
    const ownedCard = user.cards.find(c => normalize(c.name) === normalize(evolutionName));
    if (ownedCard) {
      return { card: ownedCard, cardDef: allCards.find(c => c.name === evolutionName) };
    }
  }
  
  return null;
}

/**
 * Get the complete evolution chain for a card (from base to final form)
 * @param {string} cardName - Name of the card
 * @returns {Array} - Array of card names in evolution order
 */
function getEvolutionChain(cardName) {
  const chain = [];
  const cardDef = allCards.find(c => normalize(c.name) === normalize(cardName));
  
  if (!cardDef) return [cardName];
  
  // Find the base form (card with no evolvesFrom)
  let baseForm = cardDef;
  while (baseForm.evolvesFrom) {
    baseForm = allCards.find(c => c.name === baseForm.evolvesFrom);
    if (!baseForm) break;
  }
  
  if (!baseForm) return [cardName];
  
  // Build chain from base form forward
  let current = baseForm;
  while (current) {
    chain.push(current.name);
    current = allCards.find(c => c.evolvesFrom === current.name);
  }
  
  return chain;
}

/**
 * Transform a card to its appropriate evolved form if user owns higher evolution
 * @param {Object} user - User object
 * @param {Object} newCard - Card object to potentially transform
 * @returns {Object} - Transformed card object
 */
function transformCardToEvolution(user, newCard) {
  const highestEvolution = findHighestEvolutionOwned(user, newCard.name);
  
  if (highestEvolution && normalize(highestEvolution.cardDef.name) !== normalize(newCard.name)) {
    // Transform to the highest evolution owned
    return {
      name: highestEvolution.cardDef.name,
      rank: highestEvolution.cardDef.rank,
      level: newCard.level || 1,
      experience: newCard.experience || 0,
      timesUpgraded: newCard.timesUpgraded || 0,
      locked: newCard.locked || false
    };
  }
  
  return newCard;
}

/**
 * Transform all cards in user's collection to match evolved forms
 * @param {Object} user - User object
 * @param {string} evolvedCardName - Name of the newly evolved card
 * @param {Object} evolvedCardDef - Card definition of evolved form
 */
function transformAllDuplicatesToEvolution(user, evolvedCardName, evolvedCardDef) {
  if (!user.cards) return;
  
  // Get all cards in the evolution chain
  const evolutionChain = getEvolutionChain(evolvedCardName);
  
  // Find all cards that should be transformed to the evolved form
  for (let i = 0; i < user.cards.length; i++) {
    const userCard = user.cards[i];
    const cardChain = getEvolutionChain(userCard.name);
    
    // If this card is in the same evolution chain and is a lower form
    if (cardChain.includes(evolvedCardName)) {
      const userCardIndex = cardChain.indexOf(userCard.name);
      const evolvedCardIndex = cardChain.indexOf(evolvedCardName);
      
      if (userCardIndex < evolvedCardIndex) {
        // Transform this card to the evolved form, preserving level and experience
        user.cards[i] = {
          name: evolvedCardName,
          rank: evolvedCardDef.rank,
          level: userCard.level || 1,
          experience: userCard.experience || 0,
          timesUpgraded: userCard.timesUpgraded || 0,
          locked: userCard.locked || false
        };
      }
    }
  }
  
  // Also update team if any transformed cards were in the team
  if (user.team) {
    for (let i = 0; i < user.team.length; i++) {
      const teamCardName = user.team[i];
      const cardChain = getEvolutionChain(teamCardName);
      
      if (cardChain.includes(evolvedCardName)) {
        const teamCardIndex = cardChain.indexOf(teamCardName);
        const evolvedCardIndex = cardChain.indexOf(evolvedCardName);
        
        if (teamCardIndex < evolvedCardIndex) {
          user.team[i] = evolvedCardName;
        }
      }
    }
  }
}

/**
 * Add a card to user's collection with automatic evolution transformation
 * Handles special case of cards in training by attaching duplicates to training cards
 * @param {Object} user - User object
 * @param {Object} cardToAdd - Card object to add
 * @returns {Object} - Result object with success status and additional info
 */
function addCardWithTransformation(user, cardToAdd) {
  if (!user.cards) user.cards = [];

  // Check if this card (or any card in its evolution chain) is currently in training
  if (user.training && user.training.length > 0) {
    const evolutionChain = getEvolutionChain(cardToAdd.name);
    // Find if any card in the evolution chain is in training
    const trainingCard = user.training.find(trainingCard => {
      const trainingChain = getEvolutionChain(trainingCard.cardName);
      return evolutionChain.some(chainCard => 
        trainingChain.some(trainingChainCard => 
          normalize(chainCard) === normalize(trainingChainCard)
        )
      );
    });
    if (trainingCard) {
      // Add as duplicate to the training card instead of collection
      if (!trainingCard.duplicates) {
        trainingCard.duplicates = 0;
      }
      trainingCard.duplicates += 1;
      user.markModified('training');
      return { 
        attachedToTraining: true, 
        trainingCardName: trainingCard.cardName,
        duplicateCount: trainingCard.duplicates
      };
    }
  }

  // Check for duplicate in main collection (any evolution form)
  const evolutionChain = getEvolutionChain(cardToAdd.name);
  const ownedCard = user.cards.find(c => evolutionChain.some(chainCard => normalize(c.name) === normalize(chainCard)));
  const userSetting = (user.settings && user.settings.duplicateCardHandling) || 'autolevel';

  if (ownedCard) {
    if (userSetting === 'autosell') {
      // Auto-sell logic (simple version: return a result, actual sell logic handled elsewhere)
      return { autosold: true, card: cardToAdd };
    } else {
      // Autolevel: add XP to the owned card based on the rank of the pulled card
      let xpToAdd = 0;
      switch ((cardToAdd.rank || '').toUpperCase()) {
        case 'C': xpToAdd = 50; break;
        case 'B': xpToAdd = 100; break;
        case 'A': xpToAdd = 200; break;
        case 'S': xpToAdd = 500; break;
        default: xpToAdd = 0;
      }
      ownedCard.experience = (ownedCard.experience || 0) + xpToAdd;
      user.markModified('cards');
      return { autoxp: true, card: ownedCard, xpAdded: xpToAdd };
    }
  }

  // Transform the card if user owns higher evolution
  const transformedCard = transformCardToEvolution(user, cardToAdd);
  user.cards.push(transformedCard);
  return { attachedToTraining: false, addedCard: transformedCard };
}

/**
 * Check if a card name is in an evolution chain that the user has evolved forms of
 * @param {Object} user - User object  
 * @param {string} cardName - Name of the card to check
 * @returns {boolean} - True if user has evolved forms of this card
 */
function userHasEvolvedVersionOf(user, cardName) {
  const highestEvolution = findHighestEvolutionOwned(user, cardName);
  return highestEvolution && normalize(highestEvolution.cardDef.name) !== normalize(cardName);
}

module.exports = {
  normalize,
  findHighestEvolutionOwned,
  getEvolutionChain,
  transformCardToEvolution,
  transformAllDuplicatesToEvolution,
  addCardWithTransformation,
  userHasEvolvedVersionOf
};