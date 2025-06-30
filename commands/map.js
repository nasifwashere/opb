const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

function getCurrentLocation(stage) {
    if (stage < 7) return 'WINDMILL VILLAGE';
    if (stage < 16) return 'SHELLS TOWN';
    if (stage < 24) return 'ORANGE TOWN';
    if (stage < 29) return 'SYRUP VILLAGE';
    if (stage < 34) return 'BARATIE';
    if (stage < 43) return 'ARLONG PARK';
    return 'COMPLETED';
}

function getLocalStage(globalStage) {
    if (globalStage < 7) return globalStage;
    if (globalStage < 16) return globalStage - 7;
    if (globalStage < 24) return globalStage - 16;
    if (globalStage < 29) return globalStage - 24;
    if (globalStage < 34) return globalStage - 29;
    if (globalStage < 43) return globalStage - 34;
    return 0;
}

function getTotalStagesInLocation(location) {
    const stageCounts = {
        'WINDMILL VILLAGE': 7,
        'SHELLS TOWN': 9,
        'ORANGE TOWN': 8,
        'SYRUP VILLAGE': 5,
        'BARATIE': 5,
        'ARLONG PARK': 9
    };
    return stageCounts[location] || 0;
}

const data = new SlashCommandBuilder()
    .setName('map')
    .setDescription('View your adventure progress and current location');

async function execute(message, args) {
    const userId = message.author.id;
    let user = await User.findOne({ userId });

    if (!user) {
        return message.reply('Start your journey with `op start` first!');
    }

    const currentStage = user.stage || 0;
    const currentLocation = getCurrentLocation(currentStage);
    const localStage = getLocalStage(currentStage);
    const totalStages = getTotalStagesInLocation(currentLocation);

    // Calculate overall progress
    const totalPossibleStages = 7 + 9 + 8 + 5 + 5 + 9; // 43 total stages
    const overallProgress = Math.floor((currentStage / totalPossibleStages) * 100);

    const embed = new EmbedBuilder()
        .setColor(0x2C2F33)
        .setDescription([
            `**${user.username || message.author.username}'s Adventure Map**`,
            '',
            `📍 **Current Location:** ${currentLocation}`,
            currentLocation !== 'COMPLETED' ? `🗺️ **Progress:** ${localStage}/${totalStages} stages` : '🎉 **East Blue Saga Complete!**'
        ].join('\n'));

    // Location progress bars
    const locations = [
        { name: 'WINDMILL VILLAGE', stages: 7, unlocked: currentStage >= 0 },
        { name: 'SHELLS TOWN', stages: 9, unlocked: currentStage >= 7 },
        { name: 'ORANGE TOWN', stages: 8, unlocked: currentStage >= 16 },
        { name: 'SYRUP VILLAGE', stages: 5, unlocked: currentStage >= 24 },
        { name: 'BARATIE', stages: 5, unlocked: currentStage >= 29 },
        { name: 'ARLONG PARK', stages: 9, unlocked: currentStage >= 34 }
    ];

    let progressText = '';
    let cumulativeStages = 0;

    locations.forEach(location => {
        const locationStart = cumulativeStages;
        const locationEnd = cumulativeStages + location.stages;
        cumulativeStages = locationEnd;

        let status = '';
        let progress = 0;

        if (!location.unlocked) {
            status = '🔒 *Locked*';
        } else if (currentStage >= locationEnd) {
            status = '✅ *Complete*';
            progress = location.stages;
        } else if (currentStage >= locationStart) {
            status = '🔍 *Current*';
            progress = currentStage - locationStart;
        } else {
            status = '⏳ *Upcoming*';
        }

        const progressBar = createProgressBar(progress, location.stages);
        progressText += `**${location.name}**\n${progressBar} ${progress}/${location.stages} ${status}\n\n`;
    });

    embed.addFields({
        name: '🗺️ East Blue Saga Progress',
        value: progressText,
        inline: false
    });

    // Add quest information if available
    if (user.questData && user.questData.activeQuests) {
        const activeQuests = Object.values(user.questData.activeQuests).filter(q => !q.completed);
        if (activeQuests.length > 0) {
            const questText = activeQuests.slice(0, 3).map(quest => 
                `• ${quest.name} (${quest.progress}/${quest.target})`
            ).join('\n');

            embed.addFields({
                name: '📜 Active Quests',
                value: questText,
                inline: false
            });
        }
    }

    // Add stats
    const stats = [
        `**Level:** ${user.level || 1}`,
        `**XP:** ${user.xp || 0}`,
        `**Beli:** ${user.beli || 0}`,
        `**Cards:** ${user.cards ? user.cards.length : 0}`
    ].join(' • ');

    embed.addFields({
        name: '📊 Adventure Stats',
        value: stats,
        inline: false
    });

    embed.setFooter({ 
        text: `Overall Progress: ${overallProgress}% • Use "op explore" to continue` 
    });

    await message.reply({ embeds: [embed] });
}

function createProgressBar(current, max) {
    const percentage = Math.min(current / max, 1);
    const barLength = 10;
    const filledBars = Math.floor(percentage * barLength);
    const emptyBars = barLength - filledBars;

    return '█'.repeat(filledBars) + '░'.repeat(emptyBars);
}

module.exports = { data, execute };