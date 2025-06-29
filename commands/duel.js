const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { calculateBattleStats, calculateDamage, teamCanFight, getActiveCard, resetTeamHP, processTempBuffs } = require('../utils/battleSystem.js');

function createHpBar(current, max) {
  const percentage = Math.max(0, current / max);
  const barLength = 10;
  const filledBars = Math.round(percentage * barLength);
  const emptyBars = barLength - filledBars;
  return '█'.repeat(filledBars) + '░'.repeat(emptyBars);
}

function createDuelEmbed(player1, player2, battleLog, turn, currentPlayer = null, winner = null) {
  let color = 0xff0000;
  let title = '⚔️ PvP Duel Battle';
  
  if (winner) {
    color = 0x27ae60;
    title = `🏆 ${winner.username} Wins!`;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(`${battleLog.slice(-4).join('\n') || 'Battle begins!'}`)
    .setColor(color);

  const team1Display = player1.team.filter(card => card.currentHp > 0).map(card => {
    const cardHpBar = createHpBar(card.currentHp, card.hp);
    return `${card.name} ${cardHpBar} ${card.currentHp}/${card.hp}`;
  }).join('\n') || 'All cards defeated';

  const team2Display = player2.team.filter(card => card.currentHp > 0).map(card => {
    const cardHpBar = createHpBar(card.currentHp, card.hp);
    return `${card.name} ${cardHpBar} ${card.currentHp}/${card.hp}`;
  }).join('\n') || 'All cards defeated';

  // Add turn indicator if battle is ongoing
  let player1Name = `⚔️ ${player1.username}'s Team`;
  let player2Name = `⚔️ ${player2.username}'s Team`;
  
  if (!winner && currentPlayer) {
    if (currentPlayer === player1.data.userId) {
      player1Name = `🔥 ${player1.username}'s Team (Current Turn)`;
    } else if (currentPlayer === player2.data.userId) {
      player2Name = `🔥 ${player2.username}'s Team (Current Turn)`;
    }
  }

  embed.addFields(
    { name: player1Name, value: team1Display, inline: true },
    { name: player2Name, value: team2Display, inline: true },
    { name: 'Turn', value: `${turn}`, inline: false }
  );

  return embed;
}

function createDuelButtons(disabled = false) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('duel_attack')
        .setLabel('⚔️ Attack')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('duel_defend')
        .setLabel('🛡️ Defend')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('duel_inventory')
        .setLabel('🎒 Items')
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('duel_forfeit')
        .setLabel('🏃 Forfeit')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled)
    );
}

const data = { name: 'duel', description: 'Challenge another player to a PvP battle!' };

async function execute(message, args) {
  const challenger = message.author;
  const challengerId = challenger.id;

  // Get mentioned user or find by name
  let opponent = message.mentions.users.first();
  if (!opponent && args.length > 0) {
    const opponentName = args.join(' ').toLowerCase();
    opponent = message.guild?.members.cache.find(member => 
      member.user.username.toLowerCase().includes(opponentName) ||
      member.displayName.toLowerCase().includes(opponentName)
    )?.user;
  }

  if (!opponent) {
    return message.reply('❌ Please mention a user or provide their name to duel! Usage: `op duel @user` or `op duel username`');
  }

  if (opponent.id === challengerId) {
    return message.reply('❌ You cannot duel yourself!');
  }

  if (opponent.bot) {
    return message.reply('❌ You cannot duel bots!');
  }

  // Check users exist and have teams
  const challengerUser = await User.findOne({ userId: challengerId });
  const opponentUser = await User.findOne({ userId: opponent.id });

  if (!challengerUser) {
    return message.reply('❌ You need to start your journey first! Use `op start`');
  }

  if (!opponentUser) {
    return message.reply('❌ Your opponent needs to start their journey first!');
  }

  if (!challengerUser.team || challengerUser.team.length === 0) {
    return message.reply('❌ You need to build a team first! Use `op team add <card>`');
  }

  if (!opponentUser.team || opponentUser.team.length === 0) {
    return message.reply('❌ Your opponent needs to build a team first!');
  }

  // Check cooldowns
  const now = Date.now();
  const DUEL_COOLDOWN = 10 * 60 * 1000; // 10 minutes

  if (challengerUser.duelCooldown && now < challengerUser.duelCooldown) {
    const timeLeft = Math.ceil((challengerUser.duelCooldown - now) / 60000);
    return message.reply(`❌ You must wait ${timeLeft} minutes before dueling again!`);
  }

  if (opponentUser.duelCooldown && now < opponentUser.duelCooldown) {
    const timeLeft = Math.ceil((opponentUser.duelCooldown - now) / 60000);
    return message.reply(`❌ Your opponent must wait ${timeLeft} minutes before dueling again!`);
  }

  // Calculate battle stats for both teams
  const challengerTeam = calculateBattleStats(challengerUser);
  const opponentTeam = calculateBattleStats(opponentUser);

  if (challengerTeam.length === 0) {
    return message.reply('❌ Your team has no valid battle cards!');
  }

  if (opponentTeam.length === 0) {
    return message.reply('❌ Your opponent has no valid battle cards!');
  }

  // Create challenge embed
  const challengeEmbed = new EmbedBuilder()
    .setTitle('⚔️ Duel Challenge!')
    .setDescription(`${challenger} challenges ${opponent} to a duel!\n\n${opponent}, do you accept this challenge?`)
    .setColor(0xf39c12)
    .addFields(
      { name: `${challenger.username}'s Team Power`, value: `${challengerTeam.reduce((sum, card) => sum + card.power, 0)}`, inline: true },
      { name: `${opponent.username}'s Team Power`, value: `${opponentTeam.reduce((sum, card) => sum + card.power, 0)}`, inline: true }
    );

  const challengeButtons = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('duel_accept')
        .setLabel('✅ Accept')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('duel_decline')
        .setLabel('❌ Decline')
        .setStyle(ButtonStyle.Danger)
    );

  const challengeMessage = await message.reply({
    content: `${opponent}`,
    embeds: [challengeEmbed],
    components: [challengeButtons]
  });

  // Store challenge data temporarily
  if (!message.client.duelChallenges) {
    message.client.duelChallenges = new Map();
  }

  message.client.duelChallenges.set(challengeMessage.id, {
    challengerId,
    opponentId: opponent.id,
    challengerTeam,
    opponentTeam,
    challengerUser,
    opponentUser,
    timestamp: now
  });

  // Clean up challenge after 2 minutes
  setTimeout(() => {
    if (message.client.duelChallenges?.has(challengeMessage.id)) {
      message.client.duelChallenges.delete(challengeMessage.id);
      challengeMessage.edit({ 
        content: '⏰ Challenge expired!', 
        embeds: [challengeEmbed.setColor(0x95a5a6)], 
        components: [] 
      }).catch(() => {});
    }
  }, 2 * 60 * 1000);
}

module.exports = { data, execute, createDuelEmbed, createDuelButtons };