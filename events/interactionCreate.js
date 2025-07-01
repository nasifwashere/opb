const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { calculateDamage, getActiveCard, resetTeamHP } = require('../utils/battleSystem.js');
const { updateQuestProgress } = require('../utils/questSystem');

// Helper function to check if interaction is still valid
function isInteractionValid(interaction, maxAgeMs = 14 * 60 * 1000) {
  const age = Date.now() - interaction.createdTimestamp;
  return age < maxAgeMs && 
         !interaction.replied && 
         !interaction.deferred && 
         interaction.isRepliable();
}

// Import duel functions
const { createDuelEmbed, createDuelButtons } = require('../commands/duel.js');

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
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('boss_inventory')
        .setLabel('🎒 Inventory')
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),
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
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      return interaction.reply({ content: 'Command not found!', ephemeral: true });
    }

    try {
      // Defer the reply to give more time for processing
      await interaction.deferReply();

      // Convert slash command to message-like format for existing commands
      const fakeMessage = {
        author: interaction.user,
        channel: interaction.channel,
        guild: interaction.guild,
        member: interaction.member,
        reply: async (content) => {
          if (typeof content === 'string') {
            return interaction.editReply({ content });
          } else {
            return interaction.editReply(content);
          }
        }
      };

      const args = [];
      // Extract arguments from slash command options
      if (interaction.options) {
        interaction.options.data.forEach(option => {
          if (option.value !== undefined) {
            args.push(option.value.toString());
          }
        });
      }

      await command.execute(fakeMessage, args, client);
    } catch (error) {
      console.error('Error executing slash command:', error);
      const errorMessage = 'There was an error while executing this command!';

      try {
        if (interaction.deferred) {
          await interaction.editReply({ content: errorMessage });
        } else if (!interaction.replied) {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      } catch (followUpError) {
        console.error('Error sending error message:', followUpError);
      }
    }
    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('boss_')) {
      await handleBossInteraction(interaction, client);
      return;
    }

    if (interaction.customId.startsWith('battle_item_')) {
      await handleBattleItemInteraction(interaction, client);
      return;
    }

    if (interaction.customId.startsWith('duel_')) {
      const battleData = client.battles?.get(interaction.message.id);

      if (!battleData || battleData.type !== 'duel') {
        // Silently ignore expired/invalid duels to prevent error spam
        return;
      }

      try {
        // Check if interaction is still valid (not expired)
        const interactionAge = Date.now() - interaction.createdTimestamp;
        if (interactionAge > 14 * 60 * 1000) { // 14 minutes
          // Clean up expired battle
          if (client.battles?.has(interaction.message.id)) {
            const { endDuel } = require('../commands/duel.js');
            await endDuel(interaction.message.id, client, 'expired');
          }
          return;
        }

        // Only handle if interaction is fresh and valid
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await handleDuelInteraction(interaction, client);
        }
      } catch (error) {
        console.error('Duel action error:', error.code || error.message);
        // Don't try to respond to expired interactions
        if (error.code !== 10062 && error.code !== 10063) {
          if (!interaction.replied && !interaction.deferred && interaction.isRepliable()) {
            try {
              await interaction.reply({ content: 'An error occurred during the duel action.', ephemeral: true });
            } catch (replyError) {
              // Silently fail if we can't respond
            }
          }
        }
      }
      return;
    }

    if (interaction.customId.startsWith('use_item_')) {
      await handleItemUsage(interaction, client);
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

  if (interaction.isSelectMenu()) return;
}

async function handleBattleItemInteraction(interaction, client) {
  if (interaction.customId === 'battle_item_cancel') {
    return interaction.update({ content: 'Action cancelled.', components: [] });
  }

  const item = interaction.customId.split('_')[3];
  const battleData = client.battles?.get(interaction.message.id);

  if (!battleData || battleData.userId !== interaction.user.id) {
    return interaction.reply({ content: 'This battle is not for you or has expired.', ephemeral: true });
  }

  const { playerTeam } = battleData;
  const activePlayerCard = getActiveCard(playerTeam);

  if (!activePlayerCard) {
    return interaction.reply({ content: 'No active cards available.', ephemeral: true });
  }

  const User = require('../db/models/User.js');
  const user = await User.findOne({ userId: interaction.user.id });

  if (!user || !user.inventory || !user.inventory.includes(item)) {
    return interaction.reply({ content: 'You do not have this item.', ephemeral: true });
  }

  // Apply item effects
  let battleLog = battleData.battleLog;
  if (item === 'healingpotion') {
    const healAmount = Math.floor(activePlayerCard.hp * 0.3);
    activePlayerCard.currentHp = Math.min(activePlayerCard.hp, activePlayerCard.currentHp + healAmount);
    battleLog.push(`${activePlayerCard.name} uses a Healing Potion and recovers ${healAmount} HP!`);
  } else if (item === 'statbuffer') {
    activePlayerCard.attackBuff = (activePlayerCard.attackBuff || 0) + 5;
    battleLog.push(`${activePlayerCard.name} uses a Stat Buffer and increases attack!`);
  }

  // Remove item from inventory
  user.inventory = user.inventory.filter(i => i !== item);
  await user.save();

  battleData.battleLog = battleLog;
  client.battles.set(interaction.message.id, battleData);

  const enemyType = battleData.stageData.type === "boss" ? "boss" : "enemy";
  const updatedEmbed = createBossBattleEmbed(battleData.boss, playerTeam, battleLog, battleData.turn, enemyType);
  const updatedButtons = createBossBattleButtons();

  return interaction.update({
    content: 'Item used!',
    embeds: [updatedEmbed],
    components: [updatedButtons]
  });
}



async function handleBossInteraction(interaction, client) {
  const battleData = client.battles?.get(interaction.message.id);
  if (!battleData || battleData.userId !== interaction.user.id) {
    return interaction.reply({ content: 'This battle is not for you or has expired.', ephemeral: true });
  }

  const action = interaction.customId.split('_')[1];
  const { boss, playerTeam, battleLog, turn, stageData, currentLocation, stage } = battleData;

  if (action === 'inventory') {
    await interaction.deferUpdate();

    const user = await User.findOne({ userId: interaction.user.id });
    if (!user || !user.inventory || user.inventory.length === 0) {
      await interaction.followUp({ content: 'Your inventory is empty!', ephemeral: true });
      return;
    }

    const usableItems = user.inventory.filter(item =>
      ['healingpotion', 'statbuffer', 'speedboostfood'].includes(item.toLowerCase().replace(/\s+/g, ''))
    );

    if (usableItems.length === 0) {
      await interaction.followUp({ content: 'No usable items in battle!', ephemeral: true });
      return;
    }

    const itemButtons = new ActionRowBuilder();
    usableItems.slice(0, 5).forEach((item, index) => {
      itemButtons.addComponents(
        new ButtonBuilder()
          .setCustomId(`use_item_${item}_${index}`)
          .setLabel(item)
          .setStyle(ButtonStyle.Success)
      );
    });

    await interaction.followUp({
      content: 'Choose an item to use:',
      components: [itemButtons],
      ephemeral: true
    });
    return;
  }

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

  // Process temporary buffs
  const { processTempBuffs } = require('../utils/battleSystem.js');
  processTempBuffs(playerTeam);

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
async function handleItemUsage(interaction, client) {
  const battleData = client.battles?.get(interaction.message.id);
  if (!battleData || battleData.userId !== interaction.user.id) {
    return interaction.reply({ content: 'This battle is not for you or has expired.', ephemeral: true });
  }

  const parts = interaction.customId.split('_');
  const item = parts[2];

  const user = await User.findOne({ userId: interaction.user.id });
  if (!user || !user.inventory || !user.inventory.includes(item)) {
    return interaction.reply({ content: 'You don\'t have this item!', ephemeral: true });
  }

  let activePlayerCard;
  let playerTeam;

  // Handle different battle types
  if (battleData.type === 'duel') {
    const isPlayer1 = battleData.currentPlayer === battleData.player1.data.id;
    playerTeam = isPlayer1 ? battleData.player1.team : battleData.player2.team;
    activePlayerCard = playerTeam.find(card => card.currentHp > 0);
  } else {
    playerTeam = battleData.playerTeam;
    activePlayerCard = playerTeam.find(card => card.currentHp > 0);
  }

  if (!activePlayerCard) {
    return interaction.reply({ content: 'No active cards to use items on!', ephemeral: true });
  }

  // Apply item effects with proper healing and buffing
  let battleLog = battleData.battleLog;
  let effectApplied = false;

  switch (item.toLowerCase()) {
    case 'healingpotion':
      const healAmount = Math.floor(activePlayerCard.hp * 0.5); // Heal 50% of max HP
      const actualHeal = Math.min(healAmount, activePlayerCard.hp - activePlayerCard.currentHp);
      activePlayerCard.currentHp = Math.min(activePlayerCard.hp, activePlayerCard.currentHp + healAmount);
      battleLog.push(`💚 ${activePlayerCard.name} uses a Healing Potion and recovers ${actualHeal} HP!`);
      effectApplied = true;
      break;

    case 'statbuffer':
    case 'powerboost':
      // Apply temporary attack buff
      if (!activePlayerCard.tempBuffs) activePlayerCard.tempBuffs = [];
      activePlayerCard.tempBuffs.push({
        type: 'attack_boost',
        multiplier: 1.25,
        duration: 3 // Lasts 3 turns
      });
      battleLog.push(`⚡ ${activePlayerCard.name} uses a Power Boost! Attack increased by 25% for 3 turns!`);
      effectApplied = true;
      break;

    case 'speedboostfood':
      // Apply temporary speed buff
      if (!activePlayerCard.tempBuffs) activePlayerCard.tempBuffs = [];
      activePlayerCard.tempBuffs.push({
        type: 'speed_boost',
        multiplier: 1.5,
        duration: 3 // Lasts 3 turns
      });
      battleLog.push(`🏃 ${activePlayerCard.name} uses Speed Boost Food! Speed increased by 50% for 3 turns!`);
      effectApplied = true;
      break;

    default:
      return interaction.reply({ content: 'This item cannot be used in battle!', ephemeral: true });
  }

  if (!effectApplied) {
    return interaction.reply({ content: 'Failed to use item!', ephemeral: true });
  }

  // Remove item from inventory
  user.inventory = user.inventory.filter(i => i !== item);
  await user.save();

  battleData.battleLog = battleLog;
  client.battles.set(interaction.message.id, battleData);

  // Update embed based on battle type
  let updatedEmbed;
  let updatedButtons;

  if (battleData.type === 'duel') {
    const { player1, player2, turn, currentPlayer } = battleData;
    updatedEmbed = createDuelEmbed(player1.data, player2.data, player1.team, player2.team, battleLog, turn, currentPlayer);
    updatedButtons = createDuelButtons(currentPlayer);
  } else {
    const enemyType = battleData.stageData?.type === "boss" ? "boss" : "enemy";
    updatedEmbed = createBossBattleEmbed(battleData.boss, playerTeam, battleLog, battleData.turn, enemyType);
    updatedButtons = createBossBattleButtons();
  }

  return interaction.update({
    content: '✨ Item used successfully!',
    embeds: [updatedEmbed],
    components: [updatedButtons]
  });
}

async function endDuelBattle(interaction, battleData, client, winner) {
  try {
    const { player1, player2 } = battleData;
    const User = require('../db/models/User.js');

    // Update user stats
    const user1 = await User.findOne({ userId: player1.data.id });
    const user2 = await User.findOne({ userId: player2.data.id });

    const now = Date.now();

    if (user1) {
      user1.battleState = { inBattle: false };
      if (winner.id === user1.userId) {
        user1.wins = (user1.wins || 0) + 1;
        user1.beli = (user1.beli || 0) + 150;
      } else {
        user1.losses = (user1.losses || 0) + 1;
      }
      user1.duelCooldown = now + 10 * 60 * 1000;
      await user1.save();
    }

    if (user2) {
      user2.battleState = { inBattle: false };
      if (winner.id === user2.userId) {
        user2.wins = (user2.wins || 0) + 1;
        user2.beli = (user2.beli || 0) + 150;
      } else {
        user2.losses = (user2.losses || 0) + 1;
      }
      user2.duelCooldown = now + 10 * 60 * 1000;
      await user2.save();
    }

    // Clean up battle data
    client.battles.delete(interaction.message.id);

    // Create final embed
    const finalEmbed = createDuelEmbed(
      player1.data, 
      player2.data, 
      player1.team, 
      player2.team, 
      battleData.battleLog, 
      battleData.turn, 
      battleData.currentPlayer, 
      winner
    );

    await interaction.editReply({ embeds: [finalEmbed], components: [] });
  } catch (error) {
    console.error('Error ending duel battle:', error);
  }
}

async function handleDuelInteraction(interaction, client) {
  // Check interaction age first - Discord interactions expire after 15 minutes
  const interactionAge = Date.now() - interaction.createdTimestamp;
  if (interactionAge > 14 * 60 * 1000) {
    console.log('Duel interaction too old, cleaning up battle');
    // Clean up any existing battle data
    if (client.battles?.has(interaction.message.id)) {
      const battleData = client.battles.get(interaction.message.id);
      if (battleData?.type === 'duel') {
        try {
          const User = require('../db/models/User.js');
          const user1 = await User.findOne({ userId: battleData.player1.data.id });
          const user2 = await User.findOne({ userId: battleData.player2.data.id });

          if (user1) {
            user1.battleState = { inBattle: false };
            await user1.save();
          }
          if (user2) {
            user2.battleState = { inBattle: false };
            await user2.save();
          }
        } catch (error) {
          console.error('Error cleaning up user battle states:', error);
        }
      }
      client.battles.delete(interaction.message.id);
    }
    return;
  }

  const battleData = client.battles?.get(interaction.message.id);
  if (!battleData || battleData.type !== 'duel') {
    // Clean up and don't try to respond to expired interactions
    if (client.battles?.has(interaction.message.id)) {
      client.battles.delete(interaction.message.id);
    }
    return;
  }

  const action = interaction.customId.split('_')[1];
  const { player1, player2, battleLog, turn } = battleData;

  // Handle forfeit action BEFORE checking turns (anyone can forfeit on their turn)
  if (action === 'forfeit') {
    if (interaction.user.id !== battleData.currentPlayer) {
      if (interactionAge < 10000 && !interaction.replied && !interaction.deferred && interaction.isRepliable()) {
        try {
          await interaction.reply({ content: "It's not your turn!", ephemeral: true });
        } catch (error) {
          // Silently fail if we can't respond
        }
      }
      return;
    }

    try {
      await interaction.deferUpdate();
    } catch (error) {
      if (error.code === 10062 || error.code === 10063) {
        console.log('Forfeit interaction expired');
        if (client.battles?.has(interaction.message.id)) {
          client.battles.delete(interaction.message.id);
        }
        return;
      }
      console.error('Error deferring forfeit interaction:', error);
      return;
    }

    const isPlayer1Forfeiting = battleData.currentPlayer === player1.data.id;
    const winner = isPlayer1Forfeiting ? player2.data : player1.data;
    const winnerUser = winner.id === player1.data.id ? player1.user : player2.user;
    const loserUser = winner.id === player1.data.id ? player2.user : player1.user;

    // Update battle states
    winnerUser.battleState = { inBattle: false };
    loserUser.battleState = { inBattle: false };

    const now = Date.now();
    winnerUser.wins = (winnerUser.wins || 0) + 1;
    winnerUser.beli = (winnerUser.beli || 0) + 100;
    winnerUser.duelCooldown = now + 10 * 60 * 1000;

    loserUser.losses = (loserUser.losses || 0) + 1;
    loserUser.duelCooldown = now + 10 * 60 * 1000;

    await winnerUser.save();
    await loserUser.save();

    client.battles.delete(interaction.message.id);

    const forfeitingPlayer = isPlayer1Forfeiting ? player1.data : player2.data;
    battleLog.push(`🏳️ ${forfeitingPlayer.username} forfeited the duel!`);
    battleLog.push(`🏆 ${winner.username} wins the duel!`);

    const forfeitEmbed = createDuelEmbed(player1.data, player2.data, player1.team, player2.team, battleLog, turn, battleData.currentPlayer, winner);
    return interaction.editReply({ embeds: [forfeitEmbed], components: [] });
  }

  if (interaction.user.id !== battleData.currentPlayer) {
    // Only respond if interaction is fresh and hasn't been handled
    if (interactionAge < 10000 && !interaction.replied && !interaction.deferred && interaction.isRepliable()) {
      try {
        await interaction.reply({ content: "It's not your turn!", ephemeral: true });
      } catch (error) {
        // Silently fail if we can't respond
      }
    }
    return;
  }

  const isPlayer1Turn = battleData.currentPlayer === player1.data.id;
  const activePlayer = isPlayer1Turn ? player1 : player2;
  const enemyPlayer = isPlayer1Turn ? player2 : player1;
  const activeTeam = activePlayer.team;
  const enemyTeam = enemyPlayer.team;

  if (action === 'inventory') {
    try {
      await interaction.deferUpdate();

      const user = await User.findOne({ userId: interaction.user.id });
      if (!user || !user.inventory || user.inventory.length === 0) {
        await interaction.followUp({ content: 'Your inventory is empty!', ephemeral: true });
        return;
      }

      const usableItems = user.inventory.filter(item =>
        ['healingpotion', 'statbuffer', 'powerboost', 'speedboostfood'].includes(item.toLowerCase())
      );

      if (usableItems.length === 0) {
        await interaction.followUp({ content: 'No usable items in battle!', ephemeral: true });
        return;
      }

      const itemButtons = new ActionRowBuilder();
      usableItems.slice(0, 5).forEach((item, index) => {
        itemButtons.addComponents(
          new ButtonBuilder()
            .setCustomId(`use_item_${item}_${index}`)
            .setLabel(item.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()))
            .setStyle(ButtonStyle.Primary)
        );
      });

      await interaction.followUp({
        content: 'Choose an item to use:',
        components: [itemButtons],
        ephemeral: true
      });
      return;
    } catch (error) {
      if (error.code === 10062 || error.code === 10063) {
        console.log('Duel inventory interaction expired');
        if (client.battles?.has(interaction.message.id)) {
          client.battles.delete(interaction.message.id);
        }
        return;
      }
      console.error('Error handling duel inventory:', error);
      return;
    }
  }

  // Check battle end conditions
  const activeCard = activeTeam.find(card => card.currentHp > 0);
  const enemyCard = enemyTeam.find(card => card.currentHp > 0);

  if (!activeCard || !enemyCard) {
    const winner = enemyCard ? enemyPlayer.data : activePlayer.data;
    const winnerUser = winner.id === player1.data.id ? player1.user : player2.user;
    const loserUser = winner.id === player1.data.id ? player2.user : player1.user;

    // Apply rewards and cooldowns
    const now = Date.now();
    winnerUser.wins = (winnerUser.wins || 0) + 1;
    winnerUser.beli = (winnerUser.beli || 0) + 150;
    winnerUser.xp = (winnerUser.xp || 0) + 50;
    winnerUser.duelCooldown = now + 10 * 60 * 1000;
    
    // Update quest progress for battle wins
    const { updateQuestProgress } = require('../utils/questSystem.js');
    await updateQuestProgress(winnerUser, 'battle_win', 1);

    loserUser.losses = (loserUser.losses || 0) + 1;
    loserUser.duelCooldown = now + 10 * 60 * 1000;

    await winnerUser.save();
    await loserUser.save();

    client.battles.delete(interaction.message.id);

    battleLog.push(`🏆 ${winner.username} wins the duel!`);
    const winEmbed = createDuelEmbed(player1.data, player2.data, player1.team, player2.team, battleLog, turn, battleData.currentPlayer, winner);
    return interaction.update({ embeds: [winEmbed], components: [] });
  }

  // Handle interaction response more carefully
  if (action !== 'inventory') {
    try {
      // Check if interaction is still valid
      if (!interaction.isRepliable() || interaction.replied || interaction.deferred || interactionAge > 10000) {
        return;
      }

      // Try to defer the update
      await interaction.deferUpdate();
    } catch (error) {
      // If we can't defer, don't continue processing
      if (error.code === 10062 || error.code === 10063) {
        // Clean up battle if interaction is expired
        if (client.battles?.has(interaction.message.id)) {
          const { endDuel } = require('../commands/duel.js');
          await endDuel(interaction.message.id, client, 'expired');
        }
      }
      return;
    }
  }

  let damage = 0;
  const { calculateDamage } = require('../utils/battleSystem.js');

  switch (action) {
    case 'attack':
      damage = calculateDamage(activeCard, enemyCard, 'normal');
      enemyCard.currentHp = Math.max(0, enemyCard.currentHp - damage);
      battleLog.push(`⚔️ ${activeCard.name} attacks ${enemyCard.name} for ${damage} damage!`);
      if (enemyCard.currentHp <= 0) {
        battleLog.push(`💀 ${enemyCard.name} has been knocked out!`);

        // Check if enemy team is completely defeated
        const remainingEnemyCards = enemyTeam.filter(card => card.currentHp > 0);
        if (remainingEnemyCards.length === 0) {
          battleLog.push(`🏆 ${activePlayer.data.username} wins the duel!`);
          await endDuelBattle(interaction, battleData, client, activePlayer.data);          return;
        }
      }
      break;

    case 'defend':
      const healAmount = Math.floor(activeCard.hp * 0.2);
      const actualHeal = Math.min(healAmount, activeCard.hp - activeCard.currentHp);
      activeCard.currentHp = Math.min(activeCard.hp, activeCard.currentHp + healAmount);
      battleLog.push(`🛡️ ${activeCard.name} defends and recovers ${actualHeal} HP!`);
      break;

    // Forfeit is now handled above before turn checking
  }

  // Process temporary buffs
  const { processTempBuffs } = require('../utils/battleSystem.js');
  processTempBuffs(activeTeam);
  processTempBuffs(enemyTeam);

  // Switch turns
  battleData.currentPlayer = battleData.currentPlayer === player1.data.id ? player2.data.id : player1.data.id;
  battleData.turn = turn + 1;
  battleData.battleLog = battleLog;

  client.battles.set(interaction.message.id, battleData);

  const updatedEmbed = createDuelEmbed(player1.data, player2.data, player1.team, player2.team, battleLog, battleData.turn, battleData.currentPlayer);
  const updatedButtons = createDuelButtons(battleData.currentPlayer);

  await interaction.editReply({ embeds: [updatedEmbed], components: [updatedButtons] });
}