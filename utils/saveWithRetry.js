const User = require('../db/models/User.js');

/**
 * Save user with retry logic to handle MongoDB version conflicts
 * @param {Object} user - Mongoose user document
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise} Resolves when save is successful
 */
async function saveUserWithRetry(user, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await user.save();
      return;
    } catch (error) {
      if (error.name === 'VersionError' && attempt < maxRetries) {
        // Exponential backoff delay
        const delay = Math.pow(2, attempt) * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Fetch fresh user data and merge changes
        const freshUser = await User.findById(user._id);
        if (freshUser) {
          // Copy current changes to fresh document
          Object.assign(freshUser, user.toObject());
          user = freshUser;
        }
        continue;
      }
      // Re-throw other errors or if max retries exceeded
      throw error;
    }
  }
}

module.exports = { saveUserWithRetry };