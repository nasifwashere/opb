const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const { calculateBattleStats } = require('../utils/battleSystem.js');

const DUEL_COOLDOWN = 10 * 60 * 1000; // 10 minutes

function prettyTime(ms) {
  let seconds = Math.floor(ms / 1000);
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);
  minutes = minutes % 60;
  seconds = seconds % 60;
  let out = [];
  if (hours > 0) out.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (minutes > 0) out.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
  if (out.length === 0) out.push(`${seconds} seconds`);
  return out.join(", ");
}

function createHpBar(current, max) {
  const percentage = Math.max(0, current / max);
  const barLength = 10;
  const filledBars = Math.round(percentage * barLength);
  const emptyBars = barLength - filledBars;
  return '█'.repeat(filledBars) + '░'.repeat(emptyBars);
}

function createDuelEmbed(player1, player2, player1Team, player2Team, battleLog, turn, currentPlayerId, winner = null) {
  let description = `**${player1.username}** vs **${player2.username}**\n\n`;

  if (winner) {
    description += `🏆 **${winner.username}** wins the duel!\n\n`;
  } else {
    const currentPlayerName = currentPlayerId === player1.id ? player1.username : player2.username;
    description += `**Turn:** ${turn} | **Current:** ${currentPlayerName}\n\n`;
  }

  description += battleLog.slice(-4).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('⚔️ PvP Duel')
    .setDescription(description)
    .setColor(winner ? 0x2ecc40 : 0x3498db);

  const team1Display = player1Team.filter(card => card.currentHp > 0).map(card => {
    const hpBar = createHpBar(card.currentHp, card.hp);
    return `${card.name} ${hpBar} ${card.currentHp}/${card.hp}`;
  }).join('\n') || 'No active cards';

  const team2Display = player2Team.filter(card => card.currentHp > 0).map(card => {
    const hpBar = createHpBar(card.currentHp, card.hp);
    return `${card.name} ${hpBar} ${card.currentHp}/${card.hp}`;
  }).join('\n') || 'No active cards';

  embed.addFields(
    { name: `🛡️ ${player1.username}'s Team`, value: team1Display, inline: true },
    { name: `🛡️ ${player2.username}'s Team`, value: team2Display, inline: true }
  );

  return embed;
}

function createDuelButtons(currentPlayerId, disabled = false) {
  return new ActionRowBuilder().addComponents(
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
      .setLabel('🏳️ Forfeit')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled)
  );
}

const data = { name: 'duel', description: 'Challenge another player to a PvP duel.' };

async function execute(message, args, client) {
  const challengerId = message.author.id;
  const challenger = await User.findOne({ userId: challengerId });

  if (!challenger) return message.reply('Start your journey with `op start` first!');

  const now = Date.now();
  if (challenger.duelCooldown && now < challenger.duelCooldown) {
    const timeLeft = prettyTime(challenger.duelCooldown - now);
    return message.reply(`⏳ You must wait ${timeLeft} before dueling again.`);
  }

  if (!challenger.team || challenger.team.length === 0) {
    return message.reply('<:arrow:1375872983029256303> You need at least one card in your team! Use `op team add <card>` first.');
  }

  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return message.reply('Usage: `op duel @user`\n\nMention the user you want to challenge!');
  }

  if (targetUser.id === challengerId) {
    return message.reply('<:arrow:1375872983029256303> You cannot duel yourself!');
  }

  if (targetUser.bot) {
    return message.reply('<:arrow:1375872983029256303> You cannot duel bots!');
  }

  const opponent = await User.findOne({ userId: targetUser.id });
  if (!opponent) {
    return message.reply(`<:arrow:1375872983029256303> ${targetUser.username} hasn't started their journey yet!`);
  }

  if (!opponent.team || opponent.team.length === 0) {
    return message.reply(`<:arrow:1375872983029256303> ${targetUser.username} doesn't have any cards in their team!`);
  }

  if (opponent.duelCooldown && now < opponent.duelCooldown) {
    return message.reply(`<:arrow:1375872983029256303> ${targetUser.username} is still on duel cooldown.`);
  }

  // Create challenge embed
  const challengeEmbed = new EmbedBuilder()
    .setTitle('⚔️ Duel Challenge!')
    .setDescription(`${message.author.username} has challenged ${targetUser.username} to a duel!\n\n${targetUser.username}, do you accept?`)
    .setColor(0xf39c12);

  const acceptRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('duel_accept')
      .setLabel('✅ Accept')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('duel_decline')
      .setLabel('❌ Decline')
      .setStyle(ButtonStyle.Danger)
  );

  const challengeMessage = await message.reply({ embeds: [challengeEmbed], components: [acceptRow] });

  // Challenge acceptance phase
  const challengeFilter = i => i.user.id === targetUser.id;
  const challengeCollector = challengeMessage.createMessageComponentCollector({ filter: challengeFilter, time: 60000 });

  challengeCollector.on('collect', async interaction => {
    await interaction.deferUpdate();

    if (interaction.customId === 'duel_decline') {
      const declineEmbed = new EmbedBuilder()
        .setTitle('❌ Duel Declined')
        .setDescription(`${targetUser.username} declined the duel challenge.`)
        .setColor(0xe74c3c);

      await challengeMessage.edit({ embeds: [declineEmbed], components: [] });
      return;
    }

    if (interaction.customId === 'duel_accept') {
      // Start the duel using explore.js battle system
      const player1Team = calculateBattleStats(challenger);
      const player2Team = calculateBattleStats(opponent);

      if (player1Team.length === 0 || player2Team.length === 0) {
        await challengeMessage.edit({ 
          content: '<:arrow:1375872983029256303> One or both players have no valid cards for battle!', 
          embeds: [], 
          components: [] 
        });
        return;
      }

      let battleLog = ['The duel begins!'];
      let turn = 1;
      let currentPlayer = challengerId;

      const player1 = { username: message.author.username, id: challengerId };
      const player2 = { username: targetUser.username, id: targetUser.id };

      const duelEmbed = createDuelEmbed(player1, player2, player1Team, player2Team, battleLog, turn, currentPlayer);
      await challengeMessage.edit({ 
        embeds: [duelEmbed], 
        components: [createDuelButtons(currentPlayer)] 
      });

      // Store battle state in client battles map
      const battleData = {
        type: 'duel',
        player1: { user: challenger, team: player1Team, data: player1 },
        player2: { user: opponent, team: player2Team, data: player2 },
        battleLog,
        turn,
        currentPlayer,
        userId: currentPlayer // For compatibility with existing battle system
      };

      if (!client.battles) client.battles = new Map();
      client.battles.set(challengeMessage.id, battleData);

      setTimeout(() => {
        if (client.battles && client.battles.has(challengeMessage.id)) {
          client.battles.delete(challengeMessage.id);
        }
      }, 5 * 60 * 1000);
    }
  });

  challengeCollector.on('end', async (collected) => {
    if (collected.size === 0) {
      const timeoutEmbed = new EmbedBuilder()
        .setTitle('⏰ Challenge Expired')
        .setDescription(`${targetUser.username} didn't respond to the duel challenge.`)
        .setColor(0x95a5a6);

      await challengeMessage.edit({ embeds: [timeoutEmbed], components: [] });
    }
  });
}

module.exports = { data, execute };