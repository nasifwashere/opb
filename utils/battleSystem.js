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
  if (!user || !user.team || user.team.length === 0) return [];

  const battleTeam = [];

  for (const cardName of user.team) {
    if (!cardName) continue;

    // Find user's card instance
    const userCard = user.cards?.find(c => 
      c && c.name && c.name.toLowerCase() === cardName.toLowerCase()
    );

    if (!userCard) continue;

    // Find card definition
    const cardDef = cardDatabase.find(c => 
      c && c.name && c.name.toLowerCase() === cardName.toLowerCase()
    );

    if (!cardDef || !cardDef.phs) continue;

    // Skip disallowed cards
    if (user.disallowedCards?.includes(cardDef.name)) continue;

    // Parse base stats with error handling
    let basePower, baseHealth, baseSpeed;
    try {
      const stats = cardDef.phs.split('/').map(x => {
        const parsed = parseInt(x.trim());
        return isNaN(parsed) ? null : parsed;
      });
      
      if (stats.length !== 3 || stats.some(s => s === null)) {
        console.warn(`Invalid stats format for card: ${cardDef.name}, phs: ${cardDef.phs}`);
        basePower = 10;
        baseHealth = 50;
        baseSpeed = 30;
      } else {
        [basePower, baseHealth, baseSpeed] = stats;
      }
    } catch (error) {
      console.warn(`Error parsing stats for card: ${cardDef.name}`, error);
      basePower = 10;
      baseHealth = 50;
      baseSpeed = 30;
    }

    const level = userCard.level || (userCard.timesUpgraded ? userCard.timesUpgraded + 1 : 1);
    const rankMultiplier = rankMultipliers[cardDef.rank] || 1.0;

    // Calculate base stats with level boost (1% per level above 1) and rank
    const { calculateStatWithLevel } = require('./levelSystem.js');
    let power = Math.floor(calculateStatWithLevel(basePower, level) * rankMultiplier);
    let health = Math.floor(calculateStatWithLevel(baseHealth, level) * rankMultiplier);
    let speed = Math.floor(calculateStatWithLevel(baseSpeed, level) * rankMultiplier);

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
      rank: cardDef.rank || 'C',
      power: power,
      hp: health,
      currentHp: health,
      maxHp: health,
      speed: speed,
      attack: [attackLow, attackHigh],
      image: cardDef.image || null,
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
    // Get base damage from attacker
    let baseDamage;
    
    if (attacker.atk && Array.isArray(attacker.atk)) {
        // Enemy with attack range - ensure valid numbers
        const minAtk = Math.max(1, Number(attacker.atk[0]) || 10);
        const maxAtk = Math.max(minAtk, Number(attacker.atk[1]) || 15);
        baseDamage = Math.floor(Math.random() * (maxAtk - minAtk + 1)) + minAtk;
    } else if (attacker.power) {
        // Player card with power stat
        const power = Math.max(1, Number(attacker.power) || 10);
        const damageMultiplier = damageMultipliers[attacker.rank] || 0.10;
        const rawDamage = power * damageMultiplier;
        const minDamage = Math.max(1, Math.floor(rawDamage * 1.0));
        const maxDamage = Math.max(minDamage, Math.floor(rawDamage * 1.5));
        baseDamage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;
    } else {
        // Fallback - ensure we have a valid attack value
        const fallbackAtk = Number(attacker.atk) || Number(attacker.power) || 10;
        baseDamage = Math.max(5, fallbackAtk);
    }

    // Apply variation for more dynamic combat
    const variation = Math.random() * 0.2 - 0.1; // ±10% variation
    let finalDamage = Math.floor(baseDamage * (1 + variation));

    // Ensure minimum damage (bosses should do significant damage)
    finalDamage = Math.max(finalDamage, attackType === 'boss' ? 8 : 3);

    return finalDamage;
}

/**
 * Determine turn order based on speed
 * @param {Array} team1 - First team's cards
 * @param {Array} team2 - Second team's cards
 * @returns {Array} Array of cards in turn order
 */
function calculateTurnOrder(team1, team2) {
  if (!Array.isArray(team1)) team1 = [];
  if (!Array.isArray(team2)) team2 = [];

  const allCards = [...team1, ...team2].filter(card => 
    card && 
    typeof card.currentHp === 'number' && 
    card.currentHp > 0 &&
    typeof card.speed === 'number'
  );

  return allCards.sort((a, b) => b.speed - a.speed);
}

/**
 * Check if a team has any cards that can still fight
 * @param {Array} team - Array of card objects
 * @returns {boolean} True if team can still fight
 */
function teamCanFight(team) {
  if (!Array.isArray(team)) return false;
  return team.some(card => card && typeof card.currentHp === 'number' && card.currentHp > 0);
}

/**
 * Get the next active card from a team
 * @param {Array} team - Array of card objects
 * @returns {Object|null} Next card that can fight, or null
 */
function getActiveCard(team) {
  if (!Array.isArray(team)) return null;
  return team.find(card => card && typeof card.currentHp === 'number' && card.currentHp > 0) || null;
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

/**
 * Process temporary buffs for turn-based duration
 * @param {Array} team - Array of card objects
 */
function processTempBuffs(team) {
  if (!Array.isArray(team)) return;

  team.forEach(card => {
    if (card.tempBuffs && Array.isArray(card.tempBuffs)) {
      card.tempBuffs = card.tempBuffs.filter(buff => {
        if (buff.duration > 0) {
          buff.duration--;
          return buff.duration > 0;
        }
        return false;
      });
    }
  });
}

module.exports = {
  calculateBattleStats,
  calculateDamage,
  calculateTurnOrder,
  teamCanFight,
  getActiveCard,
  healCard,
  resetTeamHP,
  processTempBuffs
};