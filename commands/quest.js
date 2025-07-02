const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { getAvailableQuests, getQuestProgress, claimQuestReward } = require('../utils/questSystem.js');

const data = new SlashCommandBuilder()
    .setName('quest')
    .setDescription('View and manage your quests');

async function execute(interaction) {
    const userId = interaction.author ? interaction.author.id : interaction.user.id;
    let user;
    
    try {
        user = await User.findOne({ userId });
        
        if (!user) {
            return interaction.reply('You need to start your adventure first! Use `op start` to begin.');
        }
        
        // Create main quest menu
        await showQuestMenu(interaction, user, userId);
        
    } catch (error) {
        console.error('Error in quest command:', error);
        return interaction.reply('An error occurred while loading your quests. Please try again later.');
    }
}

// Helper function to build main quest menu content
async function buildQuestMenuContent(user) {
    const availableQuests = await getAvailableQuests(user);
    
    // Categorize quests
    const dailyQuests = availableQuests.filter(q => q.type === 'daily');
    const weeklyQuests = availableQuests.filter(q => q.type === 'weekly');
    const storyQuests = availableQuests.filter(q => q.type === 'story');
    
    // Count completed quests ready to claim
    let claimableCount = 0;
    for (const quest of availableQuests) {
        const progress = getQuestProgress(user, quest.questId);
        if (progress.started) {
            let questCompleted = true;
            for (const requirement of quest.requirements) {
                const currentProgress = progress.progress[requirement.type] || 0;
                if (currentProgress < requirement.target) {
                    questCompleted = false;
                    break;
                }
            }
            if (questCompleted) claimableCount++;
        }
    }
    
    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('Quests')
        .setDescription(`**Daily:** ${dailyQuests.length} • **Weekly:** ${weeklyQuests.length} • **Story:** ${storyQuests.length}${claimableCount > 0 ? ` • **Ready to claim:** ${claimableCount}` : ''}`);
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('quest_daily')
                .setLabel('Daily')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('quest_weekly')
                .setLabel('Weekly')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('quest_story')
                .setLabel('Story')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('quest_claim_all')
                .setLabel('Claim All')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(claimableCount === 0)
        );
    
    return { embed, row };
}

// Helper function to update back to main quest menu
async function updateToQuestMenu(interaction, user) {
    try {
        const { embed, row } = await buildQuestMenuContent(user);
        await interaction.update({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('Error updating to quest menu:', error);
        await interaction.update({
            embeds: [new EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle('Error')
                .setDescription('An error occurred while loading quests. Please try again.')
            ],
            components: []
        });
    }
}

async function showQuestMenu(interaction, user, userId = null) {
    // Extract userId if not provided
    if (!userId) {
        userId = interaction.author ? interaction.author.id : interaction.user.id;
    }
    try {
        const { embed, row } = await buildQuestMenuContent(user);
    
    const response = await interaction.reply({ embeds: [embed], components: [row] });
    
    // Set up button collector
    const collector = response.createMessageComponentCollector({ time: 300000 }); // 5 minutes
    
    collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.user.id !== userId) {
            return buttonInteraction.reply({ content: 'This quest menu is not for you!', ephemeral: true });
        }
        
        try {
            if (buttonInteraction.customId === 'quest_daily') {
                await showQuestsByType(buttonInteraction, user, 'daily');
            } else if (buttonInteraction.customId === 'quest_weekly') {
                await showQuestsByType(buttonInteraction, user, 'weekly');
            } else if (buttonInteraction.customId === 'quest_story') {
                await showQuestsByType(buttonInteraction, user, 'story');
            } else if (buttonInteraction.customId === 'quest_claim_all') {
                await claimAllQuests(buttonInteraction, user);
            }
        } catch (error) {
            console.error('Error handling quest button:', error);
            await buttonInteraction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
        }
    });
    
    collector.on('end', () => {
        // Disable buttons when collector expires
        const disabledRow = new ActionRowBuilder()
            .addComponents(
                row.components.map(button => ButtonBuilder.from(button).setDisabled(true))
            );
        interaction.editReply({ components: [disabledRow] }).catch(() => {});
    });
    } catch (error) {
        console.error('Error in showQuestMenu:', error);
        const errorEmbed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle('Error')
            .setDescription('An error occurred while loading quests. Please try again.');
        
        if (interaction.replied || interaction.deferred) {
            return interaction.editReply({ embeds: [errorEmbed], components: [] });
        } else {
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

async function showQuestsByType(interaction, user, questType) {
    const availableQuests = await getAvailableQuests(user);
    const filteredQuests = availableQuests.filter(q => q.type === questType);
    
    if (filteredQuests.length === 0) {
        await interaction.update({
            embeds: [new EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle(`${questType.charAt(0).toUpperCase() + questType.slice(1)} Quests`)
                .setDescription(`No ${questType} quests available.`)
            ],
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('quest_back')
                    .setLabel('Back')
                    .setStyle(ButtonStyle.Secondary)
            )]
        });
        
        // Handle back button for empty quest screen
        const collector = interaction.message.createMessageComponentCollector({ time: 300000 });
        
        collector.on('collect', async (buttonInteraction) => {
            if (buttonInteraction.customId === 'quest_back') {
                await updateToQuestMenu(buttonInteraction, user);
            }
        });
        
        return;
    }
    
    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle(`${questType.charAt(0).toUpperCase() + questType.slice(1)} Quests`)
        .setDescription(filteredQuests.length > 6 ? `Showing 6 of ${filteredQuests.length} quests` : `${filteredQuests.length} quest${filteredQuests.length !== 1 ? 's' : ''}`);
    
    // Add quest fields (limit to 6 to prevent embed overflow)
    for (const quest of filteredQuests.slice(0, 6)) {
        const progress = getQuestProgress(user, quest.questId);
        let progressText = '';
        let statusEmoji = '🔄'; // In progress
        let questCompleted = true;
        
        // Build progress text - simplified format
        let progressParts = [];
        for (const requirement of quest.requirements) {
            const currentProgress = progress.progress[requirement.type] || 0;
            progressParts.push(`${currentProgress}/${requirement.target} ${formatRequirementType(requirement.type).toLowerCase()}`);
            
            if (currentProgress < requirement.target) {
                questCompleted = false;
            }
        }
        progressText = progressParts.join(' • ');
        
        if (questCompleted && progress.started) {
            statusEmoji = '✅';
        } else if (!progress.started) {
            statusEmoji = '○';
        } else {
            statusEmoji = '◐';
        }
        
        // Build rewards text - simplified
        let rewardParts = [];
        for (const reward of quest.rewards) {
            switch (reward.type) {
                case 'beli':
                    rewardParts.push(`${reward.amount} beli`);
                    break;
                case 'xp':
                    rewardParts.push(`${reward.amount} XP`);
                    break;
                case 'item':
                    rewardParts.push(reward.itemName);
                    break;
                case 'card':
                    rewardParts.push(`${reward.itemName} (${reward.rank})`);
                    break;
            }
        }
        let rewardsText = rewardParts.join(' • ');
        
        // Create clean field value
        let fieldValue = `${progressText}\n${rewardsText}`;
        
        // Truncate if too long
        if (fieldValue.length > 1024) {
            const maxLength = 1000;
            fieldValue = fieldValue.substring(0, maxLength) + "...";
        }
        
        // Create clean field name
        let fieldName = `${statusEmoji} ${quest.name}`;
        if (fieldName.length > 256) {
            fieldName = `${statusEmoji} ${quest.name.substring(0, 250)}...`;
        }
        
        embed.addFields({
            name: fieldName,
            value: fieldValue,
            inline: false
        });
    }
    
    // Add back button
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('quest_back')
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.update({ embeds: [embed], components: [row] });
    
    // Handle back button
    const collector = interaction.message.createMessageComponentCollector({ time: 300000 });
    
    collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.customId === 'quest_back') {
            await updateToQuestMenu(buttonInteraction, user);
        }
    });
}

async function claimAllQuests(interaction, user) {
    const availableQuests = await getAvailableQuests(user);
    let claimedQuests = [];
    let totalRewards = { beli: 0, xp: 0, items: [], cards: [] };
    
    for (const quest of availableQuests) {
        const progress = getQuestProgress(user, quest.questId);
        if (progress.started) {
            let questCompleted = true;
            for (const requirement of quest.requirements) {
                const currentProgress = progress.progress[requirement.type] || 0;
                if (currentProgress < requirement.target) {
                    questCompleted = false;
                    break;
                }
            }
            
            if (questCompleted) {
                const result = await claimQuestReward(user, quest.questId);
                if (result.success) {
                    claimedQuests.push(quest.name);
                    
                    // Accumulate rewards
                    for (const reward of quest.rewards) {
                        switch (reward.type) {
                            case 'beli':
                                totalRewards.beli += reward.amount;
                                break;
                            case 'xp':
                                totalRewards.xp += reward.amount;
                                break;
                            case 'item':
                                totalRewards.items.push(reward.itemName);
                                break;
                            case 'card':
                                totalRewards.cards.push(`${reward.itemName} (${reward.rank})`);
                                break;
                        }
                    }
                }
            }
        }
    }
    
    if (claimedQuests.length === 0) {
        await interaction.update({
            embeds: [new EmbedBuilder()
                .setColor(0x2b2d31)
                .setTitle('Claim Rewards')
                .setDescription('No completed quests available to claim.')
            ],
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('quest_back')
                    .setLabel('Back')
                    .setStyle(ButtonStyle.Secondary)
            )]
        });
        
        // Handle back button for empty claim screen
        const collector = interaction.message.createMessageComponentCollector({ time: 300000 });
        
        collector.on('collect', async (buttonInteraction) => {
            if (buttonInteraction.customId === 'quest_back') {
                await updateToQuestMenu(buttonInteraction, user);
            }
        });
        
        return;
    }
    
    // Build rewards summary
    let rewardParts = [];
    if (totalRewards.beli > 0) rewardParts.push(`${totalRewards.beli} beli`);
    if (totalRewards.xp > 0) rewardParts.push(`${totalRewards.xp} XP`);
    if (totalRewards.items.length > 0) rewardParts.push(`${totalRewards.items.length} item${totalRewards.items.length !== 1 ? 's' : ''}`);
    if (totalRewards.cards.length > 0) rewardParts.push(`${totalRewards.cards.length} card${totalRewards.cards.length !== 1 ? 's' : ''}`);
    
    const rewardsSummary = rewardParts.length > 0 ? rewardParts.join(' • ') : 'No rewards';
    
    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('Rewards Claimed')
        .setDescription(`Claimed ${claimedQuests.length} quest${claimedQuests.length !== 1 ? 's' : ''} • ${rewardsSummary}`);
    
    // Add back button
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('quest_back')
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.update({ embeds: [embed], components: [row] });
    
    // Handle back button
    const collector = interaction.message.createMessageComponentCollector({ time: 300000 });
    
    collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.customId === 'quest_back') {
            // Refresh user data and update to menu
            const refreshedUser = await User.findOne({ userId: user.userId });
            await updateToQuestMenu(buttonInteraction, refreshedUser);
        }
    });
}



function formatRequirementType(type) {
    const typeMap = {
        'pull': 'Pulls',
        'battle_win': 'Battle Wins',
        'explore': 'Explorations',
        'level_up': 'Level Ups',
        'team_change': 'Team Changes',
        'team_full': 'Full Team',
        'evolve': 'Evolutions',
        'market_transaction': 'Market Trades',
        'saga_complete': 'Saga Complete'
    };
    
    return typeMap[type] || type;
}

module.exports = { data, execute };