const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { calculateDamage, getActiveCard, resetTeamHP } = require('../utils/battleSystem.js');
const { updateQuestProgress } = require('../utils/questSystem');

// Boss battle functions
function createBossBattleEmbed(boss, playerTeam, battleLog, turn, enemyType = "enemy", allEnemies = null) {
  let battleTitle = "Battle";
  if (enemyType === "boss") battleTitle = "Boss Battle";
  else if (enemyType === "multi_enemy") battleTitle = "Multi-Enemy Battle";

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ ${battleTitle}`)
    .setDescription(`${battleLog.slice(-4).join('\n') || 'Battle begins!'}`)
    .setColor(0xff0000);

  const teamDisplay = playerTeam.filter(card => card.currentHp > 0).map(card => {
    const cardHpBar = createHpBar(card.currentHp, card.hp);
    return `${card.name} ${cardHpBar} ${card.currentHp}/${card.hp}`;
  }).join('\n') || 'No cards available';

  if (enemyType === "multi_enemy" && allEnemies) {
    const enemyDisplay = allEnemies.filter(enemy => enemy.currentHp > 0).map(enemy => {
      const hpBar = createHpBar(enemy.currentHp, enemy.maxHp);
      return `${enemy.name} ${hpBar} ${enemy.currentHp}/${enemy.maxHp}`;
    }).join('\n') || 'All enemies defeated';

    embed.addFields(
      { name: '👹 Enemies', value: enemyDisplay, inline: true },
      { name: '🛡️ Your Team', value: teamDisplay, inline: true }
    );
  } else {
    const hpBar = createHpBar(boss.currentHp, boss.maxHp);
    embed.addFields(
      { name: `🔥 ${boss.name} HP`, value: `${hpBar} ${boss.currentHp}/${boss.maxHp}`, inline: true },
      { name: '⚡ Attack Power', value: `${boss.attack[0]}-${boss.attack[1]}`, inline: true },
      { name: '🛡️ Your Team', value: teamDisplay, inline: false }
    );
  }

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
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error('Error executing slash command:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    }
    return;
  }

  if (!interaction.isButton() && !interaction.isSelectMenu()) return;

  if (interaction.customId.startsWith('boss_')) {
    await handleBossInteraction(interaction, client);
    return;
  }

    if (interaction.customId.startsWith('battle_item_')) {
        await handleBattleItemInteraction(interaction, client);
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

  if (interaction.customId === 'duel_accept' || interaction.customId === 'duel_decline') {
    const challengeData = client.duelChallenges?.get(interaction.message.id);

    if (!challengeData) {
      return interaction.reply({ content: 'This challenge has expired!', ephemeral: true });
    }

    if (interaction.user.id !== challengeData.opponentId) {
      return interaction.reply({ content: 'This challenge is not for you!', ephemeral: true });
    }

    if (interaction.customId === 'duel_decline') {
      client.duelChallenges.delete(interaction.message.id);
      return interaction.update({
        content: '❌ Duel declined!',
        embeds: [interaction.message.embeds[0].setColor(0xe74c3c)],
        components: []
      });
    }

    // Accept duel - start battle
    await interaction.deferUpdate();

    const player1 = {
      data: challengeData.challengerUser,
      team: challengeData.challengerTeam,
      username: (await client.users.fetch(challengeData.challengerId)).username,
      user: await User.findOne({ userId: challengeData.challengerId })
    };

    const player2 = {
      data: challengeData.opponentUser,
      team: challengeData.opponentTeam,
      username: interaction.user.username,
      user: await User.findOne({ userId: interaction.user.id })
    };

    // Determine turn order by speed
    const { calculateTurnOrder } = require('../utils/battleSystem.js');
    const turnOrder = calculateTurnOrder(player1.team, player2.team);
    const currentPlayer = turnOrder[0].name === player1.team.find(c => c.name === turnOrder[0].name)?.name ? 
      challengeData.challengerId : challengeData.opponentId;

    const { createDuelEmbed, createDuelButtons } = require('../commands/duel.js');
    const battleEmbed = createDuelEmbed(player1, player2, [], 1);
    const battleButtons = createDuelButtons();

    await interaction.editReply({
      content: `⚔️ Duel begins! <@${currentPlayer}> goes first!`,
      embeds: [battleEmbed],
      components: [battleButtons]
    });

    // Store battle data
    const battleData = {
      type: 'duel',
      player1,
      player2,
      currentPlayer,
      battleLog: [],
      turn: 1
    };

    if (!client.battles) client.battles = new Map();
    client.battles.set(interaction.message.id, battleData);

    // Clean up challenge and set timeout for battle
    client.duelChallenges.delete(interaction.message.id);

    setTimeout(() => {
      if (client.battles?.has(interaction.message.id)) {
        client.battles.delete(interaction.message.id);
      }
    }, 10 * 60 * 1000);

    return;
  }

  if (interaction.customId.startsWith('duel_')) {
    const battleData = client.battles?.get(interaction.message.id);

    if (!battleData || battleData.type !== 'duel') {
      return interaction.reply({ content: 'This battle is not available!', ephemeral: true });
    }

    if (interaction.user.id !== battleData.currentPlayer) {
      return interaction.reply({ content: 'It\'s not your turn!', ephemeral: true });
    }

    await interaction.deferUpdate();

    const isPlayer1 = battleData.currentPlayer === battleData.player1.data.userId;
    const activePlayer = isPlayer1 ? battleData.player1 : battleData.player2;
    const enemyPlayer = isPlayer1 ? battleData.player2 : battleData.player1;

    const action = interaction.customId.split('_')[1];
    const { battleLog } = battleData;

    // Get active cards
    const { getActiveCard, teamCanFight, calculateDamage, processTempBuffs } = require('../utils/battleSystem.js');
    const activeCard = getActiveCard(activePlayer.team);
    const enemyCard = getActiveCard(enemyPlayer.team);

    if (!activeCard) {
      return interaction.reply({ content: 'You have no cards that can fight!', ephemeral: true });
    }

    if (!enemyCard) {
      return interaction.reply({ content: 'Enemy has no cards that can fight!', ephemeral: true });
    }

    let damage = 0;

    switch (action) {
      case 'attack':
        damage = calculateDamage(activeCard, enemyCard, 'normal');
        enemyCard.currentHp = Math.max(0, enemyCard.currentHp - damage);
        battleLog.push(`⚔️ ${activeCard.name} attacks ${enemyCard.name} for ${damage} damage!`);
        if (enemyCard.currentHp <= 0) {
          battleLog.push(`💀 ${enemyCard.name} has been knocked out!`);
        }
        break;

      case 'defend':
        const healAmount = Math.floor(activeCard.hp * 0.2);
        activeCard.currentHp = Math.min(activeCard.hp, activeCard.currentHp + healAmount);
        battleLog.push(`🛡️ ${activeCard.name} defends and recovers ${healAmount} HP!`);
        break;

      case 'forfeit':
        const winner = enemyPlayer.data;
        const winnerUser = winner.id === battleData.player1.data.userId ? battleData.player1.user : battleData.player2.user;
        const loserUser = winner.id === battleData.player1.data.userId ? battleData.player2.user : battleData.player1.user;

        const now = Date.now();
        winnerUser.wins = (winnerUser.wins || 0) + 1;
        winnerUser.beli = (winnerUser.beli || 0) + 100;
        winnerUser.duelCooldown = now + 10 * 60 * 1000;

        loserUser.losses = (loserUser.losses || 0) + 1;
        loserUser.duelCooldown = now + 10 * 60 * 1000;

        await winnerUser.save();
        await loserUser.save();

        client.battles.delete(interaction.message.id);

        battleLog.push(`🏳️ ${activePlayer.data.username} forfeited the duel!`);
        const { createDuelEmbed } = require('../commands/duel.js');
        const forfeitEmbed = createDuelEmbed(battleData.player1, battleData.player2, battleLog, battleData.turn, battleData.currentPlayer, winner);
        return interaction.editReply({ embeds: [forfeitEmbed], components: [] });

      case 'inventory':
        await handleDuelInventory(interaction, battleData, activeCard);
        return;
    }

    // Process temporary buffs
    processTempBuffs([activeCard, enemyCard]);

    // Check for battle end
    if (!teamCanFight(activePlayer.team)) {
      // Current player lost
      const winner = enemyPlayer.data;
      const loser = activePlayer.data;

      const now = Date.now();
      const winnerUser = winner.id === battleData.player1.data.userId ? battleData.player1.user : battleData.player2.user;
      const loserUser = winner.id === battleData.player1.data.userId ? battleData.player2.user : battleData.player1.user;

      winnerUser.wins = (winnerUser.wins || 0) + 1;
      winnerUser.beli = (winnerUser.beli || 0) + 200;
      winnerUser.duelCooldown = now + 10 * 60 * 1000;

      loserUser.losses = (loserUser.losses || 0) + 1;
      loserUser.duelCooldown = now + 10 * 60 * 1000;

      await winnerUser.save();
      await loserUser.save();

      client.battles.delete(interaction.message.id);

      battleLog.push(`🏆 ${winner.username} wins the duel!`);
      const { createDuelEmbed } = require('../commands/duel.js');
      const winEmbed = createDuelEmbed(battleData.player1, battleData.player2, battleLog, battleData.turn, battleData.currentPlayer, winner);
      return interaction.editReply({ embeds: [winEmbed], components: [] });
    }

    if (!teamCanFight(enemyPlayer.team)) {
      // Enemy lost
      const winner = activePlayer.data;
      const loser = enemyPlayer.data;

      const now = Date.now();
      const winnerUser = winner.id === battleData.player1.data.userId ? battleData.player1.user : battleData.player2.user;
      const loserUser = winner.id === battleData.player1.data.userId ? battleData.player2.user : battleData.player1.user;

      winnerUser.wins = (winnerUser.wins || 0) + 1;
      winnerUser.beli = (winnerUser.beli || 0) + 200;
      winnerUser.duelCooldown = now + 10 * 60 * 1000;

      loserUser.losses = (loserUser.losses || 0) + 1;
      loserUser.duelCooldown = now + 10 * 60 * 1000;

      await winnerUser.save();
      await loserUser.save();

      client.battles.delete(interaction.message.id);

      battleLog.push(`🏆 ${winner.username} wins the duel!`);
      const { createDuelEmbed } = require('../commands/duel.js');
      const winEmbed = createDuelEmbed(battleData.player1, battleData.player2, battleLog, battleData.turn, battleData.currentPlayer, winner);
      return interaction.editReply({ embeds: [winEmbed], components: [] });
    }

    // Switch turns
    battleData.currentPlayer = battleData.currentPlayer === battleData.player1.data.userId ? 
      battleData.player2.data.userId : battleData.player1.data.userId;
    battleData.turn++;

    // Update battle display
    const { createDuelEmbed, createDuelButtons } = require('../commands/duel.js');
    const updatedEmbed = createDuelEmbed(battleData.player1, battleData.player2, battleLog, battleData.turn, battleData.currentPlayer);
    const updatedButtons = createDuelButtons();

   await interaction.editReply({
      content: `⚔️ <@${battleData.currentPlayer}>'s turn!`,
      embeds: [updatedEmbed],
      components: [updatedButtons]
    });

    return;
  }

  async function handleDuelInventory(interaction, battleData, activeCard) {

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
  }

  if (interaction.customId.startsWith('use_item_')) {
      await handleItemUsage(interaction, client);
      return;
  }
}

async function handleItemUsage(interaction, client) {
    const parts = interaction.customId.split('_');
    const item = parts[2];

    // Check if this is a duel battle
    const battleData = client.battles?.get(interaction.message.id);
    if (battleData && battleData.type === 'duel') {
        // Handle duel item usage
        const isPlayer1 = interaction.user.id === battleData.player1.data.userId;
        const activePlayer = isPlayer1 ? battleData.player1 : battleData.player2;
        const activeCard = getActiveCard(activePlayer.team);

        if (!activeCard) {
            return interaction.reply({ content: 'No active cards available!', ephemeral: true });
        }

        const user = await User.findOne({ userId: interaction.user.id });
        if (!user || !user.inventory || !user.inventory.includes(item)) {
            return interaction.reply({ content: 'You do not have this item.', ephemeral: true });
        }

        // Apply item effects
        let effectText = '';
        switch (item.toLowerCase()) {
            case 'healingpotion':
                const healAmount = Math.floor(activeCard.hp * 0.5);
                activeCard.currentHp = Math.min(activeCard.hp, activeCard.currentHp + healAmount);
                effectText = `${activeCard.name} healed ${healAmount} HP!`;
                break;

            case 'statbuffer':
                if (!activeCard.tempBuffs) activeCard.tempBuffs = [];
                activeCard.tempBuffs.push({
                    type: 'stat_boost',
                    multiplier: 1.5,
                    duration: 3
                });
                effectText = `${activeCard.name} gained a stat boost for 3 turns!`;
                break;

            case 'speedboostfood':
                if (!activeCard.tempBuffs) activeCard.tempBuffs = [];
                activeCard.tempBuffs.push({
                    type: 'speed_boost',
                    multiplier: 1.8,
                    duration: 3
                });
                effectText = `${activeCard.name} gained a speed boost for 3 turns!`;
                break;

            default:
                return interaction.reply({ content: 'Unknown item!', ephemeral: true });
        }

        // Remove item from inventory
        const itemIndex = user.inventory.indexOf(item);
        if (itemIndex > -1) {
            user.inventory.splice(itemIndex, 1);
            await user.save();
        }

        // Add to battle log
        battleData.battleLog.push(`🧪 ${effectText}`);

        // Update duel display
        const { createDuelEmbed, createDuelButtons } = require('../commands/duel.js');
        const updatedEmbed = createDuelEmbed(battleData.player1, battleData.player2, battleData.battleLog, battleData.turn, battleData.currentPlayer);
        const updatedButtons = createDuelButtons();

        return interaction.update({
            content: `✅ Used ${item}! ${effectText}`,
            embeds: [updatedEmbed],
            components: [updatedButtons]
        });
    }

    // Handle boss battle item usage (existing code)
    if (!battleData || battleData.userId !== interaction.user.id) {
        return interaction.reply({ content: 'This battle is not for you or has expired.', ephemeral: true });
    }

    const { playerTeam } = battleData;
    const activePlayerCard = getActiveCard(playerTeam);

    const user = await User.findOne({ userId: interaction.user.id });

    if (!user || !user.inventory || !user.inventory.includes(item)) {
        return interaction.reply({ content: 'You do not have this item.', ephemeral: true });
    }

    if (!activePlayerCard) {
        return interaction.reply({ content: 'No active cards available!', ephemeral: true });
    }

    // Apply item effects
    let effectText = '';
    switch (item.toLowerCase()) {
        case 'healingpotion':
            const healAmount = Math.floor(activePlayerCard.hp * 0.5);
            activePlayerCard.currentHp = Math.min(activePlayerCard.hp, activePlayerCard.currentHp + healAmount);
            effectText = `${activePlayerCard.name} healed ${healAmount} HP!`;
            break;

        case 'statbuffer':
            if (!activePlayerCard.tempBuffs) activePlayerCard.tempBuffs = [];
            activePlayerCard.tempBuffs.push({
                type: 'stat_boost',
                multiplier: 1.5,
                duration: 3
            });
            effectText = `${activePlayerCard.name} gained a stat boost for 3 turns!`;
            break;

        case 'speedboostfood':
            if (!activePlayerCard.tempBuffs) activePlayerCard.tempBuffs = [];
            activePlayerCard.tempBuffs.push({
                type: 'speed_boost',
                multiplier: 1.8,
                duration: 3
            });
            effectText = `${activePlayerCard.name} gained a speed boost for 3 turns!`;
            break;

        default:
            return interaction.reply({ content: 'Unknown item!', ephemeral: true });
    }

    // Remove item from inventory
    const itemIndex = user.inventory.indexOf(item);
    if (itemIndex > -1) {
        user.inventory.splice(itemIndex, 1);
        await user.save();
    }

    // Add to battle log
    if (battleData.battleLog) {
        battleData.battleLog.push(`🧪 ${effectText}`);
    }

    const enemyType = battleData.stageData.type === "boss" ? "boss" : "enemy";
    const updatedEmbed = createBossBattleEmbed(battleData.boss, playerTeam, battleData.battleLog, battleData.turn, enemyType);
    const updatedButtons = createBossBattleButtons();

    return interaction.update({
        content: `✅ Used ${item}! ${effectText}`,
        embeds: [updatedEmbed],
        components: [updatedButtons]
    });
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
    // Allow duplicate cards
    user.cards.push({
      name: reward.name,
      rank: reward.rank,
      timesUpgraded: 0
    });
    rewardText = `🎴 You obtained **${reward.name}** (${reward.rank} rank)!`;
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
                .setCustomId(`battle_item_${item}_${index}`)
                .setLabel(item)
                .setStyle(ButtonStyle.Success)
            );
          });

          itemButtons.addComponents(
            new ButtonBuilder()
              .setCustomId(`battle_item_cancel`)
              .setLabel('Cancel')
              .setStyle(ButtonStyle.Danger)
          );

          await interaction.followUp({ 
            content: 'Choose an item to use:', 
            components: [itemButtons], 
            ephemeral: true 
          });
          return;
        }

  if (battleData.enemies && battleData.enemies.length > 0) {
    if (battleData.enemies.every(enemy => enemy.currentHp <= 0) || playerTeam.every(card => card.currentHp <= 0)) {
      return interaction.reply({ content: 'This battle has already ended.', ephemeral: true });
    }
  } else {
    if (boss.currentHp <= 0 || playerTeam.every(card => card.currentHp <= 0)) {
      return interaction.reply({ content: 'This battle has already ended.', ephemeral: true });
    }
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
  const { getActiveCard, calculateDamage } = require('../utils/battleSystem.js');
  let activeCard = getActiveCard(playerTeam);

  if (!activeCard) {
    return interaction.reply({ content: 'No active cards available to fight!', ephemeral: true });
  }

  switch (action) {
    case 'attack':
        if (battleData.enemies && battleData.enemies.length > 0) {
          // Multi-enemy battle - attack first alive enemy
          const targetEnemy = battleData.enemies.find(enemy => enemy.currentHp > 0);
          if (targetEnemy) {
            damage = calculateDamage(activeCard, targetEnemy, 'normal');
            targetEnemy.currentHp = Math.max(0, targetEnemy.currentHp - damage);
            battleLog.push(`⚔️ ${activeCard.name} attacks ${targetEnemy.name} for ${damage} damage!`);
            if (targetEnemy.currentHp <= 0) {
              battleLog.push(`💀 ${targetEnemy.name} has been defeated!`);
            }
          }
        } else {
          // Single enemy battle
          damage = calculateDamage(activeCard, boss, 'normal');
          boss.currentHp = Math.max(0, boss.currentHp - damage);
          battleLog.push(`⚔️ ${activeCard.name} attacks ${boss.name} for ${damage} damage!`);
          if (boss.currentHp <= 0) {
            battleLog.push(`💀 ${boss.name} has been defeated!`);
          }
        }
        break;

    case 'skill':
      damage = calculateDamage(activeCard, boss, 'skill');
      boss.currentHp = Math.max(0, boss.currentHp - damage);
      playerAction = `${activeCard.name} uses special attack on ${boss.name} for ${damage} damage!`;
      break;

    case 'defend': {
      const healAmount = Math.floor(activeCard.hp * 0.2);
      activeCard.currentHp = Math.min(activeCard.hp, activeCard.currentHp + healAmount);
      playerAction = `${activeCard.name} defends and recovers ${healAmount} HP!`;
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

        // Check for victory
        const allEnemiesDefeated = battleData.enemies && battleData.enemies.length > 0 ? 
          battleData.enemies.every(enemy => enemy.currentHp <= 0) : 
          boss.currentHp <= 0;

  if (allEnemiesDefeated) {
          // Player wins
          let user = await User.findOne({ userId: interaction.user.id });
          let winMessage = `🎉 You emerged victorious against ${boss.name}! 🎉`;

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
              winMessage += '\n\n🏆 **Level Ups!** 🚀\n';
              user.recentLevelUps.forEach(change => {
                winMessage += `🌟 ${change.name}: Level ${change.oldLevel} ➡️ ${change.newLevel} 🌟\n`;
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
        if (battleData.enemies && battleData.enemies.length > 0) {
          // Multi-enemy battle - all alive enemies attack
          const aliveEnemies = battleData.enemies.filter(enemy => enemy.currentHp > 0);
          aliveEnemies.forEach(enemy => {
            if (activeCard && activeCard.currentHp > 0) {
              const enemyDamage = Math.floor(Math.random() * (enemy.attack[1] - enemy.attack[0] + 1)) + enemy.attack[0];
              activeCard.currentHp = Math.max(0, activeCard.currentHp - enemyDamage);
              battleLog.push(`💀 ${enemy.name} attacks ${activeCard.name} for ${enemyDamage} damage!`);

              if (activeCard.currentHp <= 0) {
                battleLog.push(`💀 ${activeCard.name} has been knocked out!`);
                // Get next active card if current one died
                activeCard = getActiveCard(playerTeam);
              }
            }
          });
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
        }

          battleData.battleLog = battleLog;
          battleData.turn = turn + 1;

          const enemyType = stageData.type === "boss" ? "boss" : (stageData.type === "multi_enemy" ? "multi_enemy" : "enemy");
          const updatedEmbed = createBossBattleEmbed(boss, playerTeam, battleLog, battleData.turn, enemyType, battleData.enemies);
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