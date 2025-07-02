const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { getAvailableQuests, getQuestProgress, claimQuestReward } = require('../utils/questSystem.js');

const data = new SlashCommandBuilder()
    .setName('quest')
    .setDescription('View and manage your quests');

async function execute(interaction) {
    const userId = interaction.author ? interaction.author.id : interaction.user.id;
    let user = await User.findOne({ userId });
    
    if (!user) {
        return interaction.reply('You need to start your adventure first! Use `op start` to begin.');
    }
    
    try {
        // Create main quest menu
        await showQuestMenu(interaction, user);
        
    } catch (error) {
        console.error('Error in quest command:', error);
        return interaction.reply('An error occurred while loading your quests. Please try again later.');
    }
}

async function showQuestMenu(interaction, user) {
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
        .setColor(0x3498db)
        .setTitle('📋 Quest Management')
        .setDescription('Choose a quest category to view your available quests.')
        .addFields(
            { name: '📅 Daily Quests', value: `${dailyQuests.length} available`, inline: true },
            { name: '📆 Weekly Quests', value: `${weeklyQuests.length} available`, inline: true },
            { name: '📖 Story Quests', value: `${storyQuests.length} available`, inline: true },
            { name: '✅ Ready to Claim', value: `${claimableCount} quest(s)`, inline: false }
        )
        .setFooter({ text: 'Select a category to view quests' })
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('quest_daily')
                .setLabel(`Daily (${dailyQuests.length})`)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📅'),
            new ButtonBuilder()
                .setCustomId('quest_weekly')
                .setLabel(`Weekly (${weeklyQuests.length})`)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('�'),
            new ButtonBuilder()
                .setCustomId('quest_story')
                .setLabel(`Story (${storyQuests.length})`)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📖'),
            new ButtonBuilder()
                .setCustomId('quest_claim_all')
                .setLabel(`Claim All (${claimableCount})`)
                .setStyle(claimableCount > 0 ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setEmoji('🎁')
                .setDisabled(claimableCount === 0)
        );
    
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
}

async function showQuestsByType(interaction, user, questType) {
    const availableQuests = await getAvailableQuests(user);
    const filteredQuests = availableQuests.filter(q => q.type === questType);
    
    if (filteredQuests.length === 0) {
        return interaction.update({
            embeds: [new EmbedBuilder()
                .setColor(0x95a5a6)
                .setTitle(`📋 ${questType.charAt(0).toUpperCase() + questType.slice(1)} Quests`)
                .setDescription(`No ${questType} quests available at the moment.`)
            ]
        });
    }
    
    const embed = new EmbedBuilder()
        .setColor(getColorForQuestType(questType))
        .setTitle(`📋 ${questType.charAt(0).toUpperCase() + questType.slice(1)} Quests`)
        .setDescription(`Here are your available ${questType} quests:`)
        .setFooter({ text: `${filteredQuests.length} ${questType} quest(s) available` });
    
    // Add quest fields (limit to 6 to prevent embed overflow)
    for (const quest of filteredQuests.slice(0, 6)) {
        const progress = getQuestProgress(user, quest.questId);
        let progressText = '';
        let statusEmoji = '🔄'; // In progress
        let questCompleted = true;
        
        // Build progress text
        for (const requirement of quest.requirements) {
            const currentProgress = progress.progress[requirement.type] || 0;
            progressText += `${formatRequirementType(requirement.type)}: ${currentProgress}/${requirement.target}\n`;
            
            if (currentProgress < requirement.target) {
                questCompleted = false;
            }
        }
        
        if (questCompleted && progress.started) {
            statusEmoji = '✅'; // Completed
        } else if (!progress.started) {
            statusEmoji = '🆕'; // New
        }
        
        // Build rewards text
        let rewardsText = '';
        for (const reward of quest.rewards) {
            switch (reward.type) {
                case 'beli':
                    rewardsText += `💰 ${reward.amount} Beli `;
                    break;
                case 'xp':
                    rewardsText += `⭐ ${reward.amount} XP `;
                    break;
                case 'item':
                    rewardsText += `🎒 ${reward.itemName} `;
                    break;
                case 'card':
                    rewardsText += `🃏 ${reward.itemName} (${reward.rank}) `;
                    break;
            }
        }
        
        embed.addFields({
            name: `${statusEmoji} ${quest.name}`,
            value: `${quest.description}\n\n**Progress:**\n${progressText}\n**Rewards:** ${rewardsText.trim()}`,
            inline: false
        });
    }
    
    if (filteredQuests.length > 6) {
        embed.setDescription(`Here are your available ${questType} quests (showing 6 of ${filteredQuests.length}):`);
    }
    
    // Add back button
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('quest_back')
                .setLabel('Back to Menu')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️')
        );
    
    await interaction.update({ embeds: [embed], components: [row] });
    
    // Handle back button
    const collector = interaction.message.createMessageComponentCollector({ time: 300000 });
    
    collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.customId === 'quest_back') {
            await showQuestMenu(buttonInteraction, user);
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
        return interaction.update({
            embeds: [new EmbedBuilder()
                .setColor(0x95a5a6)
                .setTitle('🎁 Claim All Quests')
                .setDescription('No completed quests available to claim.')
            ]
        });
    }
    
    // Build rewards summary
    let rewardsSummary = '';
    if (totalRewards.beli > 0) rewardsSummary += `💰 **${totalRewards.beli}** Beli\n`;
    if (totalRewards.xp > 0) rewardsSummary += `⭐ **${totalRewards.xp}** XP\n`;
    if (totalRewards.items.length > 0) rewardsSummary += `🎒 **Items:** ${totalRewards.items.join(', ')}\n`;
    if (totalRewards.cards.length > 0) rewardsSummary += `🃏 **Cards:** ${totalRewards.cards.join(', ')}\n`;
    
    const embed = new EmbedBuilder()
        .setColor(0x27ae60)
        .setTitle('🎉 Quest Rewards Claimed!')
        .setDescription(`Successfully claimed rewards from **${claimedQuests.length}** quest(s)!`)
        .addFields(
            { name: '📋 Completed Quests', value: claimedQuests.join('\n'), inline: false },
            { name: '🎁 Total Rewards', value: rewardsSummary || 'No rewards', inline: false }
        )
        .setTimestamp();
    
    // Add back button
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('quest_back')
                .setLabel('Back to Menu')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⬅️')
        );
    
    await interaction.update({ embeds: [embed], components: [row] });
    
    // Handle back button
    const collector = interaction.message.createMessageComponentCollector({ time: 300000 });
    
    collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.customId === 'quest_back') {
            // Refresh user data and show menu
            const refreshedUser = await User.findOne({ userId: user.userId });
            await showQuestMenu(buttonInteraction, refreshedUser);
        }
    });
}

function getColorForQuestType(type) {
    switch (type) {
        case 'daily': return 0xe74c3c; // Red
        case 'weekly': return 0x9b59b6; // Purple
        case 'story': return 0xf39c12; // Orange
        default: return 0x3498db; // Blue
    }
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