const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { calculateDamage, getActiveCard, resetTeamHP } = require('../utils/battleSystem.js');
const { updateQuestProgress } = require('../utils/questSystem');

// Boss battle functions
function createBossBattleEmbed(boss, playerTeam, battleLog, turn, enemyType = "enemy") {
  const battleTitle = enemyType === "boss" ? "Boss Battle" : "Battle";
  const hpBar = createHpBar(boss.currentHp, boss.maxHp);

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ ${battleTitle}: ${boss.name}`)
    .setDescription(`**${boss.description || 'A fierce enemy blocks your path!'}**\n\n${battleLog.slice(-4).join('\n')}`)
    .setColor(0xff0000);

  const teamDisplay = playerTeam.filter(card => card.currentHp > 0).map(card => {
    const cardHpBar = createHpBar(card.currentHp, card.hp);
    return `${card.name} ${cardHpBar} ${card.currentHp}/${card.hp}`;
  }).join('\n') || 'No cards available';

  embed.addFields(
    { name: `🔥 ${boss.name} HP`, value: `${hpBar} ${boss.currentHp}/${boss.maxHp}`, inline: true },
    { name: '⚡ Attack Power', value: `${boss.attack[0]}-${boss.attack[1]}`, inline: true },
    { name: '🛡️ Your Team', value: teamDisplay, inline: false }
  );

  return embed;
}

function createBossBattleButtons(disabled = false) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('boss_attack')
        .setLabel('⚔️ Attack')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('boss_defend')
        .setLabel('🛡️ Defend')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('boss_flee')
        .setLabel('🏃 Flee')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled)
    );
}

function createHpBar(current, max) {
  const percentage = Math.max(0, current / max);
  const barLength = 10;
  const filledLength = Math.round(barLength * percentage);
  const emptyLength = barLength - filledLength;
  return '█'.repeat(filledLength) + '░'.repeat(emptyLength);
}

const name = 'interactionCreate';
const once = false;

async function execute(interaction, client) {
  if (!interaction.isButton() && !interaction.isSelectMenu()) return;

  if (interaction.customId.startsWith('boss_')) {
    await handleBossInteraction(interaction, client);
    return;
  }

  if (interaction.customId.startsWith('choice_')) {
    await handleChoiceInteraction(interaction, client);
    return;
  }

  if (interaction.customId.startsWith('help_')) {
    await handleHelpInteraction(interaction, client);
    return;
  }

  if (interaction.customId.startsWith('quest_')) {
    await handleQuestInteraction(interaction, client);
    return;
  }
}

async function handleChoiceInteraction(interaction, client) {
  const choiceData = client.choices?.get(interaction.message.id);
  if (!choiceData || choiceData.userId !== interaction.user.id) {
    return interaction.reply({ content: 'This choice is not for you or has expired.', ephemeral: true });
  }

  const { stageData, stage } = choiceData;
  const choice = interaction.customId.split('_')[1];

  let user = await User.findOne({ userId: interaction.user.id });
  if (!user) return interaction.reply({ content: 'User not found!', ephemeral: true });

  // Apply reward based on choice
  const reward = choice === 'yes' ? stageData.choice.yes : stageData.choice.no;

  let rewardText = '';
  if (reward.type === 'card') {
    if (!user.cards) user.cards = [];
    if (!user.cards.find(c => c.name === reward.name)) {
      user.cards.push({
        name: reward.name,
        rank: reward.rank,
        timesUpgraded: 0
      });
      rewardText = `🎴 You obtained **${reward.name}** (${reward.rank} rank)!`;
    } else {
      rewardText = `You already have **${reward.name}**.`;
    }
  } else if (reward.type === 'beli') {
    user.beli = (user.beli || 0) + reward.amount;
    rewardText = `💰 You gained **${reward.amount}** Beli!`;
  }

  // Progress to next stage
  user.exploreStage = stage + 1;
  user.exploreLast = Date.now();
  await user.save();

  // Remove choice from memory
  client.choices.delete(interaction.message.id);

  const resultEmbed = new EmbedBuilder()
    .setTitle(`✅ Choice Made: ${choice === 'yes' ? 'Yes' : 'No'}`)
    .setDescription(`${stageData.desc}\n\n**Result:** ${rewardText}`)
    .setColor(choice === 'yes' ? 0x27ae60 : 0xe74c3c);

  try {
    await interaction.update({
      embeds: [resultEmbed],
      components: []
    });
  } catch (error) {
    // If interaction expired, send a new message
    await interaction.followUp({
      embeds: [resultEmbed],
      components: []
    });
  }
}

async function handleBossInteraction(interaction, client) {
  const battleData = client.battles?.get(interaction.message.id);
  if (!battleData || battleData.userId !== interaction.user.id) {
    return interaction.reply({ content: 'This battle is not for you or has expired.', ephemeral: true });
  }

  const { boss, playerTeam, battleLog, turn, stageData } = battleData;
  const action = interaction.customId.split('_')[1];

  if (boss.currentHp <= 0 || playerTeam.every(card => card.currentHp <= 0)) {
    return interaction.reply({ content: 'This battle has already ended.', ephemeral: true });
  }

  // Check if interaction is still valid
  try {
    await interaction.deferUpdate();
  } catch (error) {
    console.log('Interaction expired or already handled');
    return;
  }

  let playerAction = '';
  let damage = 0;
  const activePlayerCard = getActiveCard(playerTeam);

  if (!activePlayerCard) {
    return interaction.reply({ content: 'No active cards available to fight!', ephemeral: true });
  }

  switch (action) {
    case 'attack':
      damage = calculateDamage(activePlayerCard, boss, 'normal');
      boss.currentHp = Math.max(0, boss.currentHp - damage);
      playerAction = `${activePlayerCard.name} attacks ${boss.name} for ${damage} damage!`;
      break;

    case 'skill':
      damage = calculateDamage(activePlayerCard, boss, 'skill');
      boss.currentHp = Math.max(0, boss.currentHp - damage);
      playerAction = `${activePlayerCard.name} uses special attack on ${boss.name} for ${damage} damage!`;
      break;

    case 'defend': {
      const healAmount = Math.floor(activePlayerCard.hp * 0.2);
      activePlayerCard.currentHp = Math.min(activePlayerCard.hp, activePlayerCard.currentHp + healAmount);
      playerAction = `${activePlayerCard.name} defends and recovers ${healAmount} HP!`;
      break;
    }

    case 'flee': {
      const user = await User.findOne({ userId: interaction.user.id });
      // Optionally save state here
      client.battles.delete(interaction.message.id);
      const fleeEmbed = new EmbedBuilder()
        .setTitle('🏃 Battle Fled')
        .setDescription('You fled from the battle. You can try again later.')
        .setColor(0xf39c12);
      return interaction.editReply({ embeds: [fleeEmbed], components: [] });
    }
  }

  battleLog.push(playerAction);

  if (boss.currentHp <= 0) {
          // Player wins
          let user = await User.findOne({ userId: interaction.user.id });
          let winMessage = `You defeated ${boss.name}!`;

          if (stageData && stageData.reward) {
            // Distribute XP to each team member
            const xpPerCard = Math.floor(stageData.reward.xp / playerTeam.length);

            // Track level ups for display
            user.recentLevelUps = [];

            playerTeam.forEach(card => {
              const oldLevel = card.level || 1;
              card.xp = (card.xp || 0) + xpPerCard;

              // Level up if enough XP is gained
              while (card.xp >= 100) {
                card.xp -= 100;
                card.level = (card.level || 1) + 1;
                // Store the original level before the level up
                user.recentLevelUps.push({ name: card.name, oldLevel: oldLevel, newLevel: card.level });
              }
            });

            // Apply other rewards
            user.beli = (user.beli || 0) + (stageData.reward?.amount || 0);

            resetTeamHP(playerTeam); // Heal team after battle

            // Check for level ups from XP rewards
            if (user.recentLevelUps && user.recentLevelUps.length > 0) {
              winMessage += '\n\n**Level Ups:**\n';
              user.recentLevelUps.forEach(change => {
                winMessage += `${change.name}: Level ${change.oldLevel} → ${change.newLevel}\n`;
              });
              user.recentLevelUps = undefined; // Clear after displaying
            }
          }

          // CRITICAL: Progress exploration stage after boss victory
          if (battleData.exploreBattle) {
            user.exploreStage = (user.exploreStage || 0) + 1;
            user.exploreLast = Date.now();
            user.exploreLossCooldown = 0;

            // Update quest progress for exploration
            const { updateQuestProgress } = require('../utils/questSystem.js');
            await updateQuestProgress(user, 'explore', 1);
          }

          await user.save();

          const victoryEmbed = new EmbedBuilder()
            .setTitle(`🏆 Victory! ${boss.name} Defeated!`)
            .setDescription(`${battleLog.slice(-3).join('\n')}\n\n${winMessage}\n\n*Your team has recovered!*`)
            .setColor(0x27ae60);

          try {
            await interaction.editReply({ embeds: [victoryEmbed], components: [] });
          } catch (error) {
            // If interaction expired, send a new message
            await interaction.followUp({ embeds: [victoryEmbed], components: [] });
          }
        } else if (playerTeam.every(card => card.currentHp <= 0)) {
          const defeatEmbed = new EmbedBuilder()
            .setTitle(`💀 Defeat! ${boss.name} Wins!`)
            .setDescription(`${battleLog.slice(-3).join('\n')}\n\nYour team has been defeated. Rest and try again later.\n*Use \`op shop\` to buy healing items.*`)
            .setColor(0xe74c3c);

          try {
            await interaction.editReply({ embeds: [defeatEmbed], components: [] });
          } catch (error) {
            await interaction.followUp({ embeds: [defeatEmbed], components: [] });
          }
        } else {
          if (boss.currentHp > 0) {
            const bossTarget = playerTeam.find(card => card.currentHp > 0);
            if (bossTarget) {
              const bossDamage = Math.floor(Math.random() * (boss.attack[1] - boss.attack[0] + 1)) + boss.attack[0];
              bossTarget.currentHp = Math.max(0, bossTarget.currentHp - bossDamage);
              battleLog.push(`${boss.name} attacks ${bossTarget.name} for ${bossDamage} damage!`);
              if (bossTarget.currentHp <= 0) {
                battleLog.push(`💀 ${bossTarget.name} has been knocked out!`);
              }
            }
          }

          battleData.battleLog = battleLog;
          battleData.turn = turn + 1;

          const enemyType = stageData.type === "boss" ? "boss" : "enemy";
          const updatedEmbed = createBossBattleEmbed(boss, playerTeam, battleLog, battleData.turn, enemyType);
          const updatedButtons = createBossBattleButtons();

          try {
            await interaction.editReply({ embeds: [updatedEmbed], components: [updatedButtons] });
          } catch (error) {
            // If interaction expired, send a new message
            await interaction.followUp({ embeds: [updatedEmbed], components: [updatedButtons] });
          }
        }
}

async function handleHelpInteraction(interaction, client) {
  return;
}

async function handleQuestInteraction(interaction, client) {
  return;
}

module.exports = { name, once, execute };