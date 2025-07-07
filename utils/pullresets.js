// utils/pullresets.js
// Handles per-user pull reset logic for reset token
const User = require('../db/models/User.js');
const resetSystem = require('./resetSystem.js');

/**
 * Resets the pull stats for a single user (for reset token)
 * @param {User} user - Mongoose user document
 * @returns {Promise<void>}
 */
async function resetUserPulls(user) {
  if (!user.pullData) user.pullData = {};
  // Ensure lastReset is at least the global lastPullReset
  const globalLastPullReset = resetSystem.config?.lastPullReset || 0;
  const now = Date.now();
  user.pullData.dailyPulls = 0;
  user.pullData.lastReset = Math.max(now, globalLastPullReset);
  user.pulls = [];
  user.lastPull = Math.max(now, globalLastPullReset);
  await user.save();
}

module.exports = { resetUserPulls };
