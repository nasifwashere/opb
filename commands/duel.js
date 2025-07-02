const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder  } = require('discord.js');
const User = require('../db/models/User.js');
const { calculateBattleStats } = require('../utils/battleSystem.js');
const path = require('path');

const DUEL_COOLDOWN = 10 * 60 * 1000; // 10 minutes

async function cleanupStaleBattleState(user) {
  if (!user.battleState?.inBattle) return;

  // Check if battle state is older than 30 minutes (stale)
  const battleAge = Date.now() - (user.battleState.lastActivity || 0);
  if (battleAge > 30 * 60 * 1000) {
    console.log(`Cleaning up stale battle state for user ${user.userId}`);
    user.battleState = { inBattle: false };
    await user.save();
  }
}

function prettyTime(ms) {
  let seconds = Math.floor(ms / 1000);
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);
  minutes = minutes % 60;
  seconds = seconds % 60;
  let out = [];
  if (hours > 0) out.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (minutes > 0) out.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
  if (out.length === 0) out.push(`${seconds} second${seconds !== 1 ? "s" : ""}`);
  return out.join(", ");
}

function createHpBar(current, max) {
  const percentage = Math.max(0, current / max);
  const barLength = 10;
  const filledBars = Math.round(percentage * barLength);
  const emptyBars = barLength - filledBars;
  return '█'.repeat(filledBars) + '░'.repeat(emptyBars);
}

function createEnhancedHealthBar(current, max) {
  const percentage = Math.max(0, current / max);
  const barLength = 15;
  const filledBars = Math.round(percentage * barLength);
  const emptyBars = barLength - filledBars;
  
  // Use different colors based on health percentage
  let healthEmoji;
  let barColor;
  if (percentage > 0.6) {
    healthEmoji = '🟢';
    barColor = '🟩';
  } else if (percentage > 0.3) {
    healthEmoji = '🟡';
    barColor = '🟨';
  } else {
    healthEmoji = '🔴';
    barColor = '🟥';
  }
  
  const healthBar = barColor.repeat(filledBars) + '⬛'.repeat(emptyBars);
  return `${healthEmoji} ${healthBar} ${current}/${max}`;
}

function createTeamDisplay(team, teamName) {
  if (!team || team.length === 0) {
    return `**═══${teamName}'s Team═══**\n*No active cards*`;
  }
  
  let display = `**═══${teamName}'s Team═══**\n`;
  
  team.filter(card => card.currentHp > 0).forEach((card, index) => {
    const healthBar = createEnhancedHealthBar(card.currentHp, card.hp);
    const level = card.level || 1;
    const rank = card.rank || 'C';
    
    display += `\n🔸 **${card.name}** | Lv. ${level} **${rank}**\n`;
    display += `${healthBar}\n`;
    
    const power = card.power || card.atk || 100;
    const speed = card.speed || card.spd || 50;
    display += `⚔️ ${power} PWR • ❤️ ${card.hp} HP • ⚡ ${speed} SPD\n`;
  });
  
  return display;
}

function createDuelEmbed(player1, player2, player1Team, player2Team, battleLog, turn, currentPlayerId, winner = null) {
  let description = `**${player1.username}** vs **${player2.username}**\n\n`;

  if (winner) {
    description += `🏆 **${winner.username}** wins the duel!\n\n`;
  } else {
    const currentPlayerName = currentPlayerId === player1.id ? player1.username : player2.username;
    description += `**Turn:** ${turn} | **Current Player:** ${currentPlayerName}\n\n`;
  }

  // Add recent battle log
  if (battleLog && battleLog.length > 0) {
    description += `**═══Battle Log═══**\n`;
    description += battleLog.slice(-3).join('\n') + '\n\n';
  }

  const embed = new EmbedBuilder()
    .setTitle('⚔️ PvP Team Battle')
    .setDescription(description)
    .setColor(winner ? 0x2ecc71 : 0x3498db)
    .setFooter({ text: 'Use the buttons below to take action.' });

  // Use enhanced team displays
  const team1Display = createTeamDisplay(player1Team, player1.username);
  const team2Display = createTeamDisplay(player2Team, player2.username);

  // Add total team power
  const team1Power = player1Team.filter(c => c.currentHp > 0).reduce((sum, card) => sum + (card.power || card.atk || 100), 0);
  const team2Power = player2Team.filter(c => c.currentHp > 0).reduce((sum, card) => sum + (card.power || card.atk || 100), 0);

  embed.addFields(
    { 
      name: `${player1.username}'s Team (${team1Power} Total PWR)`, 
      value: team1Display, 
      inline: false 
    },
    { 
      name: `${player2.username}'s Team (${team2Power} Total PWR)`, 
      value: team2Display, 
      inline: false 
    }
  );

  return embed;
}

function createDuelButtons(currentPlayerId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('duel_attack')
      .setLabel('Attack')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('duel_defend')
      .setLabel('Defend')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('duel_inventory')
      .setLabel('Items')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('duel_forfeit')
      .setLabel('Forfeit')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled)
  );
}

const data = new SlashCommandBuilder()
  .setName('duel')
  .setDescription('Challenge another player to a PvP duel.');

async function execute(message, args) {
  const userId = message.author.id;
  let user = await User.findOne({ userId });

  if (!user) return message.reply('Start your journey with `op start` first!');

  const mentionedUser = message.mentions.users.first();
  if (!mentionedUser) {
    return message.reply('❌ You need to mention a player to duel! Usage: `op duel @player`');
  }

  if (mentionedUser.id === userId) {
    return message.reply('❌ You cannot duel yourself!');
  }

  if (mentionedUser.bot) {
    return message.reply('❌ You cannot duel bots!');
  }

  let opponent = await User.findOne({ userId: mentionedUser.id });
  if (!opponent) {
    return message.reply('❌ That player hasn\'t started their journey yet!');
  }

  // Clean up any stale battle states first
  await cleanupStaleBattleState(user);
  await cleanupStaleBattleState(opponent);

  // Check if either player is already in a duel
  if (user.battleState?.inBattle) {
    return message.reply('❌ You are already in a battle!');
  }

  if (opponent.battleState?.inBattle) {
    return message.reply('❌ That player is already in a battle!');
  }

  // Check if both players have teams
  if (!user.team || user.team.length === 0) {
    return message.reply('❌ You need to set up your team first! Use `op team add <card name>`');
  }

  if (!opponent.team || opponent.team.length === 0) {
    return message.reply('❌ Your opponent doesn\'t have a team set up!');
  }

  // Create duel confirmation
  const embed = new EmbedBuilder()
    .setTitle('⚔️ Duel Challenge!')
    .setDescription(`${message.author.username} challenges ${mentionedUser.username} to a duel!\n\n${mentionedUser.username}, do you accept this challenge?`)
    .setColor(0xff6b35);

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('duel_accept')
        .setLabel('Accept Duel')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('duel_decline')
        .setLabel('Decline')
        .setStyle(ButtonStyle.Danger)
    );

  const duelMessage = await message.reply({ embeds: [embed], components: [row] });

  const filter = i => i.user.id === mentionedUser.id && ['duel_accept', 'duel_decline'].includes(i.customId);
  const collector = duelMessage.createMessageComponentCollector({ filter, time: 30000 });

  collector.on('collect', async interaction => {
    try {
      // Check if interaction is still valid
      if (!interaction.isRepliable() || interaction.replied || interaction.deferred) {
        console.log('Duel acceptance interaction expired');
        collector.stop();
        return;
      }

      if (interaction.customId === 'duel_accept') {
        await interaction.deferUpdate();

        // Refresh user data to prevent conflicts
        user = await User.findOne({ userId });
        opponent = await User.findOne({ userId: mentionedUser.id });

        // Double-check that both players can still duel
        if (user.battleState.inBattle || opponent.battleState.inBattle) {
          return interaction.followUp({ 
            content: 'One of the players is already in battle!', 
            ephemeral: true 
          });
        }

        collector.stop(); // Stop collector before starting duel
        await startDuel(message, user, opponent, message.author, mentionedUser, duelMessage);
      } else {
        await interaction.update({
          content: `${mentionedUser.username} declined the duel challenge.`,
          embeds: [],
          components: []
        });
        collector.stop();
      }
    } catch (error) {
      console.error('Duel interaction error:', error.code, error.message);
      // Clean up on any error
      collector.stop();

      // Only try to respond to valid, fresh interactions
      if (error.code !== 10062 && error.code !== 10063 && 
          !interaction.replied && !interaction.deferred &&
          Date.now() - interaction.createdTimestamp < 30000) {
        try {
          await interaction.reply({ 
            content: 'An error occurred while processing the duel request.', 
            ephemeral: true 
          });
        } catch (followUpError) {
          console.log('Could not send error response:', followUpError.message);
        }
      }
    }
  });

  collector.on('end', (collected, reason) => {
    if (collected.size === 0 && reason === 'time') {
      duelMessage.edit({
        content: 'Duel challenge expired.',
        embeds: [],
        components: []
      }).catch(() => {});
    }
  });
}

async function startDuel(message, user, opponent, challenger, challenged, duelMessage) {
  try {
    // Initialize battle states
    const { calculateCardStats } = require('../utils/levelSystem.js');
    const fs = require('fs');

    // Load cards data
    const cardsPath = path.resolve('data', 'cards.json');
    const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

    // Get first cards from teams
    const userCard = user.cards.find(c => c.name === user.team[0]);
    const opponentCard = opponent.cards.find(c => c.name === opponent.team[0]);

    if (!userCard || !opponentCard) {
      return message.reply('❌ Error finding team cards!');
    }

    // Get card definitions
    const userCardDef = allCards.find(c => c.name === userCard.name);
    const opponentCardDef = allCards.find(c => c.name === opponentCard.name);

    if (!userCardDef || !opponentCardDef) {
      return message.reply('❌ Error finding card definitions!');
    }

    // Set up battle teams with all team members using proper card definitions
    const { calculateBattleStats } = require('../utils/battleSystem.js');
    const player1Team = calculateBattleStats(user, allCards);
    const player2Team = calculateBattleStats(opponent, allCards);

    // Ensure teams have cards
    if (player1Team.length === 0 || player2Team.length === 0) {
      return message.reply('❌ Error setting up battle teams!');
    }

    const battleLog = [`⚔️ ${challenger.username} vs ${challenged.username} - Team Battle!`];

    // Set battle states for both users
    const now = Date.now();
    user.battleState = {
      inBattle: true,
      lastActivity: now,
      isDuel: true,
      opponent: challenged.username
    };

    opponent.battleState = {
      inBattle: true,
      lastActivity: now,
      isDuel: true,
      opponent: challenger.username
    };

    await user.save();
    await opponent.save();

    // Create battle embed
    const battleEmbed = createDuelEmbed(
      challenger, 
      challenged, 
      player1Team, 
      player2Team, 
      battleLog, 
      1, 
      challenger.id
    );

    const battleRow = createDuelButtons(challenger.id);
    const battleMessage = await duelMessage.edit({ embeds: [battleEmbed], components: [battleRow] });

    // Start battle loop
    await handleDuelBattle(battleMessage, user, opponent, challenger, challenged, player1Team, player2Team);
  } catch (error) {
    console.error('Error starting duel:', error);
    await message.reply('❌ An error occurred while starting the duel!');
  }
}

async function handleDuelBattle(battleMessage, user, opponent, challenger, challenged, player1Team, player2Team) {
  try {
    // Get client from the message's client property
    const client = battleMessage.client;

    if (!client.battles) client.battles = new Map();

    const battleData = {
      type: 'duel',
      messageId: battleMessage.id,
      channelId: battleMessage.channel.id,
      player1: {
        data: challenger,
        user: user,
        team: player1Team
      },
      player2: {
        data: challenged,
        user: opponent,
        team: player2Team
      },
      currentPlayer: challenger.id,
      turn: 1,
      battleLog: [`⚔️ Team Battle: ${challenger.username} vs ${challenged.username}!`],
      startTime: Date.now()
    };

    client.battles.set(battleMessage.id, battleData);

    // Set up battle interaction collector with shorter timeout
    const filter = i => ['duel_attack', 'duel_defend', 'duel_inventory', 'duel_forfeit'].includes(i.customId);
    const collector = battleMessage.createMessageComponentCollector({ filter, time: 180000 }); // 3 minutes

    collector.on('collect', async interaction => {
      // Don't handle interactions here - let interactionCreate.js handle them
      // This prevents duplicate handling and timing conflicts
      
      // Just check if battle still exists and is valid
      if (!client.battles.has(battleMessage.id)) {
        collector.stop();
        return;
      }

      // Check for very old interactions (shouldn't happen but safety check)
      const interactionAge = Date.now() - interaction.createdTimestamp;
      if (interactionAge > 60000) { // 1 minute is too old
        await endDuel(battleMessage.id, client, 'expired');
        collector.stop();
        return;
      }
    });

    collector.on('end', async (collected, reason) => {
      if (client.battles.has(battleMessage.id)) {
        await endDuel(battleMessage.id, client, reason === 'time' ? 'timeout' : reason);
      }
    });

  } catch (error) {
    console.error('Error in handleDuelBattle:', error);
  }
}

// handleDuelAction is now handled in interactionCreate.js to prevent conflicts

async function endDuel(messageId, client, reason, winner = null) {
  try {
    const battleData = client.battles.get(messageId);
    if (!battleData) return;

    const User = require('../db/models/User.js');
    const { player1, player2 } = battleData;

    // Update user battle states and stats
    const user1 = await User.findOne({ userId: player1.data.id });
    const user2 = await User.findOne({ userId: player2.data.id });

    if (user1) {
      user1.battleState = { inBattle: false };
      if (winner && winner.id === user1.userId) {
        user1.wins = (user1.wins || 0) + 1;
        user1.coins = (user1.coins || 0) + 100; // Reward for winning
      } else if (reason !== 'timeout') {
        user1.losses = (user1.losses || 0) + 1;
      }
      user1.duelCooldown = Date.now() + (10 * 60 * 1000); // 10 minute cooldown
      await user1.save();
    }

    if (user2) {
      user2.battleState = { inBattle: false };
      if (winner && winner.id === user2.userId) {
        user2.wins = (user2.wins || 0) + 1;
        user2.coins = (user2.coins || 0) + 100; // Reward for winning
      } else if (reason !== 'timeout') {
        user2.losses = (user2.losses || 0) + 1;
      }
      user2.duelCooldown = Date.now() + (10 * 60 * 1000); // 10 minute cooldown
      await user2.save();
    }

    // Clean up battle data
    client.battles.delete(messageId);

    // Update final message
    const channel = client.channels.cache.get(battleData.channelId);
    if (channel) {
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

      const message = await channel.messages.fetch(messageId).catch(() => null);
      if (message) {
        await message.edit({ embeds: [finalEmbed], components: [] }).catch(() => {});
      }
    }

  } catch (error) {
    console.error('Error ending duel:', error);
  }
}

module.exports = { data, execute, createDuelEmbed, createDuelButtons, endDuel };