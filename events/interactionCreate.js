const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { calculateDamage, getActiveCard, resetTeamHP } = require('../utils/battleSystem.js');
const { updateQuestProgress } = require('../utils/questSystem');

// Boss battle functions
function createBossBattleEmbed(boss, playerTeam, battleLog, turn) {
  const embed = new EmbedBuilder()
    .setTitle(`⚔️ Boss Battle: ${boss.name}`)
    .setDescription(`**${boss.description}**\n\n${battleLog.join('\n')}`)
    .setColor(0xff0000)
    .setThumbnail(boss.image || 'https://i.imgur.com/default-boss.png');

  embed.addFields(
    { name: '🔥 Boss HP', value: `${boss.currentHp}/${boss.maxHp}`, inline: true },
    { name: '⚡ Boss Power', value: `${boss.power}`, inline: true },
    { name: '🛡️ Your Team', value: playerTeam.filter(card => card.currentHp > 0).map(card => `${card.name} (${card.currentHp}/${card.maxHp} HP)`).join('\n') || 'No cards available', inline: false }
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

  if (interaction.customId.startsWith('help_')) {
    await handleHelpInteraction(interaction, client);
    return;
  }

  if (interaction.customId.startsWith('quest_')) {
    await handleQuestInteraction(interaction, client);
    return;
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
        .setDescription('You fled from the boss battle. You can try again later.')
        .setColor(0xf39c12);
      return interaction.update({ embeds: [fleeEmbed], components: [] });
    }
  }

  battleLog.push(playerAction);

  if (boss.currentHp <= 0) {
    const user = await User.findOne({ userId: interaction.user.id });
    if (user) {
      user.beli = (user.beli || 0) + (stageData.reward?.amount || 0);
      user.xp = (user.xp || 0) + (stageData.reward?.xp || 0);
      user.exploreStage = (user.exploreStage || 0) + 1;
      user.exploreLast = Date.now();
      resetTeamHP(playerTeam);
      await user.save();
    }

    client.battles.delete(interaction.message.id);

    const victoryEmbed = new EmbedBuilder()
      .setTitle(`🏆 Victory! ${boss.name} Defeated!`)
      .setDescription(`${battleLog.slice(-3).join('\n')}\n\n**Rewards:**\n+${stageData.reward?.amount || 0} Beli\n+${stageData.reward?.xp || 0} XP\n\n*Your team has recovered!*`)
      .setColor(0x27ae60);

    return interaction.update({ embeds: [victoryEmbed], components: [] });
  }

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

  if (playerTeam.every(card => card.currentHp <= 0)) {
    const user = await User.findOne({ userId: interaction.user.id });
    if (user) {
      user.exploreLossCooldown = Date.now() + (stageData.loseCooldown || 60 * 60 * 1000);
      await user.save();
    }

    client.battles.delete(interaction.message.id);

    const defeatEmbed = new EmbedBuilder()
      .setTitle(`💀 Defeat! ${boss.name} Wins!`)
      .setDescription(`${battleLog.slice(-3).join('\n')}\n\nYour team has been defeated. Rest and try again later.\n*Use \`op shop\` to buy healing items.*`)
      .setColor(0xe74c3c);

    return interaction.update({ embeds: [defeatEmbed], components: [] });
  }

  battleData.battleLog = battleLog;
  battleData.turn = turn + 1;

  const updatedEmbed = createBossBattleEmbed(boss, playerTeam, battleLog, battleData.turn);
  const updatedButtons = createBossBattleButtons();

  await interaction.update({ embeds: [updatedEmbed], components: [updatedButtons] });
}

async function handleHelpInteraction(interaction, client) {
  return;
}

async function handleQuestInteraction(interaction, client) {
  return;
}

module.exports = { name, once, execute };
