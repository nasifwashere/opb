
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const { getAvailableQuests, updateQuestProgress, claimQuestReward } = require('../utils/questSystem.js');

function createQuestEmbed(quests, activeQuests, completedQuests) {
  const embed = new EmbedBuilder()
    .setTitle(' Quest Log')
    .setDescription('Complete quests to earn rewards!')
    .setColor(0x3498db);

  if (quests.length === 0) {
    embed.addFields({ name: 'No Quests Available', value: 'Check back later for new quests!', inline: false });
    return embed;
  }

  // Show only claimable quests and a few active ones
  const claimableQuests = [];
  const inProgressQuests = [];
  
  quests.forEach(quest => {
    // Check if quest is already completed with proper ID format
    const claimId = `${quest.questId}_${getQuestResetPeriod(quest.type)}`;
    const isCompleted = completedQuests.some(cq => cq === claimId || cq.includes(quest.questId));
    
    if (isCompleted) return; // Skip completed quests
    
    const activeQuest = activeQuests.find(aq => aq.questId === quest.questId);
    if (activeQuest) {
      let allRequirementsMet = true;
      let currentProgress = {};
      
      for (const requirement of quest.requirements) {
        const progress = activeQuest.progress instanceof Map ? 
          activeQuest.progress.get(requirement.type) || 0 : 
          activeQuest.progress[requirement.type] || 0;
        currentProgress[requirement.type] = progress;
        
        if (progress < requirement.target) {
          allRequirementsMet = false;
          inProgressQuests.push({ quest, progress, requirement, currentProgress });
          break;
        }
      }
      if (allRequirementsMet) {
        claimableQuests.push(quest);
      }
    }
  });

  // Show claimable quests first
  if (claimableQuests.length > 0) {
    let claimableText = '';
    claimableQuests.slice(0, 5).forEach(quest => {
      const rewards = quest.rewards.map(r => {
        if (r.type === 'beli') return `<:Money:1375579299565928499>${r.amount}`;
        if (r.type === 'xp') return `<:snoopy_sparkles:1388585338821152978>${r.amount}`;
        if (r.type === 'item') return `<:emptybox:1388587415018410177>${r.itemName || r.name}`;
        return `${r.type}`;
      }).join(' ');
      claimableText += ` **${quest.name}** - ${rewards}\n`;
    });
    embed.addFields({ name: ' Ready to Claim', value: claimableText, inline: false });
  }

  // Show active quests
  if (inProgressQuests.length > 0) {
    let progressText = '';
    inProgressQuests.slice(0, 5).forEach(({ quest, progress, requirement }) => {
      const current = progress;
      const target = requirement.target;
      const percentage = Math.floor((current / target) * 100);
      progressText += `<:icon1:1375589270013608206> **${quest.name}** - ${current}/${target} (${percentage}%)\n`;
    });
    embed.addFields({ name: '<:icon1:1375589270013608206> In Progress', value: progressText, inline: false });
  }

  return embed;
}

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

function createQuestMenu(claimableQuests) {
  if (claimableQuests.length === 0) return null;

  const options = claimableQuests.slice(0, 25).map(quest => ({
    label: quest.name.length > 100 ? quest.name.substring(0, 97) + '...' : quest.name,
    description: quest.description.length > 100 ? quest.description.substring(0, 97) + '...' : quest.description,
    value: quest.questId
  }));

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('quest_claim_select')
      .setPlaceholder('Select a quest to claim')
      .addOptions(options)
  );
}

function createQuestButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('quest_refresh')
      .setLabel('<:icon1:1375589270013608206> Refresh')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('quest_info')
      .setLabel('ℹ Info')
      .setStyle(ButtonStyle.Primary)
  );
}

async function createQuestInfoEmbed() {
  const embed = new EmbedBuilder()
    .setTitle(' Quest Requirements')
    .setDescription('Here\'s what you need to do to complete each quest:')
    .setColor(0x3498db)
    .addFields(
      {
        name: ' Daily Card Pull',
        value: 'Pull 1 card using `op pull`',
        inline: true
      },
      {
        name: ' Continue Your Adventure', 
        value: 'Take 3 exploration steps using `op explore`',
        inline: true
      },
      {
        name: ' Battle Training',
        value: 'Win 2 battles using `op battle`',
        inline: true
      },
      {
        name: ' Crew Assembly',
        value: 'Add or change 1 card in your team using `op team`',
        inline: true
      },
      {
        name: ' Power Enhancement',
        value: 'Level up 1 card using `op level`',
        inline: true
      },
      {
        name: ' Collection Master (Weekly)',
        value: 'Pull 15 cards this week',
        inline: true
      },
      {
        name: ' Battle Champion (Weekly)',
        value: 'Win 10 battles this week',
        inline: true
      },
      {
        name: ' Grand Line Explorer (Weekly)',
        value: 'Complete 20 exploration steps this week',
        inline: true
      },
      {
        name: ' Evolution Specialist (Weekly)',
        value: 'Evolve 3 cards this week using `op evolve`',
        inline: true
      },
      {
        name: ' Market Trader (Weekly)',
        value: 'Make 5 market transactions (buy/sell)',
        inline: true
      },
      {
        name: ' First Steps to Piracy (Story)',
        value: 'Complete 5 exploration steps in Romance Dawn',
        inline: true
      },
      {
        name: ' Assembling the Crew (Story)',
        value: 'Build a complete team of 3 cards',
        inline: true
      },
      {
        name: ' First Taste of Victory (Story)',
        value: 'Win 1 battle against a boss',
        inline: true
      },
      {
        name: ' Building a Collection (Story)',
        value: 'Collect 10 different cards through pulls',
        inline: true
      },
      {
        name: ' Unlocking Potential (Story)',
        value: 'Evolve 1 card to a stronger form',
        inline: true
      },
      {
        name: '🏴 Romance Dawn Complete (Story)',
        value: 'Finish all exploration stages in Romance Dawn',
        inline: true
      },
      {
        name: ' Training for Power (Story)',
        value: 'Level up cards 5 times total',
        inline: true
      },
      {
        name: ' Introduction to Trading (Story)',
        value: 'Make 1 market transaction (buy or sell)',
        inline: true
      },
      {
        name: ' Advanced Explorer (Story)',
        value: 'Complete 25 exploration steps across all sagas',
        inline: true
      },
      {
        name: ' Rank Up Specialist (Story)',
        value: 'Evolve cards to A rank or higher 3 times',
        inline: true
      }
    );

  return embed;
}

const data = { name: 'quest', description: 'View and manage your quests.' };

async function execute(message, args) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });

  if (!user) return message.reply('Start your journey with `op start` first!');

  // Get available quests
  const availableQuests = await getAvailableQuests(user);
  const activeQuests = user.activeQuests || [];
  const completedQuests = user.completedQuests || [];

  // Find claimable quests
  const claimableQuests = [];
  availableQuests.forEach(quest => {
    const activeQuest = activeQuests.find(aq => aq.questId === quest.questId);
    if (activeQuest) {
      let allRequirementsMet = true;
      for (const requirement of quest.requirements) {
        const progress = activeQuest.progress.get ? activeQuest.progress.get(requirement.type) || 0 : activeQuest.progress[requirement.type] || 0;
        if (progress < requirement.target) {
          allRequirementsMet = false;
          break;
        }
      }
      if (allRequirementsMet && !completedQuests.some(cq => cq.includes(quest.questId))) {
        claimableQuests.push(quest);
      }
    }
  });

  const embed = createQuestEmbed(availableQuests, activeQuests, completedQuests);
  const components = [];
  
  const questMenu = createQuestMenu(claimableQuests);
  if (questMenu) components.push(questMenu);
  components.push(createQuestButtons());

  const questMessage = await message.reply({ embeds: [embed], components });

  // Interaction collector
  const filter = i => i.user.id === userId;
  const collector = questMessage.createMessageComponentCollector({ filter, time: 300000 });

  collector.on('collect', async interaction => {
    await interaction.deferUpdate();

    if (interaction.customId === 'quest_refresh') {
      // Refresh the quest display
      const newUser = await User.findOne({ userId });
      const newAvailableQuests = await getAvailableQuests(newUser);
      const newActiveQuests = newUser.activeQuests || [];
      const newCompletedQuests = newUser.completedQuests || [];
      
      const newClaimableQuests = [];
      newAvailableQuests.forEach(quest => {
        const claimId = `${quest.questId}_${getQuestResetPeriod(quest.type)}`;
        const isCompleted = newCompletedQuests.some(cq => cq === claimId || cq.includes(quest.questId));
        
        if (!isCompleted) {
          const activeQuest = newActiveQuests.find(aq => aq.questId === quest.questId);
          if (activeQuest) {
            let allRequirementsMet = true;
            for (const requirement of quest.requirements) {
              const progress = activeQuest.progress instanceof Map ? 
                activeQuest.progress.get(requirement.type) || 0 : 
                activeQuest.progress[requirement.type] || 0;
              if (progress < requirement.target) {
                allRequirementsMet = false;
                break;
              }
            }
            if (allRequirementsMet) {
              newClaimableQuests.push(quest);
            }
          }
        }
      });

      const newEmbed = createQuestEmbed(newAvailableQuests, newActiveQuests, newCompletedQuests);
      const newComponents = [];
      
      const newQuestMenu = createQuestMenu(newClaimableQuests);
      if (newQuestMenu) newComponents.push(newQuestMenu);
      newComponents.push(createQuestButtons());

      await questMessage.edit({ embeds: [newEmbed], components: newComponents });

    } else if (interaction.customId === 'quest_info') {
      const infoEmbed = await createQuestInfoEmbed();
      await interaction.followUp({ embeds: [infoEmbed], ephemeral: true });

    } else if (interaction.customId === 'quest_claim_select') {
      const questId = interaction.values[0];
      const currentUser = await User.findOne({ userId });
      
      const result = await claimQuestReward(currentUser, questId);
      if (result.success) {
        // Apply XP distribution to team if XP reward
        if (result.rewards) {
          for (const reward of result.rewards) {
            if (reward.type === 'xp') {
              const { distributeXPToTeam } = require('../utils/levelSystem.js');
              const levelChanges = distributeXPToTeam(currentUser, reward.amount);
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
        await currentUser.save();
        await interaction.followUp({ content: `<:sucess:1375872950321811547> ${result.message}`, ephemeral: true });
        
        // Refresh the display
        setTimeout(async () => {
          const refreshUser = await User.findOne({ userId });
          const refreshAvailableQuests = await getAvailableQuests(refreshUser);
          const refreshActiveQuests = refreshUser.activeQuests || [];
          const refreshCompletedQuests = refreshUser.completedQuests || [];
          
          const refreshClaimableQuests = [];
          refreshAvailableQuests.forEach(quest => {
            const activeQuest = refreshActiveQuests.find(aq => aq.questId === quest.questId);
            if (activeQuest) {
              let allRequirementsMet = true;
              for (const requirement of quest.requirements) {
                const progress = activeQuest.progress.get ? activeQuest.progress.get(requirement.type) || 0 : activeQuest.progress[requirement.type] || 0;
                if (progress < requirement.target) {
                  allRequirementsMet = false;
                  break;
                }
              }
              if (allRequirementsMet && !refreshCompletedQuests.some(cq => cq.includes(quest.questId))) {
                refreshClaimableQuests.push(quest);
              }
            }
          });

          const refreshEmbed = createQuestEmbed(refreshAvailableQuests, refreshActiveQuests, refreshCompletedQuests);
          const refreshComponents = [];
          
          const refreshQuestMenu = createQuestMenu(refreshClaimableQuests);
          if (refreshQuestMenu) refreshComponents.push(refreshQuestMenu);
          refreshComponents.push(createQuestButtons());

          await questMessage.edit({ embeds: [refreshEmbed], components: refreshComponents }).catch(() => {});
        }, 1000);
      } else {
        await interaction.followUp({ content: `<:arrow:1375872983029256303> ${result.message}`, ephemeral: true });
      }
    }
  });

  collector.on('end', () => {
    questMessage.edit({ components: [] }).catch(() => {});
  });
}

module.exports = { data, execute };
