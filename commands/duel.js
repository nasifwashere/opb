const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder  } = require('discord.js');
const User = require('../db/models/User.js');
const { calculateBattleStats } = require('../utils/battleSystem.js');
const { createProfessionalTeamDisplay } = require('../utils/uiHelpers.js');
const path = require('path');

const DUEL_COOLDOWN = 10 * 60 * 1000; // 10 minutes

async function cleanupStaleBattleState(user) {
  if (!user.battleState || !user.battleState.inBattle) return;

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

// Modern UI functions now handled by uiHelpers.js

function createDuelEmbed(player1, player2, player1Team, player2Team, battleLog, turn, currentPlayerId, winner = null) {
  // Create modern battle embed using the same style as explore
  const embed = new EmbedBuilder()
    .setTitle('PvP Duel Battle')
    .setColor(winner ? 0x2ecc71 : 0x2b2d31);

  if (winner) {
    embed.setDescription(`**${winner.username}** wins the duel!`);
  } else {
    const currentPlayerName = currentPlayerId === player1.id ? player1.username : player2.username;
    embed.setDescription(`**Turn ${turn}** • **${currentPlayerName}'s Turn**`);
  }

  // Use modern team displays from uiHelpers (same as explore)
  const team1Display = createProfessionalTeamDisplay(
    player1Team.filter(card => card.currentHp > 0), 
    player1.username
  );
  const team2Display = createProfessionalTeamDisplay(
    player2Team.filter(card => card.currentHp > 0), 
    player2.username
  );

  embed.addFields(
    { 
      name: `${player1.username}'s Team`, 
      value: team1Display || 'No active cards', 
      inline: false 
    },
    { 
      name: `${player2.username}'s Team`, 
      value: team2Display || 'No active cards', 
      inline: false 
    }
  );

  // Add recent battle log if available
  if (battleLog && battleLog.length > 0) {
    const recentLog = battleLog.slice(-3).join('\n');
    embed.addFields({
      name: 'Recent Actions',
      value: recentLog,
      inline: false
    });
  }

  if (!winner) {
    embed.setFooter({ text: 'Use the buttons below to take action. ⏰ You have 2 minutes per turn!' });
  }

  return embed;
}

function createDuelButtons(disabled = false) {
  // Modern battle buttons using the same style as explore
  const battleButtons = [
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
  ];

  return new ActionRowBuilder().addComponents(battleButtons);
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
    return message.reply('You need to mention a player to duel! Usage: `op duel @player`');
  }

  if (mentionedUser.id === userId) {
    return message.reply('You cannot duel yourself!');
  }

  if (mentionedUser.bot) {
    return message.reply('You cannot duel bots!');
  }

  let opponent = await User.findOne({ userId: mentionedUser.id });
  if (!opponent) {
    return message.reply('That player hasn\'t started their journey yet!');
  }

  // Clean up any stale battle states first
  await cleanupStaleBattleState(user);
  await cleanupStaleBattleState(opponent);

  // Check if either player is already in a duel
  if (user.battleState && user.battleState.inBattle) {
    return message.reply('You are already in a battle!');
  }

  if (opponent.battleState && opponent.battleState.inBattle) {
    return message.reply('That player is already in a battle!');
  }

  // Check if both players have teams
  if (!user.team || user.team.length === 0) {
    return message.reply('You need to set up your team first! Use `op team add <card name>`');
  }

  if (!opponent.team || opponent.team.length === 0) {
    return message.reply('Your opponent doesn\'t have a team set up!');
  }

  // Create duel confirmation
  const embed = new EmbedBuilder()
    .setTitle('Duel Challenge!')
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
        if ((user.battleState && user.battleState.inBattle) || (opponent.battleState && opponent.battleState.inBattle)) {
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
      return message.reply('Error finding team cards!');
    }

    // Get card definitions
    const userCardDef = allCards.find(c => c.name === userCard.name);
    const opponentCardDef = allCards.find(c => c.name === opponentCard.name);

    if (!userCardDef || !opponentCardDef) {
      return message.reply('Error finding card definitions!');
    }

    // Set up battle teams with all team members using proper card definitions
    const { calculateBattleStats } = require('../utils/battleSystem.js');
    const player1Team = calculateBattleStats(user, allCards);
    const player2Team = calculateBattleStats(opponent, allCards);

    // Ensure teams have cards
    if (player1Team.length === 0 || player2Team.length === 0) {
      return message.reply('Error setting up battle teams!');
    }

    const battleLog = [`${challenger.username} vs ${challenged.username} - Team Battle!`];

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

    // Create modern battle embed
    const battleEmbed = createDuelEmbed(
      challenger, 
      challenged, 
      player1Team, 
      player2Team, 
      battleLog, 
      1, 
      challenger.id
    );

    const battleRow = createDuelButtons();
    const battleMessage = await duelMessage.edit({ embeds: [battleEmbed], components: [battleRow] });

    // Set up battle data for the duelHandler system
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
      battleLog: [`⚔️ Duel started: ${challenger.username} vs ${challenged.username}!`],
      startTime: Date.now(),
      turnTimeout: null // Will store the timeout for inactive players
    };

    client.battles.set(battleMessage.id, battleData);
    
    // Set up initial turn timeout for the starting player
    const { setupTurnTimeout } = require('../utils/duelHandler.js');
    setupTurnTimeout(battleData, client);
    
    // The actual battle interaction handling is done in index.js via duelHandler
    
  } catch (error) {
    console.error('Error starting duel:', error);
    await message.reply('An error occurred while starting the duel!');
  }
}

// Battle handling is now done by utils/duelHandler.js

module.exports = { data, execute };