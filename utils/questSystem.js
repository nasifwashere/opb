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
      // Check saga requirement - default to East Blue if no saga set
      if (quest.unlockRequirements.saga) {
        const userSaga = user.unlockedSagas ? user.unlockedSagas : ['East Blue'];
        if (!userSaga.includes(quest.unlockRequirements.saga)) {
          continue;
        }
      }
      
      if (quest.unlockRequirements.level && (user.xp || 0) < quest.unlockRequirements.level) {
        continue;
      }
      
      if (quest.unlockRequirements.completedQuests) {
        const hasRequiredQuests = quest.unlockRequirements.completedQuests.every(
          reqQuest => user.completedQuests?.some(completed => completed.startsWith(reqQuest))
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

    // Check if story quest is already completed (one-time only)
    if (quest.type === 'story') {
      const alreadyCompleted = user.completedQuests?.some(
        questId => questId.startsWith(quest.questId)
      );
      if (alreadyCompleted) continue;
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
        progress: {},
        startedAt: Date.now()
      };
      user.activeQuests.push(activeQuest);
    }

    // Ensure progress is an object
    if (!activeQuest.progress || typeof activeQuest.progress !== 'object') {
      activeQuest.progress = {};
    }

    // Update progress for matching requirements
    let questCompleted = true;
    let hasMatchingRequirement = false;
    
    for (const requirement of quest.requirements) {
      if (requirement.type === actionType) {
        hasMatchingRequirement = true;
        const currentProgress = activeQuest.progress[requirement.type] || 0;
        activeQuest.progress[requirement.type] = Math.min(currentProgress + amount, requirement.target);
        console.log(`[QUEST] Updated ${quest.questId}: ${requirement.type} ${activeQuest.progress[requirement.type]}/${requirement.target}`);
      }

      // Special handling for team_full quest
      if (requirement.type === 'team_full' && actionType === 'team_change') {
        if (user.team && user.team.length >= 3) {
          activeQuest.progress['team_full'] = 1;
          hasMatchingRequirement = true;
        }
      }

      // Special handling for saga completion
      if (requirement.type === 'saga_complete' && actionType === 'saga_complete') {
        activeQuest.progress['saga_complete'] = (activeQuest.progress['saga_complete'] || 0) + 1;
        hasMatchingRequirement = true;
      }

      // Special handling for battle wins
      if (requirement.type === 'battle_win' && actionType === 'battle_win') {
        activeQuest.progress['battle_win'] = (activeQuest.progress['battle_win'] || 0) + amount;
        hasMatchingRequirement = true;  
      }

      // Special handling for card pulls
      if (requirement.type === 'pull' && actionType === 'pull') {
        activeQuest.progress['pull'] = (activeQuest.progress['pull'] || 0) + amount;
        hasMatchingRequirement = true;
      }

      // Special handling for level ups
      if (requirement.type === 'level_up' && actionType === 'level_up') {
        activeQuest.progress['level_up'] = (activeQuest.progress['level_up'] || 0) + amount;
        hasMatchingRequirement = true;
      }

      // Special handling for exploration
      if (requirement.type === 'explore' && actionType === 'explore') {
        activeQuest.progress['explore'] = (activeQuest.progress['explore'] || 0) + amount;
        hasMatchingRequirement = true;
      }

      // Check if this requirement is completed
      const progress = activeQuest.progress[requirement.type] || 0;
      if (progress < requirement.target) {
        questCompleted = false;
      }
    }

    // Save progress even if quest isn't completed yet
    if (hasMatchingRequirement) {
      await user.save();
    }

    // Only add to completed if quest has matching requirements and is fully completed
    if (questCompleted && hasMatchingRequirement) {
      completedQuests.push(quest.questId);
      console.log(`[QUEST] Quest ${quest.questId} completed!`);
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
      let progress = 0;
      if (activeQuest.progress instanceof Map) {
        progress = activeQuest.progress.get(requirement.type) || 0;
      } else if (activeQuest.progress && typeof activeQuest.progress === 'object') {
        progress = activeQuest.progress[requirement.type] || 0;
      }
      
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

  // Handle both Map and Object progress formats
  let progressObj = {};
  if (activeQuest.progress instanceof Map) {
    for (const [key, value] of activeQuest.progress.entries()) {
      progressObj[key] = value;
    }
  } else if (activeQuest.progress && typeof activeQuest.progress === 'object') {
    progressObj = { ...activeQuest.progress };
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