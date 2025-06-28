const { EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');
const { getEvolution } = require('../utils/evolutionSystem.js');

const cardsPath = path.resolve('data', 'cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

// Evolution cost matrix
const evolutionCosts = {
  'C_B': { cost: 250, level: 5 },
  'B_A': { cost: 1000, level: 25 },
  'A_S': { cost: 2500, level: 30 },
  'S_UR': { cost: 30000, level: 90 }
};

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function findCard(cardName) {
  return allCards.find(c => normalize(c.name) === normalize(cardName));
}

function findUserCard(user, cardName) {
  return user.cards.find(c => normalize(c.name) === normalize(cardName));
}

function getEvolutionCost(fromRank, toRank) {
  const key = `${fromRank}_${toRank}`;
  return evolutionCosts[key] || null;
}

const data = { name: 'evolve', description: 'Evolve a card to its next form.' };

async function execute(message, args) {
  const userId = message.author.id;
  const cardName = args.join(' ').trim();

  if (!cardName) {
    return message.reply('Usage: `op evolve <card name>`');
  }

  const user = await User.findOne({ userId });
  if (!user) return message.reply('Start your journey with `op start` first!');

  // Find the card in user's collection
  const userCard = findUserCard(user, cardName);
  if (!userCard) {
    return message.reply(`<:arrow:1375872983029256303> You don't own "${cardName}".`);
  }

  // Find the card definition
  const cardDef = findCard(userCard.name);
  if (!cardDef) {
    return message.reply(`<:arrow:1375872983029256303> Card definition for "${userCard.name}" not found.`);
  }

  // Check if card can evolve
  if (!cardDef.evolution) {
    return message.reply(`<:arrow:1375872983029256303> "${cardDef.name}" cannot evolve further.`);
  }

  const evolution = cardDef.evolution;
  const currentLevel = userCard.level || userCard.timesUpgraded + 1 || 1;

  // Check level requirement
  if (currentLevel < evolution.requiredLevel) {
    return message.reply(`<:arrow:1375872983029256303> "${cardDef.name}" needs to be level ${evolution.requiredLevel} to evolve. Current level: ${currentLevel}`);
  }

  // Check saga requirement
  if (evolution.requiredSaga && user.saga !== evolution.requiredSaga) {
    return message.reply(`<:arrow:1375872983029256303> You need to reach the "${evolution.requiredSaga}" saga to evolve this card. Current saga: ${user.saga}`);
  }

  // Find the evolved form
  const evolvedCard = allCards.find(c => c.name === evolution.nextId);
  if (!evolvedCard) {
    return message.reply(`<:arrow:1375872983029256303> Evolution target "${evolution.nextId}" not found in database.`);
  }

  // Calculate evolution cost
  const costInfo = getEvolutionCost(cardDef.rank, evolvedCard.rank);
  const evolutionCost = evolution.cost || costInfo?.cost || 1000;

  // Check if user has enough Beli
  if (user.beli < evolutionCost) {
    return message.reply(`<:arrow:1375872983029256303> You need ${evolutionCost} Beli to evolve this card. You have ${user.beli} Beli.`);
  }

  // Check for duplicates requirement (some evolutions might need this)
  const duplicates = user.cards.filter(c => normalize(c.name) === normalize(userCard.name)).length - 1;
  if (duplicates < 0) { // This shouldn't happen, but just in case
    return message.reply(`<:arrow:1375872983029256303> Evolution failed: insufficient duplicates.`);
  }

  // Perform evolution
  user.beli -= evolutionCost;
  
  // Update the card
  const cardIndex = user.cards.findIndex(c => normalize(c.name) === normalize(userCard.name));
  user.cards[cardIndex] = {
    name: evolvedCard.name,
    rank: evolvedCard.rank,
    level: Math.max(1, currentLevel - 5), // Slight level reduction on evolution
    timesUpgraded: userCard.timesUpgraded || 0,
    locked: userCard.locked || false,
    experience: userCard.experience || 0
  };

  // Update team if the card was in team
  const teamIndex = user.team.findIndex(teamCardName => normalize(teamCardName) === normalize(userCard.name));
  if (teamIndex !== -1) {
    user.team[teamIndex] = evolvedCard.name;
  }

  await user.save();

  // Create success embed
  const embed = new EmbedBuilder()
    .setTitle('<:sucess:1375872950321811547> Evolution Success!')
    .setDescription(`**${cardDef.name}** has evolved into **${evolvedCard.name}**!`)
    .addFields(
      { name: 'Previous Form', value: `[${cardDef.rank}] ${cardDef.name}`, inline: true },
      { name: 'New Form', value: `[${evolvedCard.rank}] ${evolvedCard.name}`, inline: true },
      { name: 'Cost', value: `${evolutionCost} Beli`, inline: true },
      { name: 'New Level', value: `${user.cards[cardIndex].level}`, inline: true },
      { name: 'Remaining Beli', value: `${user.beli}`, inline: true }
    )
    .setColor(0x9b59b6);

  if (evolvedCard.image && evolvedCard.image !== "placeholder") {
    embed.setImage(evolvedCard.image);
  }

  await message.reply({ embeds: [embed] });
}


module.exports = { data, execute };