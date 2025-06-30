const User = require('../db/models/User.js');

const XP_PER_LEVEL = 100;

/**
 * Distribute XP to team members
 * @param {Object} user - User document
 * @param {number} totalXP - Total XP to distribute
 */
function distributeXPToTeam(user, totalXP) {
  if (!user.team || user.team.length === 0) return;

  const xpPerMember = Math.floor(totalXP / user.team.length);
  const changes = [];

  for (const cardName of user.team) {
    const cardInstance = user.cards.find(c => 
      c.name.toLowerCase() === cardName.toLowerCase()
    );

    if (cardInstance) {
      const oldLevel = cardInstance.level || 1;
      const oldXP = cardInstance.experience || 0;

      // Add XP
      cardInstance.experience = oldXP + xpPerMember;

      // Calculate new level
      const newLevel = Math.floor(cardInstance.experience / XP_PER_LEVEL) + 1;
      cardInstance.level = Math.max(1, newLevel);

      if (newLevel > oldLevel) {
        changes.push({
          name: cardInstance.name,
          oldLevel,
          newLevel,
          xpGained: xpPerMember
        });
      }
    }
  }

  return changes;
}

/**
 * Calculate stat with level boost (1% per level above 1)
 * @param {number} baseStat - Base stat value
 * @param {number} level - Card level
 */
function calculateStatWithLevel(baseStat, level) {
  const boost = 1 + ((level - 1) * 0.01); // 1% per level above 1
  return Math.ceil(baseStat * boost); // Always round up
}

/**
 * Get card stats with level bonuses applied
 * @param {Object} cardDef - Card definition from cards.json
 * @param {number} level - Card level
 */
function getCardStatsWithLevel(cardDef, level = 1) {
  if (!cardDef || !cardDef.phs) return { power: 0, health: 0, speed: 0 };

  const [basePower, baseHealth, baseSpeed] = cardDef.phs.split('/').map(x => parseInt(x.trim()) || 0);

  return {
    power: calculateStatWithLevel(basePower, level),
    health: calculateStatWithLevel(baseHealth, level),
    speed: calculateStatWithLevel(baseSpeed, level)
  };
}

/**
 * Alias for getCardStatsWithLevel - calculate card stats with level bonuses
 * @param {Object} cardDef - Card definition from cards.json
 * @param {number} level - Card level
 */
function calculateCardStats(card, level = 1) {
    const basePhs = card.phs || 50;

    // Different stat distributions based on rank
    const rankMultipliers = {
        'C': { power: 0.8, health: 1.0, speed: 0.9 },
        'B': { power: 0.9, health: 1.1, speed: 1.0 },
        'A': { power: 1.1, health: 1.2, speed: 1.1 },
        'S': { power: 1.3, health: 1.4, speed: 1.2 },
        'UR': { power: 1.5, health: 1.6, speed: 1.4 }
    };

    const multiplier = rankMultipliers[card.rank] || rankMultipliers['C'];

    const baseStats = {
        power: Math.floor(basePhs * multiplier.power),
        health: Math.floor(basePhs * multiplier.health),
        speed: Math.floor(basePhs * multiplier.speed)
    };

    // Level scaling (10% per level)
    const levelMultiplier = 1 + (level - 1) * 0.1;

    return {
        power: Math.floor(baseStats.power * levelMultiplier),
        health: Math.floor(baseStats.health * levelMultiplier),
        speed: Math.floor(baseStats.speed * levelMultiplier)
    };
}

/**
 * Check if card can level up with duplicates (legacy system)
 */
function canLevelUp(cardInstance, duplicates) {
  return duplicates > 0 && cardInstance.level < 100;
}

/**
 * Level up using duplicate cards (legacy system)
 */
function levelUp(cardInstance, duplicates, amount) {
  let leveled = 0;
  while (duplicates > 0 && cardInstance.level < 100 && leveled < amount) {
    cardInstance.level = (cardInstance.level || 1) + 1;
    // Update experience to match new level
    cardInstance.experience = (cardInstance.level - 1) * XP_PER_LEVEL;
    duplicates--;
    leveled++;
  }
  return leveled;
}

module.exports = { 
  distributeXPToTeam,
  calculateStatWithLevel,
  getCardStatsWithLevel,
  calculateCardStats,
  canLevelUp, 
  levelUp,
  XP_PER_LEVEL
};