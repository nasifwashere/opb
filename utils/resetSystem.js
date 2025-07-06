const User = require('../db/models/User.js');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const { autoUntrainExpiredCards } = require('./trainingSystem.js');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

// Global reset intervals (in milliseconds)
const PULL_RESET_INTERVAL = 5 * 60 * 60 * 1000; // 5 hours
const DAILY_QUEST_RESET_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const WEEKLY_QUEST_RESET_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days
const TRAINING_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

class ResetSystem {
    constructor() {
        this.client = null;
        this.pullResetTimer = null;
        this.dailyQuestResetTimer = null;
        this.weeklyQuestResetTimer = null;
        this.trainingCheckTimer = null;
        this.config = {
            pullResetChannelId: null,
            questResetChannelId: null,
            lastPullReset: 0,
            lastDailyQuestReset: 0,
            lastWeeklyQuestReset: 0
        };
    }

    async initialize(client) {
        this.client = client;
        await this.loadConfig();
        this.startResetTimers();
    }

    async loadConfig() {
        try {
            const configData = await fs.readFile(CONFIG_PATH, 'utf8');
            this.config = { ...this.config, ...JSON.parse(configData) };
        } catch (error) {
            console.log('Creating new reset config file');
            await this.saveConfig();
        }
    }

    async saveConfig() {
        try {
            await fs.writeFile(CONFIG_PATH, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Error saving reset config:', error);
        }
    }

    async setResetChannel(type, channelId) {
        if (type === 'pulls') {
            this.config.pullResetChannelId = channelId;
        } else if (type === 'quests' || type === 'daily' || type === 'weekly') {
            this.config.questResetChannelId = channelId;
        }
        await this.saveConfig();
    }

    startResetTimers() {
        // Calculate next reset times
        const now = Date.now();
        
        // Pull resets
        const timeSinceLastPullReset = now - this.config.lastPullReset;
        const timeUntilNextPullReset = PULL_RESET_INTERVAL - (timeSinceLastPullReset % PULL_RESET_INTERVAL);
        
        // Set global next pull reset time for timers command
        global.nextPullReset = new Date(now + timeUntilNextPullReset);
        
        console.log(`Next pull reset in ${Math.round(timeUntilNextPullReset / 1000 / 60)} minutes`);
        
        this.pullResetTimer = setTimeout(() => {
            this.resetPulls();
            // Set up recurring timer
            this.pullResetTimer = setInterval(() => this.resetPulls(), PULL_RESET_INTERVAL);
        }, timeUntilNextPullReset);

        // Daily quest resets (reset at midnight UTC)
        const nextMidnight = new Date();
        nextMidnight.setUTCHours(24, 0, 0, 0);
        const timeUntilMidnight = nextMidnight.getTime() - now;
        
        this.dailyQuestResetTimer = setTimeout(() => {
            this.resetDailyQuests();
            // Set up recurring timer for daily resets
            this.dailyQuestResetTimer = setInterval(() => this.resetDailyQuests(), DAILY_QUEST_RESET_INTERVAL);
        }, timeUntilMidnight);

        // Weekly quest resets (reset on Monday at midnight UTC)
        const nextMonday = new Date();
        const daysUntilMonday = (7 - nextMonday.getUTCDay() + 1) % 7 || 7;
        nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
        nextMonday.setUTCHours(0, 0, 0, 0);
        const timeUntilMonday = nextMonday.getTime() - now;

        this.weeklyQuestResetTimer = setTimeout(() => {
            this.resetWeeklyQuests();
            // Set up recurring timer for weekly resets
            this.weeklyQuestResetTimer = setInterval(() => this.resetWeeklyQuests(), WEEKLY_QUEST_RESET_INTERVAL);
        }, timeUntilMonday);

        // Training check timer (runs every hour)
        this.trainingCheckTimer = setInterval(() => this.checkExpiredTraining(), TRAINING_CHECK_INTERVAL);
        
        // Run initial training check
        this.checkExpiredTraining();
    }

    async resetPulls() {
        try {
            console.log('Performing global pull reset...');
            
            // Reset all users' pulls (both old and new systems)
            await User.updateMany({}, { 
                $set: { 
                    pulls: [],
                    lastPull: 0,
                    'pullData.dailyPulls': 0,
                    'pullData.lastReset': Date.now()
                } 
            });

            this.config.lastPullReset = Date.now();
            await this.saveConfig();
            
            // Update global next pull reset time for timers command
            global.nextPullReset = new Date(Date.now() + PULL_RESET_INTERVAL);

            // Send notification
            if (this.config.pullResetChannelId) {
                await this.sendPullResetNotification();
            }

            console.log('Pull reset completed for all users');
        } catch (error) {
            console.error('Error during pull reset:', error);
        }
    }

    async resetDailyQuests() {
        try {
            console.log('Performing global daily quest reset...');
            
            // Reset daily quests for all users
            await User.updateMany({}, {
                $pull: {
                    'questData.completed': { $regex: '^daily_' }
                },
                $unset: {
                    'activeQuests.$[elem]': ''
                }
            }, {
                arrayFilters: [{ 'elem.questId': { $regex: '^daily_' } }]
            });

            // Clean up empty array elements
            await User.updateMany({}, {
                $pull: {
                    'activeQuests': null
                }
            });

            this.config.lastDailyQuestReset = Date.now();
            await this.saveConfig();

            // Send notification
            if (this.config.questResetChannelId) {
                await this.sendQuestResetNotification('daily');
            }

            console.log('Daily quest reset completed for all users');
        } catch (error) {
            console.error('Error during daily quest reset:', error);
        }
    }

    async resetWeeklyQuests() {
        try {
            console.log('Performing global weekly quest reset...');
            
            // Reset weekly quests for all users
            await User.updateMany({}, {
                $pull: {
                    'questData.completed': { $regex: '^weekly_' }
                },
                $unset: {
                    'activeQuests.$[elem]': ''
                }
            }, {
                arrayFilters: [{ 'elem.questId': { $regex: '^weekly_' } }]
            });

            // Clean up empty array elements
            await User.updateMany({}, {
                $pull: {
                    'activeQuests': null
                }
            });

            this.config.lastWeeklyQuestReset = Date.now();
            await this.saveConfig();

            // Send notification
            if (this.config.questResetChannelId) {
                await this.sendQuestResetNotification('weekly');
            }

            console.log('Weekly quest reset completed for all users');
        } catch (error) {
            console.error('Error during weekly quest reset:', error);
        }
    }

    async checkExpiredTraining() {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) {
            console.warn('[TRAINING] Skipping auto-untrain: MongoDB not connected');
            return;
        }
        try {
            const autoUntrainedCount = await autoUntrainExpiredCards();
            if (autoUntrainedCount > 0) {
                console.log(`[TRAINING] Auto-untrained ${autoUntrainedCount} expired training cards`);
            }
        } catch (error) {
            console.error('Error checking expired training:', error);
        }
    }

    async sendPullResetNotification() {
        try {
            if (!this.client) {
                console.warn('Pull reset notification: Discord client not available.');
                return;
            }
            const channel = this.client.channels.cache.get(this.config.pullResetChannelId);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setTitle('<:ref:1390846865968205985> Pull Reset!')
                .setDescription('All player pulls have been reset! Use `op pull` to get new cards!')
                .setColor(0x00ff00)
                .setTimestamp();

            await channel.send({ 
                content: '<@&1389619213492158464>',
                embeds: [embed] 
            });
        } catch (error) {
            console.error('Error sending pull reset notification:', error);
        }
    }

    async sendQuestResetNotification(type) {
        try {
            const channel = this.client.channels.cache.get(this.config.questResetChannelId);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setTitle(`📋 ${type.charAt(0).toUpperCase() + type.slice(1)} Quest Reset!`)
                .setDescription(`All ${type} quests have been reset! Check your quest progress with \`op quest\`!`)
                .setColor(0x3498db)
                .setTimestamp();

            await channel.send({ 
                content: '<@&1389619213492158464>',
                embeds: [embed] 
            });
        } catch (error) {
            console.error('Error sending quest reset notification:', error);
        }
    }

    // Check if user's pulls should be reset based on global reset time
    shouldResetUserPulls(user) {
        // Check both old and new systems
        const oldSystemNeedsReset = user.lastPull < this.config.lastPullReset;
        const newSystemNeedsReset = user.pullData && user.pullData.lastReset < this.config.lastPullReset;
        return oldSystemNeedsReset || newSystemNeedsReset;
    }

    // Reset user's pulls if needed
    resetUserPullsIfNeeded(user) {
        if (this.shouldResetUserPulls(user)) {
            user.pulls = [];
            user.lastPull = 0;
            if (user.pullData) {
                user.pullData.dailyPulls = 0;
                user.pullData.lastReset = Date.now();
            }
            return true;
        }
        return false;
    }

    // Force reset user's pulls regardless of global timer
    async forceResetUserPulls(user) {
        if (!user.pullData) user.pullData = {};
        user.pullData.dailyPulls = 0;
        user.pullData.lastReset = Date.now();
        user.pulls = [];
        user.lastPull = 0;
        await user.save();
        // Also update global lastPullReset and send notification
        this.config.lastPullReset = Date.now();
        await this.saveConfig && this.saveConfig();
        if (this.client && this.config.pullResetChannelId) {
            await this.sendPullResetNotification();
        }
        console.log(`[DEBUG] Pulls reset for user ${user.userId || user.id}`);
        return true;
    }

    cleanup() {
        if (this.pullResetTimer) clearTimeout(this.pullResetTimer);
        if (this.dailyQuestResetTimer) clearTimeout(this.dailyQuestResetTimer);
        if (this.weeklyQuestResetTimer) clearTimeout(this.weeklyQuestResetTimer);
        if (this.trainingCheckTimer) clearInterval(this.trainingCheckTimer);
    }
}

// Global instance
const resetSystem = new ResetSystem();

module.exports = resetSystem;
