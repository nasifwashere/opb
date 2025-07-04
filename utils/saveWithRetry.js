const User = require('../db/models/User.js');

/**
 * Save user with retry logic to handle MongoDB version conflicts
 * @param {Object} user - Mongoose user document
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<Object|null>} Resolves with the fresh user document when save is successful, or null if the document no longer exists
 */
async function saveUserWithRetry(user, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await user.save();
      // Refetch and return the latest user document after save
      return await User.findById(user._id);
    } catch (error) {
      console.error(`[saveUserWithRetry] Error for user ${user._id} on attempt ${attempt}:`, error);
      console.error(`[saveUserWithRetry] User object:`, JSON.stringify(user, null, 2));
      if (error.stack) {
        console.error(`[saveUserWithRetry] Error stack:`, error.stack);
      }
      // If the error is a VersionError and the message says no matching document, abort immediately
      if (error.name === 'VersionError' && error.message && error.message.includes('No matching document found')) {
        console.error(`[saveUserWithRetry] User document with id ${user._id} no longer exists. Aborting save.`);
        return null;
      }
      if (error.name === 'VersionError' && attempt < maxRetries) {
        // Exponential backoff delay
        const delay = Math.pow(2, attempt) * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
        // Fetch fresh user data and merge changes, but do NOT overwrite _id or __v
        const freshUser = await User.findById(user._id);
        if (freshUser) {
          const userObj = user.toObject();
          delete userObj._id;
          delete userObj.__v;
          // Optionally remove timestamps if present
          delete userObj.createdAt;
          delete userObj.updatedAt;
          Object.assign(freshUser, userObj);
          user = freshUser;
        } else {
          // If the user is missing, abort
          console.error(`[saveUserWithRetry] User document with id ${user._id} disappeared during retry. Aborting save.`);
          return null;
        }
        continue;
      }
      // Re-throw other errors or if max retries exceeded
      throw error;
    }
  }
  throw new Error('Failed to save user after maximum retries');
}

module.exports = { saveUserWithRetry };