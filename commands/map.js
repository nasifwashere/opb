const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

function getCurrentLocation(stage) {
    if (stage < 7) return 'Windmill Village';
    if (stage < 16) return 'Shells Town';
    if (stage < 24) return 'Orange Town';
    if (stage < 29) return 'Syrup Village';
    if (stage < 34) return 'Baratie';
    if (stage < 43) return 'Arlong Park';
    return 'East Blue Complete';
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
        'Windmill Village': 7,
        'Shells Town': 9,
        'Orange Town': 8,
        'Syrup Village': 5,
        'Baratie': 5,
        'Arlong Park': 9
    };
    return stageCounts[location] || 0;
}

// Modern progress bar without colors
function createModernProgressBar(current, max, width = 12) {
    const percentage = Math.min(current / max, 1);
    const filled = Math.floor(percentage * width);
    const empty = width - filled;
    
    let bar = '';
    if (filled > 0) {
        bar += '▰'.repeat(filled);
    }
    if (empty > 0) {
        bar += '▱'.repeat(empty);
    }
    
    return bar;
}

const data = new SlashCommandBuilder()
    .setName('map')
    .setDescription('View your adventure progress and current location');

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

    const currentStage = user.stage || 0;
    const currentLocation = getCurrentLocation(currentStage);
    const localStage = getLocalStage(currentStage);
    const totalStages = getTotalStagesInLocation(currentLocation);

    // Calculate overall progress
    const totalPossibleStages = 43; // 7 + 9 + 8 + 5 + 5 + 9
    const overallProgress = Math.min(Math.floor((currentStage / totalPossibleStages) * 100), 100);
    const overallBar = createModernProgressBar(currentStage, totalPossibleStages, 15);

    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('Adventure Progress')
        .setDescription(`**Current Location:** ${currentLocation}\n**Overall Progress:** ${overallBar} ${overallProgress}%`)
        .addFields(
            { name: 'Location Status', value: currentLocation === 'East Blue Complete' ? '<:check:1390838766821965955> Complete!' : `Stage ${localStage}/${totalStages}`, inline: true },
            { name: 'Global Stage', value: `${currentStage}/43`, inline: true },
            { name: 'Progress', value: `${overallProgress}%`, inline: true }
        );

    // Location progress with modern styling
    const locations = [
        { name: 'Windmill Village', stages: 7, unlocked: currentStage >= 0, startStage: 0 },
        { name: 'Shells Town', stages: 9, unlocked: currentStage >= 7, startStage: 7 },
        { name: 'Orange Town', stages: 8, unlocked: currentStage >= 16, startStage: 16 },
        { name: 'Syrup Village', stages: 5, unlocked: currentStage >= 24, startStage: 24 },
        { name: 'Baratie', stages: 5, unlocked: currentStage >= 29, startStage: 29 },
        { name: 'Arlong Park', stages: 9, unlocked: currentStage >= 34, startStage: 34 }
    ];

    let progressText = '';

    locations.forEach(location => {
        const locationEnd = location.startStage + location.stages;
        
        let status = '';
        let progress = 0;
        let statusIcon = '';

        if (!location.unlocked) {
            status = 'Locked';
            statusIcon = '';
        } else if (currentStage >= locationEnd) {
            status = 'Complete';
            statusIcon = '';
            progress = location.stages;
        } else if (currentStage >= location.startStage) {
            status = 'Current';
            statusIcon = '';
            progress = currentStage - location.startStage;
        } else {
            status = 'Upcoming';
            statusIcon = '';
        }

        const progressBar = createModernProgressBar(progress, location.stages, 8);
        const percentage = Math.round((progress / location.stages) * 100);
        
        progressText += `${statusIcon} **${location.name}**\n`;
        progressText += `${progressBar} ${progress}/${location.stages} (${percentage}%)\n\n`;
    });

    embed.addFields({
        name: 'East Blue Saga Locations',
        value: progressText.trim(),
        inline: false
    });

    embed.setFooter({ 
        text: 'Use /explore to continue your adventure • Progress saves automatically' 
    });

    await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };
