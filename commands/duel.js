const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');
const { calculateBattleStats } = require('../utils/battleSystem.js');

const cardsPath = path.resolve('data', 'cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

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

function createDuelEmbed(player1, player2, player1Team, player2Team, battleLog, turn, winner = null) {
  let description = `**${player1.username}** vs **${player2.username}**\n\n`;
  
  if (winner) {
    description += `🎉 **${winner.username}** wins the duel!\n\n`;
  } else {
    description += `**Turn:** ${turn}\n\n`;
  }
  
  description += battleLog;

  const embed = new EmbedBuilder()
    .setTitle('⚔️ PvP Duel')
    .setDescription(description)
    .addFields(
      { 
        name: `${player1.username}'s Team`, 
        value: player1Team.map(card => `${card.name} (HP: ${card.currentHp}/${card.hp})`).join('\n') || 'No active cards', 
        inline: true 
      },
      { 
        name: `${player2.username}'s Team`, 
        value: player2Team.map(card => `${card.name} (HP: ${card.currentHp}/${card.hp})`).join('\n') || 'No active cards', 
        inline: true 
      }
    )
    .setColor(winner ? 0x2ecc40 : 0x3498db);

  return embed;
}

function createDuelButtons(currentPlayerId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`duel_attack_${currentPlayerId}`)
      .setLabel('⚔️ Attack')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`duel_skill_${currentPlayerId}`)
      .setLabel('✨ Skill')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`duel_forfeit_${currentPlayerId}`)
      .setLabel('🏳️ Forfeit')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
}

const data = { name: 'duel', description: 'Challenge another player to a PvP duel.' };

async function execute(message, args) {
  const challengerId = message.author.id;
  const challenger = await User.findOne({ userId: challengerId });

  if (!challenger) return message.reply('Start your journey with `op start` first!');

  const now = Date.now();
  if (challenger.duelCooldown && now < challenger.duelCooldown) {
    const timeLeft = prettyTime(challenger.duelCooldown - now);
    return message.reply(`⏳ You must wait ${timeLeft} before dueling again.`);
  }

  if (!challenger.team || challenger.team.length === 0) {
    return message.reply('⚠️ You need at least one card in your team! Use `op team add <card>` first.');
  }

  // Get mentioned user
  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return message.reply('Usage: `op duel @user`\n\nMention the user you want to challenge!');
  }

  if (targetUser.id === challengerId) {
    return message.reply('❌ You cannot duel yourself!');
  }

  if (targetUser.bot) {
    return message.reply('❌ You cannot duel bots!');
  }

  const opponent = await User.findOne({ userId: targetUser.id });
  if (!opponent) {
    return message.reply(`❌ ${targetUser.username} hasn't started their journey yet!`);
  }

  if (!opponent.team || opponent.team.length === 0) {
    return message.reply(`❌ ${targetUser.username} doesn't have any cards in their team!`);
  }

  if (opponent.duelCooldown && now < opponent.duelCooldown) {
    return message.reply(`❌ ${targetUser.username} is still on duel cooldown.`);
  }

  // Create challenge embed
  const challengeEmbed = new EmbedBuilder()
    .setTitle('⚔️ Duel Challenge!')
    .setDescription(`${message.author.username} has challenged ${targetUser.username} to a duel!\n\n${targetUser.username}, do you accept?`)
    .setColor(0xf39c12);

  const acceptRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('duel_accept')
      .setLabel('⚔️ Accept')
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
        .setTitle('⚔️ Duel Declined')
        .setDescription(`${targetUser.username} declined the duel challenge.`)
        .setColor(0xe74c3c);
      
      await challengeMessage.edit({ embeds: [declineEmbed], components: [] });
      return;
    }

    if (interaction.customId === 'duel_accept') {
      // Start the duel
      const player1Team = calculateBattleStats(challenger, allCards);
      const player2Team = calculateBattleStats(opponent, allCards);

      if (player1Team.length === 0 || player2Team.length === 0) {
        await challengeMessage.edit({ 
          content: '❌ One or both players have no valid cards for battle!', 
          embeds: [], 
          components: [] 
        });
        return;
      }

      let battleLog = 'The duel begins!';
      let turn = 1;
      let currentPlayer = challengerId;
      let battleEnded = false;

      const player1 = { username: message.author.username, id: challengerId };
      const player2 = { username: targetUser.username, id: targetUser.id };

      const duelEmbed = createDuelEmbed(player1, player2, player1Team, player2Team, battleLog, turn);
      await challengeMessage.edit({ 
        embeds: [duelEmbed], 
        components: [createDuelButtons(currentPlayer)] 
      });

      // Battle phase
      const battleFilter = i => [challengerId, targetUser.id].includes(i.user.id);
      const battleCollector = challengeMessage.createMessageComponentCollector({ filter: battleFilter, time: 300000 });

      battleCollector.on('collect', async battleInteraction => {
        if (battleEnded || battleInteraction.user.id !== currentPlayer) {
          await battleInteraction.reply({ content: "It's not your turn!", ephemeral: true });
          return;
        }

        try {
          await battleInteraction.deferUpdate();
        } catch (error) {
          console.log('Interaction already acknowledged or expired');
          return;
        }

        const isPlayer1 = currentPlayer === challengerId;
        const activeTeam = isPlayer1 ? player1Team : player2Team;
        const enemyTeam = isPlayer1 ? player2Team : player1Team;
        const playerName = isPlayer1 ? player1.username : player2.username;

        if (battleInteraction.customId.includes('forfeit')) {
          battleLog += `\n\n🏳️ ${playerName} forfeited the duel!`;
          battleEnded = true;
          
          const winner = isPlayer1 ? player2 : player1;
          const loser = isPlayer1 ? challenger : opponent;
          const winnerUser = isPlayer1 ? opponent : challenger;
          
          // Update stats and cooldowns
          winnerUser.wins = (winnerUser.wins || 0) + 1;
          winnerUser.beli = (winnerUser.beli || 0) + 100;
          winnerUser.duelCooldown = now + DUEL_COOLDOWN;
          
          loser.losses = (loser.losses || 0) + 1;
          loser.duelCooldown = now + DUEL_COOLDOWN;
          
          await winnerUser.save();
          await loser.save();
          
          const forfeitEmbed = createDuelEmbed(player1, player2, player1Team, player2Team, battleLog, turn, winner);
          await challengeMessage.edit({ embeds: [forfeitEmbed], components: [] });
          return;
        }

        // Player attack
        const activeCard = activeTeam.find(card => card.currentHp > 0);
        const enemyCard = enemyTeam.find(card => card.currentHp > 0);
        
        if (!activeCard || !enemyCard) {
          // Battle should end
          const winner = enemyCard ? (isPlayer1 ? player2 : player1) : (isPlayer1 ? player1 : player2);
          battleEnded = true;
          
          const winnerUser = winner.id === challengerId ? challenger : opponent;
          const loserUser = winner.id === challengerId ? opponent : challenger;
          
          winnerUser.wins = (winnerUser.wins || 0) + 1;
          winnerUser.beli = (winnerUser.beli || 0) + 150;
          winnerUser.xp = (winnerUser.xp || 0) + 50;
          winnerUser.duelCooldown = now + DUEL_COOLDOWN;
          
          loserUser.losses = (loserUser.losses || 0) + 1;
          loserUser.duelCooldown = now + DUEL_COOLDOWN;
          
          await winnerUser.save();
          await loserUser.save();
          
          battleLog += `\n\n🎉 ${winner.username} wins the duel!`;
          
          const winEmbed = createDuelEmbed(player1, player2, player1Team, player2Team, battleLog, turn, winner);
          await challengeMessage.edit({ embeds: [winEmbed], components: [] });
          return;
        }

        let damage = 0;
        if (battleInteraction.customId.includes('attack')) {
          damage = Math.floor(Math.random() * (activeCard.attack[1] - activeCard.attack[0] + 1)) + activeCard.attack[0];
          battleLog += `\n${activeCard.name} attacks ${enemyCard.name} for ${damage} damage!`;
        } else if (battleInteraction.customId.includes('skill')) {
          damage = Math.floor(activeCard.attack[1] * 1.5);
          battleLog += `\n${activeCard.name} uses a special skill on ${enemyCard.name} for ${damage} damage!`;
        }

        enemyCard.currentHp = Math.max(0, enemyCard.currentHp - damage);
        
        if (enemyCard.currentHp <= 0) {
          battleLog += `\n💀 ${enemyCard.name} has been defeated!`;
        }

        // Switch turns
        currentPlayer = currentPlayer === challengerId ? targetUser.id : challengerId;
        turn++;

        const updatedEmbed = createDuelEmbed(player1, player2, player1Team, player2Team, battleLog, turn);
        await challengeMessage.edit({ embeds: [updatedEmbed], components: [createDuelButtons(currentPlayer)] });
      });

      battleCollector.on('end', async () => {
        if (!battleEnded) {
          battleLog += '\n\n⏰ Duel timed out!';
          challenger.duelCooldown = now + DUEL_COOLDOWN;
          opponent.duelCooldown = now + DUEL_COOLDOWN;
          await challenger.save();
          await opponent.save();
          
          const timeoutEmbed = createDuelEmbed(player1, player2, player1Team, player2Team, battleLog, turn);
          await challengeMessage.edit({ embeds: [timeoutEmbed], components: [] });
        }
      });
    }
  });

  challengeCollector.on('end', async (collected) => {
    if (collected.size === 0) {
      const timeoutEmbed = new EmbedBuilder()
        .setTitle('⚔️ Challenge Expired')
        .setDescription(`${targetUser.username} didn't respond to the duel challenge.`)
        .setColor(0x95a5a6);
      
      await challengeMessage.edit({ embeds: [timeoutEmbed], components: [] });
    }
  });
}


module.exports = { data, execute };