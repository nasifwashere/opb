const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle  } = require('discord.js');
const User = require('../db/models/User.js');

// Quest definitions
const QUESTS = {
    daily: [
        {
            id: 'daily_explore',
            name: 'Explorer',
            description: 'Complete 3 exploration stages',
            requirement: { type: 'explore', count: 3 },
            reward: { type: 'beli', amount: 500 },
            resetType: 'daily'
        },
        {
            id: 'daily_battle',
            name: 'Warrior',
            description: 'Win 5 battles',
            requirement: { type: 'battle_wins', count: 5 },
            reward: { type: 'xp', amount: 200 },
            resetType: 'daily'
        },
        {
            id: 'daily_market',
            name: 'Trader',
            description: 'Buy 2 items from the market',
            requirement: { type: 'market_buy', count: 2 },
            reward: { type: 'item', name: 'Lucky Charm' },
            resetType: 'daily'
        }
    ],
    weekly: [
        {
            id: 'weekly_boss',
            name: 'Boss Hunter',
            description: 'Defeat 3 boss enemies',
            requirement: { type: 'boss_defeats', count: 3 },
            reward: { type: 'multiple', rewards: [
                { type: 'beli', amount: 2000 },
                { type: 'xp', amount: 1000 }
            ]},
            resetType: 'weekly'
        },
        {
            id: 'weekly_collector',
            name: 'Card Collector',
            description: 'Obtain 5 new cards',
            requirement: { type: 'cards_obtained', count: 5 },
            reward: { type: 'card', name: 'Mystery Card', rank: 'B' },
            resetType: 'weekly'
        }
    ],
    story: [
        {
            id: 'story_east_blue',
            name: 'East Blue Saga',
            description: 'Complete the East Blue storyline',
            requirement: { type: 'stage_completion', stage: 38 },
            reward: { type: 'multiple', rewards: [
                { type: 'beli', amount: 5000 },
                { type: 'xp', amount: 2000 },
                { type: 'card', name: 'Straw Hat Luffy', rank: 'A' }
            ]},
            resetType: 'never'
        }
    ]
};

// Initialize user quest data
function initializeUserQuests(user) {
    if (!user.questData) {
        user.questData = {
            progress: {},
            completed: [],
            lastReset: {
                daily: 0,
                weekly: 0
            }
        };
    }
    return user.questData;
}

// Check if quests need to be reset
function checkQuestResets(questData) {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    
    // Reset daily quests
    if (now - questData.lastReset.daily > oneDay) {
        questData.lastReset.daily = now;
        // Reset daily quest progress
        Object.keys(questData.progress).forEach(questId => {
            if (questId.startsWith('daily_')) {
                delete questData.progress[questId];
            }
        });
        // Remove daily quests from completed list
        questData.completed = questData.completed.filter(id => !id.startsWith('daily_'));
    }
    
    // Reset weekly quests
    if (now - questData.lastReset.weekly > oneWeek) {
        questData.lastReset.weekly = now;
        // Reset weekly quest progress
        Object.keys(questData.progress).forEach(questId => {
            if (questId.startsWith('weekly_')) {
                delete questData.progress[questId];
            }
        });
        // Remove weekly quests from completed list
        questData.completed = questData.completed.filter(id => !id.startsWith('weekly_'));
    }
}

// Update quest progress
function updateQuestProgress(user, type, amount = 1) {
    const questData = initializeUserQuests(user);
    checkQuestResets(questData);
    
    // Find all quests that match the progress type
    const allQuests = [...QUESTS.daily, ...QUESTS.weekly, ...QUESTS.story];
    
    for (const quest of allQuests) {
        if (quest.requirement.type === type && !questData.completed.includes(quest.id)) {
            if (!questData.progress[quest.id]) {
                questData.progress[quest.id] = 0;
            }
            
            questData.progress[quest.id] = Math.min(
                questData.progress[quest.id] + amount,
                quest.requirement.count || quest.requirement.stage
            );
        }
    }
}

// Check for completed quests
function checkCompletedQuests(user) {
    const questData = initializeUserQuests(user);
    const completedQuests = [];
    
    const allQuests = [...QUESTS.daily, ...QUESTS.weekly, ...QUESTS.story];
    
    for (const quest of allQuests) {
        if (!questData.completed.includes(quest.id)) {
            const progress = questData.progress[quest.id] || 0;
            const required = quest.requirement.count || quest.requirement.stage;
            
            if (progress >= required) {
                questData.completed.push(quest.id);
                completedQuests.push(quest);
            }
        }
    }
    
    return completedQuests;
}

// Apply quest reward
async function applyQuestReward(user, reward) {
    if (reward.type === 'beli') {
        user.beli = (user.beli || 0) + reward.amount;
    } else if (reward.type === 'xp') {
        user.xp = (user.xp || 0) + reward.amount;
    } else if (reward.type === 'item') {
        if (!user.inventory) user.inventory = [];
        user.inventory.push(reward.name.toLowerCase().replace(/\s+/g, ''));
    } else if (reward.type === 'card') {
        if (!user.cards) user.cards = [];
        user.cards.push({
            name: reward.name,
            rank: reward.rank,
            level: 1,
            timesUpgraded: 0
        });
    } else if (reward.type === 'multiple') {
        for (const subReward of reward.rewards) {
            await applyQuestReward(user, subReward);
        }
    }
}

// Format reward text
function formatRewardText(reward) {
    if (reward.type === 'beli') {
        return `${reward.amount} Beli`;
    } else if (reward.type === 'xp') {
        return `${reward.amount} XP`;
    } else if (reward.type === 'item') {
        return `${reward.name}`;
    } else if (reward.type === 'card') {
        return `[${reward.rank}] ${reward.name}`;
    } else if (reward.type === 'multiple') {
        return reward.rewards.map(r => formatRewardText(r)).join(', ');
    }
    return 'Unknown reward';
}

// Create quest embed
function createQuestEmbed(questType, quests, user) {
    const questData = initializeUserQuests(user);
    checkQuestResets(questData);
    
    const embed = new EmbedBuilder()
        .setTitle(`📋 ${questType.charAt(0).toUpperCase() + questType.slice(1)} Quests`)
        .setColor(questType === 'daily' ? 0x3498db : questType === 'weekly' ? 0x9b59b6 : 0xe74c3c);
    
    if (quests.length === 0) {
        embed.setDescription('No quests available in this category.');
        return embed;
    }
    
    let description = '';
    
    for (const quest of quests) {
        const progress = questData.progress[quest.id] || 0;
        const required = quest.requirement.count || quest.requirement.stage;
        const isCompleted = questData.completed.includes(quest.id);
        
        const status = isCompleted ? '[DONE]' : progress >= required ? '[READY]' : '[ACTIVE]';
        const progressText = isCompleted ? 'Completed' : `${progress}/${required}`;
        
        description += `${status} **${quest.name}**\n`;
        description += `   ${quest.description}\n`;
        description += `   Progress: ${progressText}\n`;
        description += `   Reward: ${formatRewardText(quest.reward)}\n\n`;
    }
    
    embed.setDescription(description);
    return embed;
}

// Create quest buttons
function createQuestButtons(currentType) {
    const buttons = [
        new ButtonBuilder()
            .setCustomId('quest_daily')
            .setLabel('Daily')
            .setStyle(currentType === 'daily' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('quest_weekly')
            .setLabel('Weekly')
            .setStyle(currentType === 'weekly' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('quest_story')
            .setLabel('Story')
            .setStyle(currentType === 'story' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('quest_claim')
            .setLabel('Claim All')
            .setStyle(ButtonStyle.Success)
    ];
    
    return [new ActionRowBuilder().addComponents(buttons)];
}

const data = new SlashCommandBuilder()
  .setName('quest')
  .setDescription('View and manage your quests.');

async function execute(message, args, client) {
    const userId = message.author.id;
    const username = message.author.username;
    let user = await User.findOne({ userId });
    
    if (!user) {
        return message.reply('Start your journey with `op start` first!');
    }

    // Ensure username is set if missing
    if (!user.username) {
        user.username = username;
        await user.save();
    }
    
    // Check for completed quests and auto-notify
    const completedQuests = checkCompletedQuests(user);
    if (completedQuests.length > 0) {
        let notificationText = '**Quests Completed!**\n\n';
        for (const quest of completedQuests) {
            notificationText += `[DONE] ${quest.name} - ${formatRewardText(quest.reward)}\n`;
        }
        notificationText += '\nUse the "Claim All" button to collect your rewards!';
        
        // Send notification as a separate message
        await message.channel.send(notificationText);
    }
    
    let currentType = 'daily';
    
    // Check if user specified a quest type
    if (args[0] && ['daily', 'weekly', 'story'].includes(args[0].toLowerCase())) {
        currentType = args[0].toLowerCase();
    }
    
    const embed = createQuestEmbed(currentType, QUESTS[currentType], user);
    const components = createQuestButtons(currentType);
    
    const questMessage = await message.reply({ embeds: [embed], components });
    
    // Button interaction collector
    const filter = i => i.user.id === userId;
    const collector = questMessage.createMessageComponentCollector({ filter, time: 300000 });
    
    collector.on('collect', async interaction => {
        await interaction.deferUpdate();
        
        if (interaction.customId.startsWith('quest_')) {
            const action = interaction.customId.split('_')[1];
            
            if (['daily', 'weekly', 'story'].includes(action)) {
                currentType = action;
                
                const newEmbed = createQuestEmbed(currentType, QUESTS[currentType], user);
                const newComponents = createQuestButtons(currentType);
                
                await questMessage.edit({ embeds: [newEmbed], components: newComponents });
            } else if (action === 'claim') {
                // Claim all completed quests
                const questData = initializeUserQuests(user);
                const allQuests = [...QUESTS.daily, ...QUESTS.weekly, ...QUESTS.story];
                
                let claimedRewards = [];
                
                for (const quest of allQuests) {
                    const progress = questData.progress[quest.id] || 0;
                    const required = quest.requirement.count || quest.requirement.stage;
                    
                    if (progress >= required && !questData.completed.includes(quest.id)) {
                        questData.completed.push(quest.id);
                        await applyQuestReward(user, quest.reward);
                        claimedRewards.push(quest);
                    }
                }
                
                if (claimedRewards.length > 0) {
                    let claimText = '**Rewards Claimed!**\n\n';
                    for (const quest of claimedRewards) {
                        claimText += `[CLAIMED] ${quest.name}: ${formatRewardText(quest.reward)}\n`;
                    }
                    
                    await user.save();
                    await interaction.followUp({ content: claimText, ephemeral: true });
                    
                    // Refresh the quest display
                    const newEmbed = createQuestEmbed(currentType, QUESTS[currentType], user);
                    const newComponents = createQuestButtons(currentType);
                    await questMessage.edit({ embeds: [newEmbed], components: newComponents });
                } else {
                    await interaction.followUp({ content: 'No completed quests to claim!', ephemeral: true });
                }
            }
        }
    });
    
    collector.on('end', () => {
        questMessage.edit({ components: [] }).catch(() => {});
    });
}

// Export functions for use in other commands
module.exports = { 
    data, 
    execute, 
    updateQuestProgress, 
    checkCompletedQuests,
    initializeUserQuests 
};
