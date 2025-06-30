
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

function prettyTime(ms) {
    if (ms <= 0) return "Ready now";
    
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);
    
    seconds = seconds % 60;
    minutes = minutes % 60;
    hours = hours % 24;

    let out = [];
    if (days > 0) out.push(`${days}d`);
    if (hours > 0) out.push(`${hours}h`);
    if (minutes > 0) out.push(`${minutes}m`);
    if (out.length === 0) out.push(`${seconds}s`);

    return out.join(" ");
}

const data = new SlashCommandBuilder()
    .setName('timers')
    .setDescription('View all active timers in the bot');

async function execute(message, args) {
    const userId = message.author.id;
    let user = await User.findOne({ userId });

    if (!user) {
        return message.reply('Start your journey with `op start` first!');
    }

    const now = Date.now();
    const embed = new EmbedBuilder()
        .setTitle('⏰ Bot Timers')
        .setColor(0x3498db);

    // Global timers
    let globalTimers = '';
    
    // Pull reset timer (global for all users)
    if (global.nextPullReset) {
        const pullResetTime = global.nextPullReset.getTime() - now;
        globalTimers += `🔄 **Pull Reset**: ${prettyTime(pullResetTime)}\n`;
    }

    // Card drop timer (global, every 10 minutes)
    const cardDropInterval = 10 * 60 * 1000; // 10 minutes
    const lastCardDrop = global.lastCardDrop || now;
    const nextCardDrop = lastCardDrop + cardDropInterval - now;
    globalTimers += `📦 **Card Drop**: ${prettyTime(nextCardDrop)}\n`;

    if (globalTimers) {
        embed.addFields({
            name: '🌐 Global Timers',
            value: globalTimers,
            inline: false
        });
    }

    // Personal timers
    let personalTimers = '';

    // Daily reset
    const dailyReset = user.dailyReset || 0;
    const nextDaily = dailyReset + (24 * 60 * 60 * 1000) - now;
    if (nextDaily > 0) {
        personalTimers += `🎁 **Daily Reset**: ${prettyTime(nextDaily)}\n`;
    } else {
        personalTimers += `🎁 **Daily Reset**: Ready now\n`;
    }

    // Explore cooldown
    if (user.exploreStates?.defeatCooldown && user.exploreStates.defeatCooldown > now) {
        const exploreTime = user.exploreStates.defeatCooldown - now;
        personalTimers += `⚔️ **Explore Cooldown**: ${prettyTime(exploreTime)}\n`;
    }

    // Duel cooldown
    if (user.duelCooldown && user.duelCooldown > now) {
        const duelTime = user.duelCooldown - now;
        personalTimers += `🤺 **Duel Cooldown**: ${prettyTime(duelTime)}\n`;
    }

    // Battle cooldown
    if (user.battleCooldown && user.battleCooldown > now) {
        const battleTime = user.battleCooldown - now;
        personalTimers += `⚔️ **Battle Cooldown**: ${prettyTime(battleTime)}\n`;
    }

    // Quest reset timers
    if (user.questData) {
        const questResets = user.questData.lastReset || {};
        
        // Daily quest reset
        if (questResets.daily) {
            const dailyQuestReset = questResets.daily + (24 * 60 * 60 * 1000) - now;
            if (dailyQuestReset > 0) {
                personalTimers += `📋 **Daily Quests**: ${prettyTime(dailyQuestReset)}\n`;
            }
        }
        
        // Weekly quest reset (every Sunday)
        if (questResets.weekly) {
            const weeklyQuestReset = questResets.weekly + (7 * 24 * 60 * 60 * 1000) - now;
            if (weeklyQuestReset > 0) {
                personalTimers += `📋 **Weekly Quests**: ${prettyTime(weeklyQuestReset)}\n`;
            }
        }
    }

    // Active boosts
    if (user.activeBoosts && user.activeBoosts.length > 0) {
        const activeBoosts = user.activeBoosts.filter(boost => boost.expiresAt > now);
        if (activeBoosts.length > 0) {
            personalTimers += `\n🚀 **Active Boosts**:\n`;
            activeBoosts.forEach(boost => {
                const boostTime = boost.expiresAt - now;
                personalTimers += `• ${boost.type}: ${prettyTime(boostTime)}\n`;
            });
        }
    }

    if (personalTimers) {
        embed.addFields({
            name: '👤 Personal Timers',
            value: personalTimers,
            inline: false
        });
    }

    if (!globalTimers && !personalTimers) {
        embed.setDescription('No active timers found!');
    }

    embed.setFooter({ text: 'Timers update in real-time' });

    await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };
