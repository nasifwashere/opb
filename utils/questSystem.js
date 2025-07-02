const Quest = require('../db/models/Quest.js');
const User = require('../db/models/User.js');
const { saveUserWithRetry } = require('./saveWithRetry.js');
const { distributeXPToTeam } = require('./levelSystem.js');
const fs = require('fs');
const path = require('path');

const questsPath = path.resolve('data', 'quests.json');

// Configuration for quest logging - set to false to reduce spam
const ENABLE_QUEST_LOGGING = false; // Disabled after debugging confirmed working

// Silent logging function that only logs when debugging is enabled
function questLog(message) {
    if (ENABLE_QUEST_LOGGING) {
        console.log(`[QUEST DEBUG] ${message}`);
    }
}

/**
 * Load available quests from database and data file
 * @returns {Array} Array of quest objects
 */
async function loadQuestDatabase() {
    try {
        // Prefer file-based quests for reliability
        if (fs.existsSync(questsPath)) {
            questLog(`Loading quests from file: ${questsPath}`);
            const fileQuests = JSON.parse(fs.readFileSync(questsPath, 'utf8'));
            questLog(`Loaded ${fileQuests.length} quests from file`);
            return fileQuests;
        }
        
        // Fallback to database if file doesn't exist
        let dbQuests = await Quest.find({ active: true });
        questLog(`Loaded ${dbQuests.length} quests from database`);
        
        return dbQuests;
    } catch (error) {
        console.error('Error loading quest database:', error);
        return [];
    }
}

/**
 * Get available quests for a user based on their progress
 * @param {Object} user - User document
 * @returns {Array} Array of available quests
 */
async function getAvailableQuests(user) {
    try {
        const allQuests = await loadQuestDatabase();
        const availableQuests = [];
        
        if (!allQuests || allQuests.length === 0) {
            console.warn('No quests found in database or file');
            return [];
        }
        
        // Ensure user has proper quest data structure
        await ensureQuestDataStructure(user, false);
    
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
        
        // Check if quest is already completed for this reset period
        const resetPeriod = getQuestResetPeriod(quest.type);
        const completedKey = `${quest.questId}_${resetPeriod}`;
        
        if (quest.type === 'daily' || quest.type === 'weekly') {
            const isCompletedThisPeriod = user.completedQuests?.includes(completedKey);
            if (isCompletedThisPeriod) continue;
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
    } catch (error) {
        console.error('Error getting available quests:', error);
        return [];
    }
}

/**
 * Update quest progress for a user (with reduced logging)
 * @param {Object} user - User document
 * @param {string} actionType - Type of action (battle_win, explore, pull, etc.)
 * @param {number} amount - Amount to add to progress
 * @returns {Array} Array of completed quest IDs
 */
async function updateQuestProgress(user, actionType, amount = 1) {
    try {
        questLog(`Updating quest progress for user ${user.userId}: ${actionType} +${amount}`);
        
        // Ensure proper quest data structure
        await ensureQuestDataStructure(user, false);
        
        const availableQuests = await getAvailableQuests(user);
        questLog(`Found ${availableQuests.length} available quests for user`);
        
        const completedQuests = [];
        
        for (const quest of availableQuests) {
            // Skip if already completed for this reset period
            const resetPeriod = getQuestResetPeriod(quest.type);
            const claimId = `${quest.questId}_${resetPeriod}`;
            
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
            
            // Ensure progress is a plain object
            if (!activeQuest.progress || typeof activeQuest.progress !== 'object' || Array.isArray(activeQuest.progress)) {
                activeQuest.progress = {};
            }
            
            // Update progress for matching requirements
            let questCompleted = true;
            let hasMatchingRequirement = false;
            
            for (const requirement of quest.requirements) {
                // Handle direct action type matches
                if (requirement.type === actionType) {
                    hasMatchingRequirement = true;
                    const currentProgress = activeQuest.progress[requirement.type] || 0;
                    activeQuest.progress[requirement.type] = Math.min(currentProgress + amount, requirement.target);
                    
                    // Only log when quest debugging is enabled
                    questLog(`[QUEST] Updated ${quest.questId}: ${requirement.type} ${activeQuest.progress[requirement.type]}/${requirement.target}`);
                }
                
                // Special handling for specific quest types
                if (requirement.type === 'team_full' && actionType === 'team_change') {
                    if (user.team && user.team.length >= 3) {
                        activeQuest.progress['team_full'] = 1;
                        hasMatchingRequirement = true;
                    }
                }
                
                if (requirement.type === 'saga_complete' && actionType === 'saga_complete') {
                    activeQuest.progress['saga_complete'] = (activeQuest.progress['saga_complete'] || 0) + amount;
                    hasMatchingRequirement = true;
                }
                
                if (requirement.type === 'battle_win' && actionType === 'battle_win') {
                    activeQuest.progress['battle_win'] = (activeQuest.progress['battle_win'] || 0) + amount;
                    hasMatchingRequirement = true;
                }
                
                if (requirement.type === 'pull' && actionType === 'pull') {
                    activeQuest.progress['pull'] = (activeQuest.progress['pull'] || 0) + amount;
                    hasMatchingRequirement = true;
                }
                
                if (requirement.type === 'level_up' && actionType === 'level_up') {
                    activeQuest.progress['level_up'] = (activeQuest.progress['level_up'] || 0) + amount;
                    hasMatchingRequirement = true;
                }
                
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
            
            // Mark progress as modified if there was a matching requirement
            if (hasMatchingRequirement) {
                // Mark the document as modified for the activeQuests array
                user.markModified('activeQuests');
                // Don't save here - let the calling function handle saving to avoid multiple saves
            }
            
            // Only mark as completed if quest has matching requirements and is fully completed
            if (questCompleted && hasMatchingRequirement) {
                completedQuests.push(quest.questId);
                questLog(`[QUEST] Quest ${quest.questId} completed!`);
            }
        }
        
        return completedQuests;
        
    } catch (error) {
        console.error('Error updating quest progress:', error);
        return [];
    }
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
        
        // Ensure proper quest data structure
        await ensureQuestDataStructure(user, true);
        
        // Check if quest is active
        const activeQuest = user.activeQuests?.find(aq => aq.questId === questId);
        
        if (!activeQuest) {
            return { success: false, message: 'You have not started this quest.' };
        }
        
        // Verify all requirements are met
        for (const requirement of quest.requirements) {
            const progress = activeQuest.progress[requirement.type] || 0;
            if (progress < requirement.target) {
                return {
                    success: false,
                    message: `Quest not completed. ${requirement.type}: ${progress}/${requirement.target}`
                };
            }
        }
        
        // Check if already claimed for this reset period
        const resetPeriod = getQuestResetPeriod(quest.type);
        const claimId = `${questId}_${resetPeriod}`;
        
        if (user.completedQuests?.includes(claimId)) {
            return { success: false, message: 'Quest reward already claimed.' };
        }
        
        // Award rewards
        let rewardText = '';
        let totalXpAwarded = 0;
        for (const reward of quest.rewards) {
            switch (reward.type) {
                case 'beli':
                    user.beli = (user.beli || 0) + reward.amount;
                    rewardText += `+${reward.amount} Beli `;
                    break;
                    
                case 'xp':
                    user.xp = (user.xp || 0) + reward.amount;
                    totalXpAwarded += reward.amount;
                    rewardText += `+${reward.amount} XP `;
                    break;
                    
                case 'item':
                    if (!user.inventory) user.inventory = [];
                    // Normalize item name for inventory storage
                    const normalizedItemName = reward.itemName.toLowerCase().replace(/\s+/g, '');
                    user.inventory.push(normalizedItemName);
                    rewardText += `+${reward.itemName} `;
                    break;
                    
                case 'card':
                    if (!user.cards) user.cards = [];
                    user.cards.push({
                        name: reward.itemName,
                        rank: reward.rank || 'C',
                        level: 1,
                        experience: 0,
                        timesUpgraded: 0,
                        locked: false
                    });
                    rewardText += `+${reward.itemName} card `;
                    break;
            }
        }

        // Distribute XP to team cards if any XP was awarded
        if (totalXpAwarded > 0) {
            distributeXPToTeam(user, totalXpAwarded);
        }

        // Mark quest as completed
        if (!user.completedQuests) user.completedQuests = [];
        user.completedQuests.push(claimId);
        
        // Remove from active quests
        user.activeQuests = user.activeQuests.filter(aq => aq.questId !== questId);
        
        // Mark arrays as modified and save
        user.markModified('completedQuests');
        user.markModified('activeQuests');
        await saveUserWithRetry(user);
        
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
 * Get quest progress for a user
 * @param {Object} user - User document
 * @param {string} questId - Quest ID to check
 * @returns {Object} Progress object
 */
function getQuestProgress(user, questId) {
    if (!user.activeQuests || !Array.isArray(user.activeQuests)) {
        return { started: false, progress: {} };
    }
    
    const activeQuest = user.activeQuests.find(aq => aq.questId === questId);
    
    if (!activeQuest) {
        return { started: false, progress: {} };
    }
    
    // Ensure progress is always an object
    let progressObj = {};
    if (activeQuest.progress && typeof activeQuest.progress === 'object' && !Array.isArray(activeQuest.progress)) {
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
    }
    if (questType === 'weekly') {
        return getWeekStart();
    }
    return 'permanent';
}

/**
 * Ensure user has proper quest data structure
 * @param {Object} user - User document
 * @param {boolean} autoSave - Whether to automatically save changes (default: false)
 * @returns {boolean} Whether changes were made that need saving
 */
async function ensureQuestDataStructure(user, autoSave = false) {
    let needsSave = false;
    
    if (!user.activeQuests) {
        user.activeQuests = [];
        needsSave = true;
    }
    
    if (!user.completedQuests) {
        user.completedQuests = [];
        needsSave = true;
    }
    
    if (!user.questData) {
        user.questData = {
            progress: new Map(),
            completed: [],
            lastReset: {
                daily: 0,
                weekly: 0
            }
        };
        needsSave = true;
    }
    
    if (needsSave && autoSave) {
        await saveUserWithRetry(user);
    }
    
    return needsSave;
}

module.exports = {
    loadQuestDatabase,
    getAvailableQuests,
    updateQuestProgress,
    claimQuestReward,
    getQuestProgress,
    getQuestResetPeriod,
    ensureQuestDataStructure
};