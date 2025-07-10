const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');

function getCurrentLocation(stage) {
    if (stage < 7) return 'Windmill Village';
    if (stage < 16) return 'Shells Town';
    if (stage < 24) return 'Orange Town';
    if (stage < 29) return 'Syrup Village';
    if (stage < 34) return 'Baratie';
    if (stage < 43) return 'Arlong Park';
    if (stage < 51) return 'Reverse Mountain';
    return 'Adventure Complete';
}

function getLocalStage(globalStage) {
    if (globalStage < 7) return globalStage;
    if (globalStage < 16) return globalStage - 7;
    if (globalStage < 24) return globalStage - 16;
    if (globalStage < 29) return globalStage - 24;
    if (globalStage < 34) return globalStage - 29;
    if (globalStage < 43) return globalStage - 34;
    if (globalStage < 51) return globalStage - 43;
    return 0;
}

function getTotalStagesInLocation(location) {
    const stageCounts = {
        'Windmill Village': 7,
        'Shells Town': 9,
        'Orange Town': 8,
        'Syrup Village': 5,
        'Baratie': 5,
        'Arlong Park': 9,
        'Reverse Mountain': 8
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
    const totalPossibleStages = 51;
    const overallProgress = Math.min(Math.floor((currentStage / totalPossibleStages) * 100), 100);
    const overallBar = createModernProgressBar(currentStage, totalPossibleStages, 15);

    // Saga grouping
    const locations = [
        { name: 'Windmill Village', stages: 7, unlocked: currentStage >= 0, startStage: 0, saga: 'East Blue' },
        { name: 'Shells Town', stages: 9, unlocked: currentStage >= 7, startStage: 7, saga: 'East Blue' },
        { name: 'Orange Town', stages: 8, unlocked: currentStage >= 16, startStage: 16, saga: 'East Blue' },
        { name: 'Syrup Village', stages: 5, unlocked: currentStage >= 24, startStage: 24, saga: 'East Blue' },
        { name: 'Baratie', stages: 5, unlocked: currentStage >= 29, startStage: 29, saga: 'East Blue' },
        { name: 'Arlong Park', stages: 9, unlocked: currentStage >= 34, startStage: 34, saga: 'East Blue' },
        { name: 'Reverse Mountain', stages: 8, unlocked: currentStage >= 43, startStage: 43, saga: 'Arabasta' }
    ];
    const sagas = [
        { name: 'East Blue', arcs: locations.filter(l => l.saga === 'East Blue') },
        { name: 'Arabasta', arcs: locations.filter(l => l.saga === 'Arabasta') }
    ];

    // Determine page (saga) from args or default to 0
    let page = 0;
    if (args && args.length > 0 && !isNaN(args[0])) {
        page = Math.max(0, Math.min(sagas.length - 1, parseInt(args[0])));
    }
    const saga = sagas[page];

    let progressText = `__**${saga.name} Saga**__\n`;
    saga.arcs.forEach(location => {
        const locationEnd = location.startStage + location.stages;
        let status = '';
        let progress = 0;
        let statusIcon = '';
        if (!location.unlocked) {
            status = 'Locked';
            statusIcon = '';
        } else if (currentStage >= locationEnd) {
            status = 'Complete';
            statusIcon = '<:check:1390838766821965955>';
            progress = location.stages;
        } else if (currentStage >= location.startStage) {
            status = 'Current';
            statusIcon = '<:arrow:1390838766821965955>';
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

    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('Adventure Progress')
        .setDescription(`**Current Location:** ${currentLocation}\n**Overall Progress:** ${overallBar} ${overallProgress}%`)
        .addFields(
            { name: 'Location Status', value: currentLocation === 'Adventure Complete' ? '<:check:1390838766821965955> Complete!' : `Stage ${localStage}/${totalStages}`, inline: true },
            { name: 'Global Stage', value: `${currentStage}/51`, inline: true },
            { name: 'Progress', value: `${overallProgress}%`, inline: true },
            { name: 'Saga & Arc Progress', value: progressText.trim(), inline: false }
        )
        .setFooter({ text: 'Use /explore to continue your adventure  Progress saves automatically' });

    // Add navigation buttons
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`map_prev_${page}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId(`map_next_${page}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === sagas.length - 1)
    );

    await message.reply({ embeds: [embed], components: [row] }).then(sentMsg => {
        const filter = i => i.user.id === message.author.id && (i.customId.startsWith('map_prev_') || i.customId.startsWith('map_next_'));
        const collector = sentMsg.createMessageComponentCollector({ filter, time: 120000 });

        collector.on('collect', async interaction => {
            await interaction.deferUpdate();
            let newPage = page;
            if (interaction.customId.startsWith('map_prev_')) {
                newPage = Math.max(0, page - 1);
            } else if (interaction.customId.startsWith('map_next_')) {
                newPage = Math.min(sagas.length - 1, page + 1);
            }
            // Rebuild saga and embed for new page
            const saga = sagas[newPage];
            let progressText = `__**${saga.name} Saga**__\n`;
            saga.arcs.forEach(location => {
                const locationEnd = location.startStage + location.stages;
                let status = '';
                let progress = 0;
                let statusIcon = '';
                if (!location.unlocked) {
                    status = 'Locked';
                    statusIcon = '';
                } else if (currentStage >= locationEnd) {
                    status = 'Complete';
                    statusIcon = '<:check:1390838766821965955>';
                    progress = location.stages;
                } else if (currentStage >= location.startStage) {
                    status = 'Current';
                    statusIcon = '<:arrow:1390838766821965955>';
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

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle('Adventure Progress')
                .setDescription(`**Current Location:** ${currentLocation}\n**Overall Progress:** ${overallBar} ${overallProgress}%`)
                .addFields(
                    { name: 'Location Status', value: currentLocation === 'Adventure Complete' ? '<:check:1390838766821965955> Complete!' : `Stage ${localStage}/${totalStages}`, inline: true },
                    { name: 'Global Stage', value: `${currentStage}/51`, inline: true },
                    { name: 'Progress', value: `${overallProgress}%`, inline: true },
                    { name: 'Saga & Arc Progress', value: progressText.trim(), inline: false }
                )
                .setFooter({ text: 'Use /explore to continue your adventure  Progress saves automatically' });

            // Update buttons
            const newRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`map_prev_${newPage}`)
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(newPage === 0),
                new ButtonBuilder()
                    .setCustomId(`map_next_${newPage}`)
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(newPage === sagas.length - 1)
            );

            await interaction.message.edit({ embeds: [embed], components: [newRow] });
        });
    });
}

module.exports = {
    data,
    execute
};
