const User = require('../db/models/User.js');

/**
 * Migrate existing user quest data to new format
 * Fixes corrupted quest progress and ensures data consistency
 */
async function migrateQuestData() {
  try {
    console.log('[QUEST MIGRATION] Starting quest data migration...');
    
    // Find all users that might have quest data issues
    const users = await User.find({
      $or: [
        { activeQuests: { $exists: true } },
        { completedQuests: { $exists: true } },
        { questData: { $exists: false } }
      ]
    });
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        let userModified = false;
        
        // Skip users without username - they're likely corrupted entries
        if (!user.username) {
          console.log(`[QUEST MIGRATION] Skipping user ${user.userId} - no username`);
          errorCount++;
          continue;
        }
        
        // Fix activeQuests structure
        if (user.activeQuests) {
          const cleanedActiveQuests = [];
          
          for (const quest of user.activeQuests) {
            if (quest && quest.questId && typeof quest.questId === 'string') {
              // Convert Map progress to Object if needed
              let progressObj = {};
              
              if (quest.progress) {
                if (quest.progress instanceof Map) {
                  // Convert Map to Object
                  for (const [key, value] of quest.progress.entries()) {
                    progressObj[key] = value;
                  }
                  userModified = true;
                } else if (typeof quest.progress === 'object' && !Array.isArray(quest.progress)) {
                  progressObj = { ...quest.progress };
                } else {
                  // Invalid progress format, reset to empty object
                  progressObj = {};
                  userModified = true;
                }
              }
              
              cleanedActiveQuests.push({
                questId: quest.questId,
                progress: progressObj,
                startedAt: quest.startedAt || Date.now()
              });
            } else {
              // Remove invalid quest entries
              userModified = true;
            }
          }
          
          if (cleanedActiveQuests.length !== user.activeQuests.length) {
            userModified = true;
          }
          
          user.activeQuests = cleanedActiveQuests;
        } else {
          user.activeQuests = [];
          userModified = true;
        }
        
        // Fix completedQuests structure
        if (!user.completedQuests || !Array.isArray(user.completedQuests)) {
          user.completedQuests = [];
          userModified = true;
        } else {
          // Clean up invalid completed quest entries
          const validCompletedQuests = user.completedQuests.filter(
            questId => questId && typeof questId === 'string'
          );
          
          if (validCompletedQuests.length !== user.completedQuests.length) {
            user.completedQuests = validCompletedQuests;
            userModified = true;
          }
        }
        
        // Initialize questData if missing
        if (!user.questData || typeof user.questData !== 'object') {
          user.questData = {
            lastReset: { daily: 0, weekly: 0 },
            migrationVersion: 1
          };
          userModified = true;
        } else if (!user.questData.migrationVersion) {
          user.questData.migrationVersion = 1;
          userModified = true;
        }
        
        // Save changes if user was modified
        if (userModified) {
          user.markModified('activeQuests');
          user.markModified('completedQuests');
          user.markModified('questData');
          
          // Use save with validation disabled for migration
          await user.save({ validateBeforeSave: false });
          migratedCount++;
        }
        
      } catch (userError) {
        console.error(`[QUEST MIGRATION] Error migrating user ${user.userId}:`, userError);
        errorCount++;
      }
    }
    
    console.log(`[QUEST MIGRATION] Migration completed. Users migrated: ${migratedCount}, Errors: ${errorCount}`);
    
    return {
      success: true,
      migratedCount,
      errorCount,
      totalUsers: users.length
    };
    
  } catch (error) {
    console.error('[QUEST MIGRATION] Migration failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if a user needs quest data migration
 * @param {Object} user - User document
 * @returns {boolean} Whether migration is needed
 */
function needsMigration(user) {
  // Check if questData exists and has migration version
  if (!user.questData || !user.questData.migrationVersion) {
    return true;
  }
  
  // Check if activeQuests contains invalid data
  if (user.activeQuests) {
    for (const quest of user.activeQuests) {
      if (!quest.questId || typeof quest.questId !== 'string') {
        return true;
      }
      
      if (quest.progress instanceof Map) {
        return true;
      }
      
      if (quest.progress && typeof quest.progress !== 'object') {
        return true;
      }
    }
  }
  
  // Check if completedQuests is valid
  if (!Array.isArray(user.completedQuests)) {
    return true;
  }
  
  return false;
}

/**
 * Migrate a single user's quest data
 * @param {Object} user - User document
 * @returns {boolean} Whether migration was performed
 */
async function migrateSingleUser(user) {
  if (!needsMigration(user)) {
    return false;
  }
  
  try {
    // Skip users without username - they're likely corrupted entries
    if (!user.username) {
      console.log(`[QUEST MIGRATION] Skipping user ${user.userId} - no username`);
      return false;
    }
    
    let userModified = false;
    
    // Fix activeQuests
    if (user.activeQuests) {
      const cleanedActiveQuests = [];
      
      for (const quest of user.activeQuests) {
        if (quest && quest.questId && typeof quest.questId === 'string') {
          let progressObj = {};
          
          if (quest.progress) {
            if (quest.progress instanceof Map) {
              for (const [key, value] of quest.progress.entries()) {
                progressObj[key] = value;
              }
            } else if (typeof quest.progress === 'object' && !Array.isArray(quest.progress)) {
              progressObj = { ...quest.progress };
            }
          }
          
          cleanedActiveQuests.push({
            questId: quest.questId,
            progress: progressObj,
            startedAt: quest.startedAt || Date.now()
          });
        }
        userModified = true;
      }
      
      user.activeQuests = cleanedActiveQuests;
    } else {
      user.activeQuests = [];
      userModified = true;
    }
    
    // Fix completedQuests
    if (!Array.isArray(user.completedQuests)) {
      user.completedQuests = [];
      userModified = true;
    }
    
    // Initialize questData
    if (!user.questData) {
      user.questData = {
        lastReset: { daily: 0, weekly: 0 },
        migrationVersion: 1
      };
      userModified = true;
    }
    
    if (userModified) {
      user.markModified('activeQuests');
      user.markModified('completedQuests');
      user.markModified('questData');
    }
    
    return userModified;
    
  } catch (error) {
    console.error(`Error migrating user ${user.userId}:`, error);
    return false;
  }
}

module.exports = {
  migrateQuestData,
  needsMigration,
  migrateSingleUser
};
