const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');

const cardsPath = path.resolve('data', 'cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function calculateCardPower(cardDef, cardInstance) {
  const { calculateCardStats } = require('../utils/levelSystem.js');
  const level = cardInstance.level || 1;
  const stats = calculateCardStats(cardDef, level);

  const rankMultipliers = { C: 0.8, B: 1.0, A: 1.2, S: 1.4, UR: 1.6 };
  const rankBonus = rankMultipliers[cardDef.rank] || 1.0;

  return (stats.power + stats.health + stats.speed) * rankBonus;
}

const data = new SlashCommandBuilder()
  .setName('autoteam')
  .setDescription('Automatically build your team with strongest cards')
  .addStringOption(option =>
    option.setName('preset')
      .setDescription('Choose a team preset')
      .addChoices(
        { name: 'Strongest Overall', value: 'strongest' },
        { name: 'Speed Focus', value: 'speed' },
        { name: 'Tank Focus', value: 'tank' },
        { name: 'Balanced', value: 'balanced' }
      ));

async function execute(message, args) {
  const userId = message.author.id;
  let user = await User.findOne({ userId });

  if (!user) {
    return message.reply('Start your journey with `op start` first!');
  }

  if (!user.cards || user.cards.length === 0) {
    return message.reply('You need cards first! Use `op pull` to get some cards.');
  }

  const preset = args[0] || 'strongest';

  // Get all user's cards with their definitions
  const availableCards = user.cards
    .map(cardInstance => {
      const cardDef = allCards.find(c => c.name === cardInstance.name);
      if (!cardDef) return null;
      return { instance: cardInstance, def: cardDef };
    })
    .filter(Boolean)
    .filter(card => !user.disallowedCards?.includes(card.def.name));

  if (availableCards.length === 0) {
    return message.reply('No available cards to build a team with!');
  }

  let sortedCards;

  switch (preset) {
    case 'speed':
      sortedCards = availableCards.sort((a, b) => {
        const { calculateCardStats } = require('../utils/levelSystem.js');
        const statsA = calculateCardStats(a.def, a.instance.level || 1);
        const statsB = calculateCardStats(b.def, b.instance.level || 1);
        return statsB.speed - statsA.speed;
      });
      break;

    case 'tank':
      sortedCards = availableCards.sort((a, b) => {
        const { calculateCardStats } = require('../utils/levelSystem.js');
        const statsA = calculateCardStats(a.def, a.instance.level || 1);
        const statsB = calculateCardStats(b.def, b.instance.level || 1);
        return statsB.health - statsA.health;
      });
      break;

    case 'balanced':
      sortedCards = availableCards.sort((a, b) => {
        const { calculateCardStats } = require('../utils/levelSystem.js');
        const statsA = calculateCardStats(a.def, a.instance.level || 1);
        const statsB = calculateCardStats(b.def, b.instance.level || 1);
        const balanceA = (statsA.power + statsA.health + statsA.speed) / 3;
        const balanceB = (statsB.power + statsB.health + statsB.speed) / 3;
        return balanceB - balanceA;
      });
      break;

    default: // strongest
      sortedCards = availableCards.sort((a, b) => {
        return calculateCardPower(b.def, b.instance) - calculateCardPower(a.def, a.instance);
      });
  }

  // Build team with top 3 cards (max team size)
  const newTeam = sortedCards.slice(0, 3).map(card => card.def.name);
  user.team = newTeam;
  await user.save();

  const embed = new EmbedBuilder()
    .setTitle('🤖 Auto-Team Builder')
    .setDescription(`Team built using **${preset}** preset!`)
    .setColor(0x00ff00)
    .addFields({
      name: 'Your New Team',
      value: newTeam.map((name, i) => `${i + 1}. ${name}`).join('\n') || 'No cards selected',
      inline: false
    })
    .setFooter({ text: 'Use "op team" to view detailed team stats' });

  await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };


