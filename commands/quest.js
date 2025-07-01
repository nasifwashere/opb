const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { getAvailableQuests, claimQuestReward, getQuestProgress } = require('../utils/questSystem.js');

// Helper function to format quest progress display
function formatQuestProgress(quest, userProgress) {
  let progressText = '';
  let allComplete = true;
  
  for (const requirement of quest.requirements) {
    const current = userProgress.progress[requirement.type] || 0;
    const target = requirement.target;
    
    if (current < target) {
      allComplete = false;
    }
    
    progressText += `${requirement.type}: ${Math.min(current, target)}/${target}\n`;
  }
  
  return { progressText, allComplete };
}

// Helper function to format rewards
function formatRewards(rewards) {
  return rewards.map(reward => {
    switch (reward.type) {
      case 'beli':
        return `${reward.amount} Beli`;
      case 'xp':
        return `${reward.amount} XP`;
      case 'item':
        return reward.itemName;
      case 'card':
        return `[${reward.rank || 'C'}] ${reward.itemName}`;
      default:
        return 'Unknown reward';
    }
  }).join(', ');
}

// Helper function to get quest reset period
function getQuestResetPeriod(questType) {
  if (questType === 'daily') {
    return new Date().toDateString();
  } else if (questType === 'weekly') {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek;
    const weekStart = new Date(now.setDate(diff));
    return weekStart.toDateString();
  }
  return '';
}

// Create quest embed for a specific type
function createQuestEmbed(questType, quests, user) {
  const embed = new EmbedBuilder()
    .setTitle(`📋 ${questType.charAt(0).toUpperCase() + questType.slice(1)} Quests`)
    .setColor(questType === 'daily' ? 0x3498db : questType === 'weekly' ? 0x9b59b6 : 0xe74c3c);
  
  if (quests.length === 0) {
    embed.setDescription('No quests available in this category.');
    return embed;
  }
  
  let description = '';
  
  for (const quest of quests) {
    try {
      const userProgress = getQuestProgress(user, quest.questId);
      const { progressText, allComplete } = formatQuestProgress(quest, userProgress);
      
      // Check if already completed
      const completedKey = `${quest.questId}_${getQuestResetPeriod(quest.type)}`;
      const isCompleted = user.completedQuests?.includes(completedKey);
      
      const status = isCompleted ? '[DONE]' : allComplete ? '[READY]' : '[ACTIVE]';
      
      description += `${status} **${quest.name}**\n`;
      description += `${quest.description}\n`;
      description += `Progress:\n${progressText}`;
      description += `Reward: ${formatRewards(quest.rewards)}\n\n`;
    } catch (error) {
      console.error(`Error processing quest ${quest.questId}:`, error);
      description += `[ERROR] **${quest.name}**\nError loading quest data\n\n`;
    }
  }
  
  embed.setDescription(description);
  return embed;
}

// Create quest navigation buttons
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
  
  try {
    let user = await User.findOne({ userId });
    
    if (!user) {
      return message.reply('Start your journey with `op start` first!');
    }
    
    // Ensure username is set
    if (!user.username) {
      user.username = username;
      await user.save();
    }
    
    let currentType = 'daily';
    
    // Check if user specified a quest type
    if (args[0] && ['daily', 'weekly', 'story'].includes(args[0].toLowerCase())) {
      currentType = args[0].toLowerCase();
    }
    
    // Get available quests
    const allQuests = await getAvailableQuests(user);
    const questsByType = {
      daily: allQuests.filter(q => q.type === 'daily'),
      weekly: allQuests.filter(q => q.type === 'weekly'),
      story: allQuests.filter(q => q.type === 'story')
    };
    
    const embed = createQuestEmbed(currentType, questsByType[currentType], user);
    const components = createQuestButtons(currentType);
    
    const questMessage = await message.reply({ embeds: [embed], components });
    
    // Button interaction collector
    const filter = i => i.user.id === userId;
    const collector = questMessage.createMessageComponentCollector({ filter, time: 300000 });
    
    collector.on('collect', async interaction => {
      try {
        await interaction.deferUpdate();
        
        if (interaction.customId.startsWith('quest_')) {
          const action = interaction.customId.split('_')[1];
          
          if (['daily', 'weekly', 'story'].includes(action)) {
            currentType = action;
            
            // Refresh quest data
            const refreshedUser = await User.findOne({ userId });
            const refreshedQuests = await getAvailableQuests(refreshedUser);
            const refreshedQuestsByType = {
              daily: refreshedQuests.filter(q => q.type === 'daily'),
              weekly: refreshedQuests.filter(q => q.type === 'weekly'),
              story: refreshedQuests.filter(q => q.type === 'story')
            };
            
            const newEmbed = createQuestEmbed(currentType, refreshedQuestsByType[currentType], refreshedUser);
            const newComponents = createQuestButtons(currentType);
            
            await questMessage.edit({ embeds: [newEmbed], components: newComponents });
            
          } else if (action === 'claim') {
            // Claim all completed quests
            const refreshedUser = await User.findOne({ userId });
            const refreshedQuests = await getAvailableQuests(refreshedUser);
            
            let claimedRewards = [];
            let totalBeli = 0;
            let totalXP = 0;
            
            for (const quest of refreshedQuests) {
              try {
                const userProgress = getQuestProgress(refreshedUser, quest.questId);
                const { allComplete } = formatQuestProgress(quest, userProgress);
                
                // Check if not already completed
                const completedKey = `${quest.questId}_${getQuestResetPeriod(quest.type)}`;
                const isCompleted = refreshedUser.completedQuests?.includes(completedKey);
                
                if (allComplete && !isCompleted) {
                  const result = await claimQuestReward(refreshedUser, quest.questId);
                  
                  if (result.success) {
                    claimedRewards.push(quest.name);
                    
                    // Calculate totals for display
                    for (const reward of quest.rewards) {
                      if (reward.type === 'beli') totalBeli += reward.amount;
                      if (reward.type === 'xp') totalXP += reward.amount;
                    }
                  }
                }
              } catch (error) {
                console.error(`Error claiming quest ${quest.questId}:`, error);
              }
            }
            
            if (claimedRewards.length > 0) {
              await refreshedUser.save();
              
              let claimText = '**Rewards Claimed!**\n\n';
              claimText += `Completed Quests: ${claimedRewards.join(', ')}\n`;
              if (totalBeli > 0) claimText += `Total Beli: +${totalBeli}\n`;
              if (totalXP > 0) claimText += `Total XP: +${totalXP}\n`;
              
              await interaction.followUp({ content: claimText, ephemeral: true });
              
              // Refresh the quest display
              const finalRefreshUser = await User.findOne({ userId });
              const finalRefreshQuests = await getAvailableQuests(finalRefreshUser);
              const finalRefreshQuestsByType = {
                daily: finalRefreshQuests.filter(q => q.type === 'daily'),
                weekly: finalRefreshQuests.filter(q => q.type === 'weekly'),
                story: finalRefreshQuests.filter(q => q.type === 'story')
              };
              
              const newEmbed = createQuestEmbed(currentType, finalRefreshQuestsByType[currentType], finalRefreshUser);
              const newComponents = createQuestButtons(currentType);
              
              await questMessage.edit({ embeds: [newEmbed], components: newComponents });
              
            } else {
              await interaction.followUp({ content: 'No completed quests to claim!', ephemeral: true });
            }
          }
        }
      } catch (error) {
        console.error('Error handling quest interaction:', error);
        try {
          await interaction.followUp({ 
            content: 'An error occurred while processing your quest action.', 
            ephemeral: true 
          });
        } catch (followUpError) {
          console.error('Error sending error message:', followUpError);
        }
      }
    });
    
    collector.on('end', () => {
      questMessage.edit({ components: [] }).catch(() => {});
    });
    
  } catch (error) {
    console.error('Error in quest command:', error);
    return message.reply('An error occurred while loading your quests. Please try again later.');
  }
}

module.exports = { data, execute };
