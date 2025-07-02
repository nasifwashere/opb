const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

function prettyTime(ms) {
    if (ms <= 0) return "Ready";

    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);

    seconds = seconds % 60;
    minutes = minutes % 60;
    hours = hours % 24;

    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (parts.length === 0 && seconds > 0) parts.push(`${seconds}s`);
    if (parts.length === 0) return "Ready";

    return parts.join(" ");
}

function getQuestResetTime(type) {
    const now = new Date();
    
    if (type === 'daily') {
        // Daily quests reset at midnight UTC
        const nextMidnight = new Date(now);
        nextMidnight.setUTCHours(24, 0, 0, 0);
        return nextMidnight.getTime();
    } else if (type === 'weekly') {
        // Weekly quests reset on Monday at midnight UTC
        const nextMonday = new Date(now);
        const daysUntilMonday = (7 - nextMonday.getUTCDay() + 1) % 7 || 7;
        nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
        nextMonday.setUTCHours(0, 0, 0, 0);
        return nextMonday.getTime();
    }
    
    return 0;
}

const data = new SlashCommandBuilder()
    .setName('timers')
    .setDescription('View all active timers and cooldowns');

async function execute(message, args) {
    const userId = message.author.id;
    let user = await User.findOne({ userId });

    if (!user) {
        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setDescription('Start your journey with `op start` first!')
            .setFooter({ text: 'Use op start to begin your adventure' });
        
        return message.reply({ embeds: [embed] });
    }

    const now = Date.now();
    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('Active Timers')
        .setDescription('All your active timers and cooldowns');

    // Core System Timers
    let systemTimers = '';
    
    // Pull Reset (Global - every 5 hours)
    if (global.nextPullReset) {
        const pullResetTime = global.nextPullReset.getTime() - now;
        systemTimers += `**Pull Reset** ${prettyTime(pullResetTime)}\n`;
    } else {
        // Fallback calculation if global not set
        const pullResetInterval = 5 * 60 * 60 * 1000; // 5 hours
        const lastReset = user.pullData?.lastReset || user.lastPull || 0;
        const nextReset = lastReset + pullResetInterval;
        const timeLeft = nextReset - now;
        systemTimers += `**Pull Reset** ${prettyTime(timeLeft)}\n`;
    }
    
    // Card Drop (Global - every 5 minutes)
    if (global.nextCardDrop) {
        const dropTime = global.nextCardDrop.getTime() - now;
        systemTimers += `**Card Drop** ${prettyTime(dropTime)}\n`;
    } else {
        // If no global timer, assume drops happen every 5 minutes
        systemTimers += `**Card Drop** Not scheduled\n`;
    }

    // Personal Timers
    let personalTimers = '';
    
    // Daily Reward (24 hours after last claim)
    if (user.dailyReward?.lastClaimed) {
        const lastClaimed = user.dailyReward.lastClaimed;
        const nextDaily = lastClaimed + (24 * 60 * 60 * 1000); // 24 hours
        const timeLeft = nextDaily - now;
        personalTimers += `**Daily Reward** ${prettyTime(timeLeft)}\n`;
    } else {
        personalTimers += `**Daily Reward** Ready\n`;
    }
    
    // Quest Timers
    let questTimers = '';
    
    // Daily Quests Reset
    const nextDailyReset = getQuestResetTime('daily');
    const dailyResetTime = nextDailyReset - now;
    questTimers += `**Daily Quests** ${prettyTime(dailyResetTime)}\n`;
    
    // Weekly Quests Reset
    const nextWeeklyReset = getQuestResetTime('weekly');
    const weeklyResetTime = nextWeeklyReset - now;
    questTimers += `**Weekly Quests** ${prettyTime(weeklyResetTime)}\n`;

    // Battle & Activity Cooldowns
    let cooldowns = '';
    
    // Battle defeat cooldown
    if (user.exploreStates?.defeatCooldown && user.exploreStates.defeatCooldown > now) {
        const exploreTime = user.exploreStates.defeatCooldown - now;
        cooldowns += `**Battle Defeat** ${prettyTime(exploreTime)}\n`;
    }
    
    // Duel cooldown
    if (user.duelCooldown && user.duelCooldown > now) {
        const duelTime = user.duelCooldown - now;
        cooldowns += `**Duel Cooldown** ${prettyTime(duelTime)}\n`;
    }

    // Active Boosts
    let boosts = '';
    if (user.activeBoosts && user.activeBoosts.length > 0) {
        const activeBoosts = user.activeBoosts.filter(boost => boost.expiresAt > now);
        if (activeBoosts.length > 0) {
            activeBoosts.forEach(boost => {
                const boostTime = boost.expiresAt - now;
                const boostName = boost.type.charAt(0).toUpperCase() + boost.type.slice(1);
                boosts += `**${boostName}** ${prettyTime(boostTime)}\n`;
            });
        }
    }

    // Add fields with proper sections
    if (systemTimers) {
        embed.addFields({
            name: 'System Resets',
            value: systemTimers.trim(),
            inline: true
        });
    }
    
    if (personalTimers) {
        embed.addFields({
            name: 'Personal Timers',
            value: personalTimers.trim(),
            inline: true
        });
    }
    
    if (questTimers) {
        embed.addFields({
            name: 'Quest Resets',
            value: questTimers.trim(),
            inline: true
        });
    }
    
    if (cooldowns) {
        embed.addFields({
            name: 'Cooldowns',
            value: cooldowns.trim(),
            inline: false
        });
    }
    
    if (boosts) {
        embed.addFields({
            name: 'Active Boosts',
            value: boosts.trim(),
            inline: false
        });
    }

    // If no active timers at all
    if (!systemTimers && !personalTimers && !questTimers && !cooldowns && !boosts) {
        embed.setDescription('No active timers or cooldowns found');
    }

    embed.setFooter({ text: 'Timers update automatically • Times shown in approximate values' });
    embed.setTimestamp();

    await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };