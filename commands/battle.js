const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');
const { calculateBattleStats } = require('../utils/battleSystem.js');

const cardsPath = path.resolve('data', 'cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

const BATTLE_COOLDOWN = 5 * 60 * 1000; // 5 minutes

// Boss data for each saga
// Boss battles have been moved to the explore command
// This command now redirects users to explore for boss battles

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

const data = { name: 'battle', description: 'Fight boss battles for rewards.' };

async function execute(message) {
  return message.reply('⚔️ Boss battles are now part of exploration!\n\nUse `op explore` to continue your adventure and fight bosses as part of your story progression.');
}

module.exports = { data, execute };
