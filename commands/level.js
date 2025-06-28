const { EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');

const cardsPath = path.resolve('data', 'cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function findCard(cardName) {
  return allCards.find(c => normalize(c.name) === normalize(cardName));
}

function calculateLevelUpCost(currentLevel) {
  // Progressive cost: 100 * level * 1.5^level
  return Math.floor(100 * currentLevel * Math.pow(1.5, currentLevel / 10));
}

const data = { name: 'level', description: 'Level up your cards using duplicates and Beli.' };

async function execute(message, args) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });

  if (!user) return message.reply('Start your journey with `op start` first!');

  if (args.length === 0) {
    return message.reply('Usage: `op level <card name> [amount]`\n\nLevel up your cards using duplicate cards and Beli.');
  }

  const amount = parseInt(args[args.length - 1]) || 1;
  const cardName = amount > 1 ? args.slice(0, -1).join(' ').trim() : args.join(' ').trim();

  if (!cardName) {
    return message.reply('Please specify a card name.');
  }

  // Find the card in user's collection
  const userCards = user.cards.filter(c => normalize(c.name) === normalize(cardName));
  
  if (userCards.length === 0) {
    return message.reply(`<:arrow:1375872983029256303> You don't own "${cardName}".`);
  }

  const mainCard = userCards[0];
  const duplicates = userCards.length - 1;
  const currentLevel = mainCard.level || mainCard.timesUpgraded + 1 || 1;

  if (currentLevel >= 100) {
    return message.reply(`❌ "${mainCard.name}" is already at maximum level (100).`);
  }

  if (duplicates < amount) {
    return message.reply(`❌ You need ${amount} duplicate card${amount > 1 ? 's' : ''} to level up. You have ${duplicates} duplicate${duplicates !== 1 ? 's' : ''}.`);
  }

  // Calculate total cost for the level ups
  let totalCost = 0;
  let levelsToAdd = Math.min(amount, 100 - currentLevel, duplicates);
  
  for (let i = 0; i < levelsToAdd; i++) {
    totalCost += calculateLevelUpCost(currentLevel + i);
  }

  if (user.beli < totalCost) {
    return message.reply(`<:arrow:1375872983029256303> You need ${totalCost} Beli to level up ${levelsToAdd} time${levelsToAdd > 1 ? 's' : ''}. You have ${user.beli} Beli.`);
  }

  // Perform level up
  user.beli -= totalCost;
  
  // Update the main card's level using the new level system
  const cardIndex = user.cards.findIndex(c => normalize(c.name) === normalize(cardName));
  const { levelUp } = require('../utils/levelSystem.js');
  
  // Use the levelUp function which handles experience properly
  const actualLevelsGained = levelUp(user.cards[cardIndex], duplicates, levelsToAdd);
  
  // Remove duplicate cards (1 duplicate = 1 level)
  let duplicatesRemoved = 0;
  for (let i = user.cards.length - 1; i >= 0 && duplicatesRemoved < actualLevelsGained; i--) {
    if (i !== cardIndex && normalize(user.cards[i].name) === normalize(cardName)) {
      user.cards.splice(i, 1);
      duplicatesRemoved++;
      if (i < cardIndex) cardIndex--; // Adjust index if we removed a card before the main card
    }
  }
  
  levelsToAdd = actualLevelsGained;

  await user.save();

  // Get card definition for display
  const cardDef = findCard(cardName);
  const newLevel = user.cards[cardIndex].level;

  // Calculate new stats (basic calculation)
  let powerIncrease = 0;
  if (cardDef && cardDef.phs) {
    const basePower = parseInt(cardDef.phs.split('/')[0].trim()) || 0;
    powerIncrease = levelsToAdd * 2; // 2 power per level
  }

  const embed = new EmbedBuilder()
    .setTitle('<:snoopy_sparkles:1388585338821152978> Level Up Success!')
    .setDescription(`**${mainCard.name}** gained ${levelsToAdd} level${levelsToAdd > 1 ? 's' : ''}!`)
    .addFields(
      { name: 'Previous Level', value: `${currentLevel}`, inline: true },
      { name: 'New Level', value: `${newLevel}`, inline: true },
      { name: 'Cost', value: `${totalCost} Beli`, inline: true },
      { name: 'Duplicates Used', value: `${duplicatesRemoved}`, inline: true },
      { name: 'Remaining Beli', value: `${user.beli}`, inline: true },
      { name: 'Power Increase', value: `+${powerIncrease}`, inline: true }
    )
    .setColor(0xf1c40f);

  if (cardDef && cardDef.image && cardDef.image !== "placeholder") {
    embed.setThumbnail(cardDef.image);
  }

  // Check if card can now evolve
  if (cardDef && cardDef.evolution && newLevel >= cardDef.evolution.requiredLevel) {
    embed.addFields({ 
      name: '<:snoopy_sparkles:1388585338821152978> Evolution Available!', 
      value: `This card can now evolve! Use \`op evolve ${cardName}\``, 
      inline: false 
    });
  }

  await message.reply({ embeds: [embed] });
}


module.exports = { data, execute };