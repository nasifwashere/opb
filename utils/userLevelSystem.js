const User = require('../db/models/User.js');

const USER_XP_PER_LEVEL = 1000;
const BASE_BOUNTY_REWARD = 1000000; // 1 million bounty for first level up
const BOUNTY_INCREASE_RATE = 0.05; // 5% increase per level

/**
 * Award XP to user and handle leveling up
 * @param {Object} user - User document
 * @param {number} xpAmount - Amount of XP to award
 * @returns {Object} Level up information
 */
function awardUserXP(user, xpAmount) {
  if (!user || typeof xpAmount !== 'number' || xpAmount <= 0) {
    return { leveledUp: false, newLevel: user?.level || 1, rewards: [] };
  }

  // Initialize user fields if needed
  if (typeof user.xp !== 'number') user.xp = 0;
  if (typeof user.level !== 'number') user.level = 1;
  if (typeof user.bounty !== 'number') user.bounty = 0;

  const oldLevel = user.level;
  const oldXP = user.xp;

  // Add XP to user
  user.xp += xpAmount;

  // Calculate new level
  const newLevel = Math.floor(user.xp / USER_XP_PER_LEVEL) + 1;
  
  if (newLevel > oldLevel) {
    user.level = newLevel;
    
    // Calculate level ups gained
    const levelsGained = newLevel - oldLevel;
    
    // Calculate and award bounty for each level gained
    const rewards = [];
    for (let i = 0; i < levelsGained; i++) {
      const levelReached = oldLevel + i + 1;
      const bountyReward = calculateBountyReward(levelReached);
      user.bounty += bountyReward;
      
      // Add level-specific rewards
      const levelRewards = getLevelUpRewards(levelReached);
      rewards.push({
        level: levelReached,
        bounty: bountyReward,
        ...levelRewards
      });
      
      // Apply item rewards
      if (levelRewards.items && levelRewards.items.length > 0) {
        if (!user.inventory) user.inventory = [];
        levelRewards.items.forEach(item => {
          user.inventory.push(item.toLowerCase().replace(/\s+/g, ''));
        });
      }
      
      // Apply beli rewards
      if (levelRewards.beli) {
        user.beli = (user.beli || 0) + levelRewards.beli;
      }
    }
    
    return {
      leveledUp: true,
      oldLevel,
      newLevel,
      levelsGained,
      xpGained: xpAmount,
      rewards
    };
  }
  
  return {
    leveledUp: false,
    newLevel,
    xpGained: xpAmount,
    rewards: []
  };
}

/**
 * Calculate bounty reward for a specific level
 * @param {number} level - The level reached
 * @returns {number} Bounty reward amount
 */
function calculateBountyReward(level) {
  // Level 1 doesn't give bounty reward (starting level)
  if (level <= 1) return 0;
  
  // Calculate bounty with 5% increase per level
  // Formula: BASE * (1 + RATE)^(level-2) where level-2 because level 2 gets base reward
  const levelForCalculation = level - 2;
  return Math.floor(BASE_BOUNTY_REWARD * Math.pow(1 + BOUNTY_INCREASE_RATE, levelForCalculation));
}

/**
 * Get rewards for leveling up to a specific level
 * @param {number} level - The level reached
 * @returns {Object} Reward object
 */
function getLevelUpRewards(level) {
  const rewards = {
    beli: 0,
    items: []
  };
  
  // Base beli reward that scales with level
  rewards.beli = level * 1000;
  
  // Special rewards for milestone levels
  if (level % 5 === 0) {
    // Every 5 levels: Max Potion
    rewards.items.push('Max Potion');
    rewards.beli += 5000; // Bonus beli
  }
  
  if (level % 10 === 0) {
    // Every 10 levels: Equipment or special items
    const milestoneRewards = [
      'Legendary Sword',
      'Admiral Coat',
      'Devil Fruit',
      'Rare Gem',
      'Ancient Artifact'
    ];
    const rewardIndex = Math.floor((level / 10 - 1) % milestoneRewards.length);
    rewards.items.push(milestoneRewards[rewardIndex]);
    rewards.beli += 10000; // Extra bonus beli
  }
  
  if (level % 25 === 0) {
    // Every 25 levels: Major milestone rewards
    rewards.items.push('Legendary Card Pack');
    rewards.beli += 25000;
  }
  
  if (level === 50) {
    rewards.items.push('Yonko Certificate');
    rewards.beli += 100000;
  }
  
  if (level === 100) {
    rewards.items.push('Pirate King Crown');
    rewards.beli += 1000000;
  }
  
  return rewards;
}

/**
 * Get user's progress to next level
 * @param {Object} user - User document
 * @returns {Object} Progress information
 */
function getUserLevelProgress(user) {
  if (!user) return { level: 1, currentXP: 0, neededXP: USER_XP_PER_LEVEL, progress: 0 };
  
  const level = user.level || 1;
  const currentXP = user.xp || 0;
  const xpForCurrentLevel = (level - 1) * USER_XP_PER_LEVEL;
  const xpInCurrentLevel = currentXP - xpForCurrentLevel;
  const neededXP = USER_XP_PER_LEVEL - xpInCurrentLevel;
  const progress = Math.min(100, (xpInCurrentLevel / USER_XP_PER_LEVEL) * 100);
  
  return {
    level,
    currentXP: xpInCurrentLevel,
    neededXP: Math.max(0, neededXP),
    totalXP: currentXP,
    progress: Math.round(progress * 10) / 10 // Round to 1 decimal place
  };
}

/**
 * Format level up rewards for display
 * @param {Array} rewards - Array of reward objects
 * @returns {string} Formatted reward text
 */
function formatLevelUpRewards(rewards) {
  if (!rewards || rewards.length === 0) return '';
  
  let text = '';
  rewards.forEach(reward => {
    text += `\n**Level ${reward.level} Rewards:**\n`;
    text += `• **${reward.bounty.toLocaleString()}** Bounty\n`;
    if (reward.beli > 0) {
      text += `• **${reward.beli.toLocaleString()}** Beli\n`;
    }
    if (reward.items && reward.items.length > 0) {
      text += `• **${reward.items.join(', ')}**\n`;
    }
  });
  
  return text;
}

module.exports = {
  awardUserXP,
  calculateBountyReward,
  getLevelUpRewards,
  getUserLevelProgress,
  formatLevelUpRewards,
  USER_XP_PER_LEVEL,
  BASE_BOUNTY_REWARD
};