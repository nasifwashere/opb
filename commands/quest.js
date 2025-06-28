const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { getAvailableQuests, updateQuestProgress, claimQuestReward } = require('../utils/questSystem.js');

function createQuestEmbed(quests, activeQuests, completedQuests) {
  const embed = new EmbedBuilder()
    .setTitle('📋 Quest Log')
    .setDescription('Complete quests to earn rewards!')
    .setColor(0x3498db)
    .setFooter({ text: 'Quests reset daily at midnight UTC' });

  if (quests.length === 0) {
    embed.addFields({ name: 'No Quests Available', value: 'Check back later for new quests!', inline: false });
    return embed;
  }

  // Group quests by type
  const dailyQuests = quests.filter(q => q.type === 'daily');
  const weeklyQuests = quests.filter(q => q.type === 'weekly');
  const storyQuests = quests.filter(q => q.type === 'story');

  // Display daily quests
  if (dailyQuests.length > 0) {
    let dailyText = '';
    dailyQuests.forEach((quest, index) => {
      const activeQuest = activeQuests.find(aq => aq.questId === quest.questId);
      const isCompleted = completedQuests.includes(quest.questId);
      
      let status = '⭕ Available';
      let progressText = '';
      
      if (isCompleted) {
        status = '✅ Completed';
      } else if (activeQuest) {
        const requirement = quest.requirements[0]; // Assuming single requirement for simplicity
        const current = activeQuest.progress.get ? activeQuest.progress.get(requirement.type) || 0 : activeQuest.progress[requirement.type] || 0;
        const target = requirement.target;
        const progress = Math.min(current, target);
        
        if (progress >= target) {
          status = '🎁 Ready to claim!';
        } else {
          status = '🔄 In Progress';
          progressText = ` (${progress}/${target})`;
        }
      }
      
      const rewards = quest.rewards.map(r => {
        if (r.type === 'beli') return `${r.amount} Beli`;
        if (r.type === 'xp') return `${r.amount} XP`;
        if (r.type === 'item') return r.itemName || r.name;
        if (r.type === 'card') return r.itemName || r.name;
        return `${r.amount} ${r.type}`;
      }).join(', ');
      
      dailyText += `**${quest.name}** ${status}${progressText}\n`;
      dailyText += `ID: \`${quest.questId}\` | ${quest.description}\n`;
      dailyText += `🎁 Rewards: ${rewards}\n\n`;
    });
    
    embed.addFields({ name: '📅 Daily Quests', value: dailyText, inline: false });
  }

  // Display weekly quests
  if (weeklyQuests.length > 0) {
    let weeklyText = '';
    weeklyQuests.forEach(quest => {
      const activeQuest = activeQuests.find(aq => aq.questId === quest.questId);
      const isCompleted = completedQuests.includes(quest.questId);
      
      let status = '⭕ Available';
      let progressText = '';
      
      if (isCompleted) {
        status = '✅ Completed';
      } else if (activeQuest) {
        const requirement = quest.requirements[0];
        const current = activeQuest.progress.get ? activeQuest.progress.get(requirement.type) || 0 : activeQuest.progress[requirement.type] || 0;
        const target = requirement.target;
        const progress = Math.min(current, target);
        
        if (progress >= target) {
          status = '🎁 Ready to claim!';
        } else {
          status = '🔄 In Progress';
          progressText = ` (${progress}/${target})`;
        }
      }
      
      const rewards = quest.rewards.map(r => {
        if (r.type === 'beli') return `${r.amount} Beli`;
        if (r.type === 'xp') return `${r.amount} XP`;
        if (r.type === 'item') return r.itemName || r.name;
        if (r.type === 'card') return r.itemName || r.name;
        return `${r.amount} ${r.type}`;
      }).join(', ');
      
      weeklyText += `**${quest.name}** ${status}${progressText}\n`;
      weeklyText += `ID: \`${quest.questId}\` | ${quest.description}\n`;
      weeklyText += `🎁 Rewards: ${rewards}\n\n`;
    });
    
    embed.addFields({ name: '📆 Weekly Quests', value: weeklyText, inline: false });
  }

  // Display story quests
  if (storyQuests.length > 0) {
    let storyText = '';
    storyQuests.slice(0, 3).forEach(quest => { // Limit to 3 story quests
      const activeQuest = activeQuests.find(aq => aq.questId === quest.questId);
      const isCompleted = completedQuests.includes(quest.questId);
      
      let status = '⭕ Available';
      let progressText = '';
      
      if (isCompleted) {
        status = '✅ Completed';
      } else if (activeQuest) {
        const requirement = quest.requirements[0];
        const current = activeQuest.progress.get ? activeQuest.progress.get(requirement.type) || 0 : activeQuest.progress[requirement.type] || 0;
        const target = requirement.target;
        const progress = Math.min(current, target);
        
        if (progress >= target) {
          status = '🎁 Ready to claim!';
        } else {
          status = '🔄 In Progress';
          progressText = ` (${progress}/${target})`;
        }
      }
      
      const rewards = quest.rewards.map(r => {
        if (r.type === 'beli') return `${r.amount} Beli`;
        if (r.type === 'xp') return `${r.amount} XP`;
        if (r.type === 'item') return r.itemName || r.name;
        if (r.type === 'card') return r.itemName || r.name;
        return `${r.amount} ${r.type}`;
      }).join(', ');
      
      storyText += `**${quest.name}** ${status}${progressText}\n`;
      storyText += `ID: \`${quest.questId}\` | ${quest.description}\n`;
      storyText += `🎁 Rewards: ${rewards}\n\n`;
    });
    
    embed.addFields({ name: '📖 Story Quests', value: storyText, inline: false });
  }

  return embed;
}

function createQuestButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('quest_claim')
      .setLabel('🎁 Claim Rewards')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('quest_refresh')
      .setLabel('🔄 Refresh')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('quest_progress')
      .setLabel('📊 View Progress')
      .setStyle(ButtonStyle.Primary)
  );
}

const data = { name: 'quest', description: 'View and manage your daily, weekly, and story quests.' };

async function execute(message, args) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });

  if (!user) return message.reply('Start your journey with `op start` first!');

  // Handle subcommands
  if (args.length > 0) {
    const subcommand = args[0].toLowerCase();
    
    if (subcommand === 'claim') {
      const questId = args[1];
      if (!questId) {
        return message.reply('Usage: `op quest claim <quest_id>`\n\nYou can find quest IDs in the quest list.');
      }
      
      const result = await claimQuestReward(user, questId);
      if (result.success) {
        // Apply XP distribution to team if XP reward
        if (result.rewards) {
          for (const reward of result.rewards) {
            if (reward.type === 'xp') {
              const { distributeXPToTeam } = require('../utils/levelSystem.js');
              const levelChanges = distributeXPToTeam(user, reward.amount);
              if (levelChanges && levelChanges.length > 0) {
                let levelUpText = '\n\n**Level Ups:**\n';
                levelChanges.forEach(change => {
                  levelUpText += `${change.name}: Level ${change.oldLevel} → ${change.newLevel}\n`;
                });
                result.message += levelUpText;
              }
            }
          }
        }
        await user.save();
        return message.reply(`✅ ${result.message}`);
      } else {
        return message.reply(`❌ ${result.message}`);
      }
    }
  }

  // Get available quests
  const availableQuests = await getAvailableQuests(user);
  const activeQuests = user.activeQuests || [];
  
  // Get completed quests
  const completedQuests = user.completedQuests || [];

  const embed = createQuestEmbed(availableQuests, activeQuests, completedQuests);
  const components = [createQuestButtons()];

  const questMessage = await message.reply({ embeds: [embed], components });

  // Button interaction collector
  const filter = i => i.user.id === userId;
  const collector = questMessage.createMessageComponentCollector({ filter, time: 300000 });

  collector.on('collect', async interaction => {
    await interaction.deferUpdate();

    if (interaction.customId === 'quest_refresh') {
      // Refresh the quest display
      const newAvailableQuests = await getAvailableQuests(user);
      const newActiveQuests = user.activeQuests || [];
      const newCompletedQuests = user.completedQuests || [];
      const newEmbed = createQuestEmbed(newAvailableQuests, newActiveQuests, newCompletedQuests);
      
      await questMessage.edit({ embeds: [newEmbed], components });
      
    } else if (interaction.customId === 'quest_claim') {
      // Show claim instructions
      await interaction.followUp({ 
        content: 'To claim quest rewards, use: `op quest claim <quest_id>`\n\nQuest IDs are shown in the quest descriptions above.', 
        ephemeral: true 
      });
      
    } else if (interaction.customId === 'quest_progress') {
      // Show detailed progress
      if (activeQuests.length === 0) {
        await interaction.followUp({ 
          content: 'You have no active quests. Start quests by participating in activities!', 
          ephemeral: true 
        });
        return;
      }
      
      let progressText = '**Your Quest Progress:**\n\n';
      availableQuests.forEach(quest => {
        const activeQuest = activeQuests.find(aq => aq.questId === quest.questId);
        if (activeQuest) {
          quest.requirements.forEach(req => {
            const current = activeQuest.progress.get ? activeQuest.progress.get(req.type) || 0 : activeQuest.progress[req.type] || 0;
            const target = req.target;
            const percentage = Math.floor((current / target) * 100);
            progressText += `**${quest.name}**: ${current}/${target} (${percentage}%)\n`;
          });
        }
      });
      
      await interaction.followUp({ content: progressText, ephemeral: true });
    }
  });

  collector.on('end', () => {
    questMessage.edit({ components: [] }).catch(() => {});
  });
}

module.exports = { data, execute };
