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
  const stat = Number(baseStat);
  if (isNaN(stat)) return 10;

  const levelBonus = (level - 1) * 0.01; // 1% per level above 1
  return Math.floor(stat * (1 + levelBonus));
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
function calculateCardStats(cardDef, level = 1) {
  if (!cardDef || !cardDef.phs) {
    return { power: 10, health: 50, speed: 30 };
  }

  let basePower, baseHealth, baseSpeed;
  try {
    const stats = cardDef.phs.split('/').map(x => {
      const parsed = parseInt(x.trim());
      return isNaN(parsed) ? null : parsed;
    });

    if (stats.length !== 3 || stats.some(s => s === null)) {
      return { power: 10, health: 50, speed: 30 };
    }

    [basePower, baseHealth, baseSpeed] = stats;
  } catch (error) {
    return { power: 10, health: 50, speed: 30 };
  }

  return {
    power: calculateStatWithLevel(basePower, level),
    health: calculateStatWithLevel(baseHealth, level),
    speed: calculateStatWithLevel(baseSpeed, level)
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