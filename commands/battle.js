const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');
const { calculateBattleStats } = require('../utils/battleSystem.js');

const cardsPath = path.resolve('data', 'cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

const BATTLE_COOLDOWN = 5 * 60 * 1000; // 5 minutes

// Boss data for each saga
const bossData = {
  'East Blue': [
    { name: 'Alvida', hp: 150, atk: [15, 25], spd: 60, rank: 'B', reward: { beli: 200, xp: 50 } },
    { name: 'Axe-Hand Morgan', hp: 200, atk: [18, 30], spd: 65, rank: 'B', reward: { beli: 300, xp: 75 } },
    { name: 'Kuro', hp: 250, atk: [20, 35], spd: 85, rank: 'A', reward: { beli: 400, xp: 100 } },
    { name: 'Don Krieg', hp: 300, atk: [25, 40], spd: 70, rank: 'A', reward: { beli: 500, xp: 125 } },
    { name: 'Arlong', hp: 400, atk: [30, 50], spd: 80, rank: 'A', reward: { beli: 750, xp: 200 } }
  ]
};

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

function getRandomBoss(saga) {
  const bosses = bossData[saga] || bossData['East Blue'];
  return bosses[Math.floor(Math.random() * bosses.length)];
}

function createBattleEmbed(boss, playerTeam, battleLog, turn) {
  const embed = new EmbedBuilder()
    .setTitle(`⚔️ Boss Battle: ${boss.name}`)
    .setDescription(`**Boss HP:** ${boss.currentHp}/${boss.hp}\n**Turn:** ${turn}\n\n${battleLog}`)
    .addFields(
      { name: 'Your Team', value: playerTeam.map(card => `${card.name} (HP: ${card.currentHp}/${card.hp})`).join('\n') || 'No active cards', inline: true },
      { name: 'Boss Stats', value: `ATK: ${boss.atk[0]}-${boss.atk[1]}\nSPD: ${boss.spd}\nRank: ${boss.rank}`, inline: true }
    )
    .setColor(boss.currentHp > boss.hp * 0.5 ? 0xe74c3c : 0xf39c12);

  return embed;
}

function createBattleButtons(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('battle_attack')
      .setLabel('⚔️ Attack')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('battle_skill')
      .setLabel('✨ Skill')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('battle_flee')
      .setLabel('🏃 Flee')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
}

const data = { name: 'battle', description: 'Fight a PvE boss battle.' };

async function execute(message, args) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });

  if (!user) return message.reply('Start your journey with `op start` first!');

  const now = Date.now();
  if (user.battleCooldown && now < user.battleCooldown) {
    const timeLeft = prettyTime(user.battleCooldown - now);
    return message.reply(`⏳ You must wait ${timeLeft} before battling again.`);
  }

  if (!user.team || user.team.length === 0) {
    return message.reply('⚠️ You need at least one card in your team! Use `op team add <card>` first.');
  }

  // Get player team with calculated stats
  const playerTeam = calculateBattleStats(user, allCards);
  if (playerTeam.length === 0) {
    return message.reply('❌ Your team has no valid cards for battle!');
  }

  // Get random boss for current saga
  const boss = getRandomBoss(user.saga);
  boss.currentHp = boss.hp;

  let battleLog = `The battle begins! ${boss.name} appears!`;
  let turn = 1;
  let battleEnded = false;

  const embed = createBattleEmbed(boss, playerTeam, battleLog, turn);
  const message_sent = await message.reply({ 
    embeds: [embed], 
    components: [createBattleButtons()] 
  });

  const filter = i => i.user.id === userId;
  const collector = message_sent.createMessageComponentCollector({ filter, time: 300000 }); // 5 minutes

  collector.on('collect', async interaction => {
    if (battleEnded) return;

    await interaction.deferUpdate();

    if (interaction.customId === 'battle_flee') {
      battleLog += '\n\n🏃 You fled from battle!';
      battleEnded = true;
      user.battleCooldown = now + BATTLE_COOLDOWN;
      await user.save();
      
      const fleeEmbed = createBattleEmbed(boss, playerTeam, battleLog, turn);
      await message_sent.edit({ embeds: [fleeEmbed], components: [createBattleButtons(true)] });
      return;
    }

    // Player turn
    const activeCard = playerTeam.find(card => card.currentHp > 0);
    if (!activeCard) {
      battleLog += '\n\n💀 All your cards have been defeated!';
      battleEnded = true;
      user.losses = (user.losses || 0) + 1;
      user.battleCooldown = now + (60 * 60 * 1000); // 1 hour cooldown on loss
      await user.save();
      
      const loseEmbed = createBattleEmbed(boss, playerTeam, battleLog, turn);
      await message_sent.edit({ embeds: [loseEmbed], components: [createBattleButtons(true)] });
      return;
    }

    let damage = 0;
    if (interaction.customId === 'battle_attack') {
      damage = Math.floor(Math.random() * (activeCard.attack[1] - activeCard.attack[0] + 1)) + activeCard.attack[0];
      battleLog += `\n${activeCard.name} attacks for ${damage} damage!`;
    } else if (interaction.customId === 'battle_skill') {
      damage = Math.floor(activeCard.attack[1] * 1.5);
      battleLog += `\n${activeCard.name} uses a special skill for ${damage} damage!`;
    }

    boss.currentHp = Math.max(0, boss.currentHp - damage);

    if (boss.currentHp <= 0) {
      battleLog += `\n\n🎉 Victory! ${boss.name} has been defeated!`;
      battleEnded = true;
      
      // Rewards
      user.beli = (user.beli || 0) + boss.reward.beli;
      user.xp = (user.xp || 0) + boss.reward.xp;
      user.wins = (user.wins || 0) + 1;
      user.battleCooldown = now + BATTLE_COOLDOWN;
      
      battleLog += `\n💰 +${boss.reward.beli} Beli, ✨ +${boss.reward.xp} XP`;
      await user.save();
      
      const winEmbed = createBattleEmbed(boss, playerTeam, battleLog, turn);
      await message_sent.edit({ embeds: [winEmbed], components: [createBattleButtons(true)] });
      return;
    }

    // Boss turn
    const bossAttack = Math.floor(Math.random() * (boss.atk[1] - boss.atk[0] + 1)) + boss.atk[0];
    activeCard.currentHp = Math.max(0, activeCard.currentHp - bossAttack);
    battleLog += `\n${boss.name} attacks ${activeCard.name} for ${bossAttack} damage!`;

    if (activeCard.currentHp <= 0) {
      battleLog += `\n💀 ${activeCard.name} has been defeated!`;
    }

    turn++;
    const updatedEmbed = createBattleEmbed(boss, playerTeam, battleLog, turn);
    await message_sent.edit({ embeds: [updatedEmbed], components: [createBattleButtons()] });
  });

  collector.on('end', async () => {
    if (!battleEnded) {
      battleLog += '\n\n⏰ Battle timed out!';
      user.battleCooldown = now + BATTLE_COOLDOWN;
      await user.save();
      
      const timeoutEmbed = createBattleEmbed(boss, playerTeam, battleLog, turn);
      await message_sent.edit({ embeds: [timeoutEmbed], components: [createBattleButtons(true)] });
    }
  });
}

module.exports = { data, execute };
