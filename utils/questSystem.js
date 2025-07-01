const Quest = require('../db/models/Quest.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');

const questsPath = path.resolve('data', 'quests.json');

/**
 * Load available quests from database and data file
 * @returns {Array} Array of quest objects
 */
async function loadQuestDatabase() {
  // Try to load from database first
  let dbQuests = await Quest.find({ active: true });

  // If no quests in database, load from file and seed database
  if (dbQuests.length === 0) {
    try {
      if (fs.existsSync(questsPath)) {
        const fileQuests = JSON.parse(fs.readFileSync(questsPath, 'utf8'));

        // Seed database with quests from file
        for (const questData of fileQuests) {
          const quest = new Quest(questData);
          await quest.save();
        }

        dbQuests = await Quest.find({ active: true });
      }
    } catch (error) {
      console.error('Error loading quest database:', error);
    }
  }

  return dbQuests;
}

/**
 * Get available quests for a user based on their progress
 * @param {Object} user - User document
 * @returns {Array} Array of available quests
 */
async function getAvailableQuests(user) {
  const allQuests = await loadQuestDatabase();
  const availableQuests = [];

  for (const quest of allQuests) {
    // Check unlock requirements
    if (quest.unlockRequirements) {
      if (quest.unlockRequirements.saga && user.saga !== quest.unlockRequirements.saga) {
        continue;
      }
      if (quest.unlockRequirements.level && (user.xp || 0) < quest.unlockRequirements.level) {
        continue;
      }
      if (quest.unlockRequirements.completedQuests) {
        const hasRequiredQuests = quest.unlockRequirements.completedQuests.every(
          reqQuest => user.completedQuests?.includes(reqQuest)
        );
        if (!hasRequiredQuests) continue;
      }
    }

    // Check if quest is already completed today (for daily quests)
    if (quest.type === 'daily') {
      const today = new Date().toDateString();
      const completedToday = user.completedQuests?.some(
        questId => questId.startsWith(`${quest.questId}_${today}`)
      );
      if (completedToday) continue;
    }

    // Check if quest is already completed this week (for weekly quests)
    if (quest.type === 'weekly') {
      const weekStart = getWeekStart();
      const completedThisWeek = user.completedQuests?.some(
        questId => questId.startsWith(`${quest.questId}_${weekStart}`)
      );
      if (completedThisWeek) continue;
    }

    availableQuests.push(quest);
  }

  return availableQuests;
}

/**
 * Update quest progress for a user
 * @param {Object} user - User document
 * @param {string} actionType - Type of action (battle_win, explore, pull, etc.)
 * @param {number} amount - Amount to add to progress
 * @returns {Array} Array of completed quest IDs
 */
async function updateQuestProgress(user, actionType, amount = 1) {
  // Check and reset quests if needed
  await checkAndResetUserQuests(user);
  
  if (!user.activeQuests) user.activeQuests = [];
  if (!user.completedQuests) user.completedQuests = [];

  const availableQuests = await getAvailableQuests(user);
  const completedQuests = [];

  for (const quest of availableQuests) {
    // Skip if already completed today/week
    const claimId = `${quest.questId}_${getQuestResetPeriod(quest.type)}`;
    if (user.completedQuests.includes(claimId)) {
      continue;
    }

    // Find or create active quest entry
    let activeQuest = user.activeQuests.find(aq => aq.questId === quest.questId);
    if (!activeQuest) {
      activeQuest = {
        questId: quest.questId,
        progress: new Map(),
        startedAt: Date.now()
      };
      user.activeQuests.push(activeQuest);
    }

    // Convert progress to Map if it's an object (for backward compatibility)
    if (!(activeQuest.progress instanceof Map)) {
      const progressMap = new Map();
      if (activeQuest.progress && typeof activeQuest.progress === 'object') {
        for (const [key, value] of Object.entries(activeQuest.progress)) {
          progressMap.set(key, value);
        }
      }
      activeQuest.progress = progressMap;
    }

    // Update progress for matching requirements
    let questCompleted = true;
    for (const requirement of quest.requirements) {
      if (requirement.type === actionType) {
        const currentProgress = activeQuest.progress.get(requirement.type) || 0;
        activeQuest.progress.set(requirement.type, Math.min(currentProgress + amount, requirement.target));
      }

      // Check if this requirement is completed
      const progress = activeQuest.progress.get(requirement.type) || 0;
      if (progress < requirement.target) {
        questCompleted = false;
      }
    }

    // If quest is completed, add to completed list
    if (questCompleted) {
      completedQuests.push(quest.questId);
    }
  }

  return completedQuests;
}

/**
 * Claim rewards for a completed quest
 * @param {Object} user - User document
 * @param {string} questId - ID of the quest to claim
 * @returns {Object} Result object with success status and message
 */
async function claimQuestReward(user, questId) {
  try {
    const quest = await Quest.findOne({ questId: questId, active: true });
    if (!quest) {
      return { success: false, message: 'Quest not found.' };
    }

    // Check if quest is completed
    const activeQuest = user.activeQuests?.find(aq => aq.questId === questId);
    if (!activeQuest) {
      return { success: false, message: 'You have not started this quest.' };
    }

    // Verify all requirements are met - handle both Map and Object progress
    for (const requirement of quest.requirements) {
      const progress = activeQuest.progress instanceof Map ? 
        activeQuest.progress.get(requirement.type) || 0 : 
        activeQuest.progress[requirement.type] || 0;
      if (progress < requirement.target) {
        return { 
          success: false, 
          message: `Quest not completed. ${requirement.type}: ${progress}/${requirement.target}` 
        };
      }
    }

    // Check if already claimed
    const claimId = `${questId}_${getQuestResetPeriod(quest.type)}`;
    if (user.completedQuests?.includes(claimId)) {
      return { success: false, message: 'Quest reward already claimed.' };
    }

    // Award rewards
    let rewardText = '';
    for (const reward of quest.rewards) {
      switch (reward.type) {
        case 'beli':
          user.beli = (user.beli || 0) + reward.amount;
          rewardText += `+${reward.amount} Beli `;
          break;
        case 'xp':
          user.xp = (user.xp || 0) + reward.amount;
          rewardText += `+${reward.amount} XP `;
          break;
        case 'item':
          if (!user.inventory) user.inventory = [];
          user.inventory.push(reward.itemName.toLowerCase().replace(/\s+/g, ''));
          rewardText += `+${reward.itemName} `;
          break;
        case 'card':
          if (!user.cards) user.cards = [];
          user.cards.push({
            name: reward.itemName,
            rank: reward.rank || 'C',
            level: 1,
            timesUpgraded: 0
          });
          rewardText += `+${reward.itemName} card `;
          break;
      }
    }

    // Mark quest as completed
    if (!user.completedQuests) user.completedQuests = [];
    user.completedQuests.push(claimId);

    // Remove from active quests
    user.activeQuests = user.activeQuests.filter(aq => aq.questId !== questId);

    return {
      success: true,
      message: `Quest "${quest.name}" completed! Rewards: ${rewardText.trim()}`
    };
  } catch (error) {
    console.error('Error claiming quest reward:', error);
    return { success: false, message: 'Failed to claim quest reward.' };
  }
}

/**
 * Reset daily/weekly quests for all users
 * @param {string} resetType - 'daily' or 'weekly'
 * @returns {number} Number of users affected
 */
async function resetQuests(resetType = 'daily') {
  try {
    const resetPeriod = getQuestResetPeriod(resetType);

    // Remove completed quests of this type from all users
    const result = await User.updateMany(
      {},
      {
        $pull: {
          completedQuests: { $regex: `^.*_${resetType}_${resetPeriod}$` },
          activeQuests: { questId: { $regex: `^${resetType}_` } }
        }
      }
    );

    console.log(`[QUEST] Reset ${resetType} quests for ${result.modifiedCount} users`);
    return result.modifiedCount;
  } catch (error) {
    console.error(`Error resetting ${resetType} quests:`, error);
    return 0;
  }
}

/**
 * Get quest progress for a user
 * @param {Object} user - User document
 * @param {string} questId - Quest ID to check
 * @returns {Object} Progress object
 */
function getQuestProgress(user, questId) {
  const activeQuest = user.activeQuests?.find(aq => aq.questId === questId);
  if (!activeQuest) {
    return { started: false, progress: {} };
  }

  const progressObj = {};
  for (const [key, value] of Object.entries(activeQuest.progress)) {
    progressObj[key] = value;
  }

  return {
    started: true,
    progress: progressObj,
    startedAt: activeQuest.startedAt
  };
}

/**
 * Helper function to get the start of the current week
 * @returns {string} Week start date string
 */
function getWeekStart() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek;
  const weekStart = new Date(now.setDate(diff));
  return weekStart.toDateString();
}

/**
 * Helper function to get quest reset period identifier
 * @param {string} questType - 'daily' or 'weekly'
 * @returns {string} Reset period identifier
 */
function getQuestResetPeriod(questType) {
  if (questType === 'daily') {
    return new Date().toDateString();
  } else if (questType === 'weekly') {
    return getWeekStart();
  }
  return '';
}

/**
 * Initialize user quest data if needed
 * @param {Object} user - User document
 * @returns {boolean} Whether initialization was performed
 */
async function checkAndResetUserQuests(user) {
  if (!user.questData) {
    user.questData = {
      progress: new Map(),
      completed: [],
      lastReset: { daily: 0, weekly: 0 }
    };
    return true;
  }
  
  // Quest resets are now handled globally by the reset system
  // Individual user quest data is managed by the global reset system
  return false;
}

module.exports = {
  getAvailableQuests,
  updateQuestProgress,
  claimQuestReward,
  resetQuests,
  getQuestProgress,
  checkAndResetUserQuests
};