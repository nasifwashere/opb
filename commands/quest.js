const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { getAvailableQuests, getQuestProgress, claimQuestReward } = require('../utils/questSystem.js');

const data = new SlashCommandBuilder()
    .setName('quest')
    .setDescription('View your available quests and progress');

async function execute(message) {
    const userId = message.author.id;
    let user = await User.findOne({ userId });
    
    if (!user) {
        return message.reply('You need to start your adventure first! Use `op start` to begin.');
    }
    
    try {
        // Get available quests
        const availableQuests = await getAvailableQuests(user);
        
        if (availableQuests.length === 0) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle('📋 Quest Log')
                    .setDescription('No quests available at the moment. Check back later!')
                ]
            });
        }
        
        // Create embed for quest display
        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('📋 Quest Log')
            .setDescription('Here are your available quests:')
            .setFooter({ text: `${availableQuests.length} quest(s) available` });
        
        // Add quest fields
        for (const quest of availableQuests.slice(0, 10)) { // Limit to 10 quests
            const progress = getQuestProgress(user, quest.questId);
            let progressText = '';
            let statusEmoji = '🔄'; // In progress
            let questCompleted = true;
            
            // Build progress text
            for (const requirement of quest.requirements) {
                const currentProgress = progress.progress[requirement.type] || 0;
                progressText += `${requirement.type}: ${currentProgress}/${requirement.target}\n`;
                
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
                name: `${statusEmoji} ${quest.name} (${quest.type})`,
                value: `${quest.description}\n\n**Progress:**\n${progressText}\n**Rewards:** ${rewardsText}`,
                inline: false
            });
        }
        
        if (availableQuests.length > 10) {
            embed.setDescription(`Here are your available quests (showing 10 of ${availableQuests.length}):`);
        }
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error in quest command:', error);
        return message.reply('An error occurred while loading your quests. Please try again later.');
    }
}

module.exports = { data, execute };