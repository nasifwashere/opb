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
        .setColor(0x2C2F33)
        .setDescription('**Active Timers**');

    let timersText = '';

    // Pull reset timer (global for all users)
    if (global.nextPullReset) {
        const pullResetTime = global.nextPullReset.getTime() - now;
        timersText += `**Pull Reset** ${prettyTime(pullResetTime)}\n`;
    }

    // Card drop timer
    if (global.nextCardDrop) {
        const dropTime = global.nextCardDrop.getTime() - now;
        timersText += `**Next Card Drop** ${prettyTime(dropTime)}\n`;
    }

    // Daily reset
    const dailyReset = user.dailyReward?.lastClaimed || 0;
    const nextDaily = dailyReset + (20 * 60 * 60 * 1000) - now; // 20 hours
    if (nextDaily > 0) {
        timersText += `**Daily Reward** ${prettyTime(nextDaily)}\n`;
    } else {
        timersText += `**Daily Reward** Ready now\n`;
    }

    // Quest resets
    if (user.questData?.lastReset) {
        // Daily quest reset (every 24 hours)
        const lastDailyReset = user.questData.lastReset.daily || 0;
        const nextDailyQuestReset = lastDailyReset + (24 * 60 * 60 * 1000) - now;
        if (nextDailyQuestReset > 0) {
            timersText += `**Daily Quests** ${prettyTime(nextDailyQuestReset)}\n`;
        }

        // Weekly quest reset (every 7 days)
        const lastWeeklyReset = user.questData.lastReset.weekly || 0;
        const nextWeeklyQuestReset = lastWeeklyReset + (7 * 24 * 60 * 60 * 1000) - now;
        if (nextWeeklyQuestReset > 0) {
            timersText += `**Weekly Quests** ${prettyTime(nextWeeklyQuestReset)}\n`;
        }
    }

    // Battle defeat cooldown only
    if (user.exploreStates?.defeatCooldown && user.exploreStates.defeatCooldown > now) {
        const exploreTime = user.exploreStates.defeatCooldown - now;
        timersText += `**Battle Defeat** ${prettyTime(exploreTime)}\n`;
    }

    // Duel cooldown
    if (user.duelCooldown && user.duelCooldown > now) {
        const duelTime = user.duelCooldown - now;
        timersText += `**Duel Cooldown** ${prettyTime(duelTime)}\n`;
    }

    // Active boosts
    if (user.activeBoosts && user.activeBoosts.length > 0) {
        const activeBoosts = user.activeBoosts.filter(boost => boost.expiresAt > now);
        if (activeBoosts.length > 0) {
            timersText += `\n**Active Boosts**\n`;
            activeBoosts.forEach(boost => {
                const boostTime = boost.expiresAt - now;
                timersText += `${boost.type} ${prettyTime(boostTime)}\n`;
            });
        }
    }

    if (timersText) {
        embed.addFields({
            name: ' ',
            value: timersText,
            inline: false
        });
    }

    if (!timersText) {
        embed.setDescription('No active timers found!');
    }

    embed.setFooter({ text: 'Timers update automatically' });

    await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };