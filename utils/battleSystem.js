const fs = require('fs');
const path = require('path');

const cardsPath = path.resolve('data', 'cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

// Damage multipliers for combat calculations  
const damageMultipliers = {
  C: 0.08,
  B: 0.10,
  A: 0.14,
  S: 0.17,
  UR: 0.20
};

// Rank multipliers for overall combat power
const rankMultipliers = {
  C: 1.0,
  B: 1.2,
  A: 1.4,
  S: 1.6,
  UR: 2.0
};

// Equipment bonuses
const equipmentBonuses = {
  'strawhat': { power: 1.3, health: 1.3, speed: 1.3 } // 30% boost to all stats
};

/**
 * Calculate battle stats for a user's team
 * @param {Object} user - User document from database
 * @param {Array} cardDatabase - Array of card definitions
 * @returns {Array} Array of battle-ready card objects
 */
function calculateBattleStats(user, cardDatabase = allCards) {
  if (!user.team || user.team.length === 0) return [];

  const battleTeam = [];

  for (const cardName of user.team) {
    // Find user's card instance
    const userCard = user.cards?.find(c => 
      c.name.toLowerCase() === cardName.toLowerCase()
    );
    
    if (!userCard) continue;

    // Find card definition
    const cardDef = cardDatabase.find(c => 
      c.name.toLowerCase() === cardName.toLowerCase()
    );
    
    if (!cardDef) continue;

    // Skip disallowed cards
    if (user.disallowedCards?.includes(cardDef.name)) continue;

    // Parse base stats
    const [basePower, baseHealth, baseSpeed] = cardDef.phs.split('/').map(x => parseInt(x.trim()));
    const level = userCard.level || userCard.timesUpgraded + 1 || 1;
    const rankMultiplier = rankMultipliers[cardDef.rank] || 1.0;

    // Calculate base stats with level and rank
    let power = Math.floor((basePower + (level - 1) * 2) * rankMultiplier);
    let health = Math.floor((baseHealth + (level - 1) * 3) * rankMultiplier);
    let speed = Math.floor((baseSpeed + (level - 1) * 1) * rankMultiplier);

    // Apply equipment bonuses
    const equipped = user.equipped;
    if (equipped) {
      const normalizedCardName = cardName.replace(/\s+/g, '').toLowerCase();
      const equippedItem = equipped[normalizedCardName];
      
      if (equippedItem && equipmentBonuses[equippedItem]) {
        const bonus = equipmentBonuses[equippedItem];
        power = Math.floor(power * bonus.power);
        health = Math.floor(health * bonus.health);
        speed = Math.floor(speed * bonus.speed);
      }
    }

    // Calculate attack range using new damage multiplier system
    const damageMultiplier = damageMultipliers[cardDef.rank] || 0.10;
    const baseDamage = power * damageMultiplier;
    const attackLow = Math.floor(baseDamage * 1.0);
    const attackHigh = Math.floor(baseDamage * 1.5);

    battleTeam.push({
      name: cardDef.name,
      level: level,
      rank: cardDef.rank,
      power: power,
      hp: health,
      currentHp: health,
      speed: speed,
      attack: [attackLow, attackHigh],
      image: cardDef.image,
      locked: userCard.locked || false
    });
  }

  return battleTeam;
}

/**
 * Calculate damage for an attack
 * @param {Object} attacker - Attacking card
 * @param {Object} defender - Defending card
 * @param {string} attackType - 'normal', 'skill', or 'critical'
 * @returns {number} Damage dealt
 */
function calculateDamage(attacker, defender, attackType = 'normal') {
  const baseAttack = Math.floor(
    Math.random() * (attacker.attack[1] - attacker.attack[0] + 1)
  ) + attacker.attack[0];

  let damage = baseAttack;

  // Apply attack type modifiers
  switch (attackType) {
    case 'skill':
      damage = Math.floor(damage * 1.5);
      break;
    case 'critical':
      damage = Math.floor(damage * 2.0);
      break;
    default:
      // Normal attack, no modifier
      break;
  }

  // Speed difference can affect damage (faster = more damage)
  const speedDiff = attacker.speed - defender.speed;
  if (speedDiff > 0) {
    damage += Math.floor(speedDiff * 0.1);
  }

  // Minimum damage is 1
  return Math.max(1, damage);
}

/**
 * Determine turn order based on speed
 * @param {Array} team1 - First team's cards
 * @param {Array} team2 - Second team's cards
 * @returns {Array} Array of cards in turn order
 */
function calculateTurnOrder(team1, team2) {
  const allCards = [...team1, ...team2].filter(card => card.currentHp > 0);
  return allCards.sort((a, b) => b.speed - a.speed);
}

/**
 * Check if a team has any cards that can still fight
 * @param {Array} team - Array of card objects
 * @returns {boolean} True if team can still fight
 */
function teamCanFight(team) {
  return team.some(card => card.currentHp > 0);
}

/**
 * Get the next active card from a team
 * @param {Array} team - Array of card objects
 * @returns {Object|null} Next card that can fight, or null
 */
function getActiveCard(team) {
  return team.find(card => card.currentHp > 0) || null;
}

/**
 * Apply healing to a card
 * @param {Object} card - Card to heal
 * @param {number} amount - Amount to heal
 * @returns {number} Actual amount healed
 */
function healCard(card, amount) {
  const oldHp = card.currentHp;
  card.currentHp = Math.min(card.hp, card.currentHp + amount);
  return card.currentHp - oldHp;
}

/**
 * Reset team HP to full (for exploration battles)
 * @param {Array} team - Array of card objects
 */
function resetTeamHP(team) {
  team.forEach(card => {
    card.currentHp = card.hp;
  });
}

module.exports = {
  calculateBattleStats,
  calculateDamage,
  calculateTurnOrder,
  teamCanFight,
  getActiveCard,
  healCard,
  resetTeamHP
};
