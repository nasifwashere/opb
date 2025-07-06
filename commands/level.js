const { SlashCommandBuilder, EmbedBuilder  } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');
const { saveUserWithRetry } = require('../utils/saveWithRetry.js');
const { fuzzyFindCard } = require('../utils/fuzzyCardMatcher.js');

const cardsPath = path.resolve('data', 'cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function calculateLevelUpCost(currentLevel) {
  // Progressive cost: 100 * level * 1.5^level
  return Math.floor(100 * currentLevel * Math.pow(1.5, currentLevel / 10));
}

const data = new SlashCommandBuilder()
  .setName('level')
  .setDescription('Level up your cards using duplicates and Beli.');

async function execute(message, args) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });

  if (!user) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription('Start your journey with `op start` first!')
      .setFooter({ text: 'Use op start to begin your adventure' });
    
    return message.reply({ embeds: [embed] });
  }

  // Ensure username is set if missing
  if (!user.username) {
    user.username = username;
    await saveUserWithRetry(user);
  }

  if (args.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle('Level Up Cards')
      .setDescription('Level up your cards using duplicate cards and Beli.')
      .addFields({
        name: 'Usage',
        value: '`op level <card name> [amount]`',
        inline: false
      })
      .setFooter({ text: 'Use duplicates and Beli to make your cards stronger' });
    
    return message.reply({ embeds: [embed] });
  }

  const amount = parseInt(args[args.length - 1]) || 1;
  const cardName = amount > 1 ? args.slice(0, -1).join(' ').trim() : args.join(' ').trim();

  if (!cardName) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription('Please specify a card name.')
      .setFooter({ text: 'Card name is required' });
    
    return message.reply({ embeds: [embed] });
  }

  // Use fuzzyFindCard to find the main card in user's collection
  const mainCard = fuzzyFindCard(user.cards, cardName);
  if (!mainCard) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`You don't own "${cardName}".`)
      .setFooter({ text: 'Card not found in your collection' });
    return message.reply({ embeds: [embed] });
  }

  // Find all duplicates of the main card (by normalized name)
  const userCards = user.cards.filter(c => normalize(c.name) === normalize(mainCard.name));

  // Only the first card (lowest index) is the main card
  const mainCardIndex = user.cards.findIndex(c => normalize(c.name) === normalize(mainCard.name));
  if (mainCardIndex === -1) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription('Main card not found in your collection.')
      .setFooter({ text: 'Card not found' });
    return message.reply({ embeds: [embed] });
  }
  const currentLevel = mainCard.level || 1;

  if (currentLevel >= 100) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`"${mainCard.name}" is already at maximum level (100).`)
      .setFooter({ text: 'Card is at max level' });
    
    return message.reply({ embeds: [embed] });
  }

  const duplicates = userCards.length - 1; // Exclude the main card
  if (duplicates < amount) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`You need ${amount} duplicate card${amount > 1 ? 's' : ''} to level up. You have ${duplicates} duplicate${duplicates !== 1 ? 's' : ''}.`)
      .setFooter({ text: 'Not enough duplicates' });
    
    return message.reply({ embeds: [embed] });
  }

  // Get card definition for stat calculation
  const cardDef = allCards.find(c => normalize(c.name) === normalize(cardName));

  if (!cardDef) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription('Card definition not found.')
      .setFooter({ text: 'Database error' });
    
    return message.reply({ embeds: [embed] });
  }

  // Use level system functions
  const { canLevelUp, levelUp, calculateCardStats } = require('../utils/levelSystem.js');

  // Check if we can level up
  if (!canLevelUp(mainCard, duplicates)) {
    if (duplicates === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setDescription(`You need duplicate cards to level up "${mainCard.name}". You currently have ${duplicates} duplicates.`)
        .setFooter({ text: 'No duplicates available' });
      
      return message.reply({ embeds: [embed] });
    }
    if (currentLevel >= 100) {
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setDescription(`"${mainCard.name}" is already at maximum level (100).`)
        .setFooter({ text: 'Card is at max level' });
      
      return message.reply({ embeds: [embed] });
    }
  }

  // Calculate cost - reduced to 50 beli per level
  const costPerLevel = 50;
  const totalCost = costPerLevel * amount;

  if ((user.beli || 0) < totalCost) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`You need **${totalCost}** Beli to level up ${amount} time${amount > 1 ? 's' : ''}. You have **${user.beli || 0}** Beli.`)
      .setFooter({ text: 'Insufficient Beli' });
    
    return message.reply({ embeds: [embed] });
  }

  // Calculate old stats
  const oldStats = calculateCardStats(cardDef, currentLevel);

  // Perform level up
  const levelsGained = levelUp(mainCard, duplicates, amount);

  if (levelsGained === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`Unable to level up "${mainCard.name}".`)
      .setFooter({ text: 'Level up failed' });
    
    return message.reply({ embeds: [embed] });
  }

  // Remove only level 1 duplicate cards used
  for (let i = 0; i < levelsGained; i++) {
    const duplicateIndex = user.cards.findIndex((c, idx) =>
      idx !== user.cards.indexOf(mainCard) &&
      normalize(c.name) === normalize(cardName) &&
      (c.level === 1 || !c.level)
    );
    if (duplicateIndex !== -1) {
      user.cards.splice(duplicateIndex, 1);
    }
  }

  // Deduct Beli
  const actualCost = costPerLevel * levelsGained;
  user.beli = (user.beli || 0) - actualCost;

  // Update quest progress for level ups
  try {
    const { updateQuestProgress } = require('../utils/questSystem.js');
    await updateQuestProgress(user, 'level_up', levelsGained);
  } catch (error) {
    console.log('Quest system not available');
  }

  await saveUserWithRetry(user);

  // Calculate new stats
  const newLevel = currentLevel + levelsGained;
  const newStats = calculateCardStats(cardDef, newLevel);

  // Create modern level up embed
  const levelUpEmbed = new EmbedBuilder()
    .setTitle('Level Up Complete')
    .setDescription(`**${mainCard.name}** has grown stronger!`)
    .setColor(0x2b2d31)
    .addFields(
      { 
        name: 'Level Progress', 
        value: `${currentLevel} → **${newLevel}**`, 
        inline: true 
      },
      { 
        name: 'Cost', 
        value: `**${actualCost.toLocaleString()}** Beli\n**${levelsGained}** duplicate${levelsGained > 1 ? 's' : ''}`, 
        inline: true 
      },
      { 
        name: 'Stats Gained', 
        value: `**Power** +${newStats.power - oldStats.power}\n**Health** +${newStats.health - oldStats.health}\n**Speed** +${newStats.speed - oldStats.speed}`, 
        inline: true 
      }
    )
    .setFooter({ 
      text: `${cardDef.rank} Rank • Total Power: ${newStats.power + newStats.health + newStats.speed}`
    });

  return message.reply({ embeds: [levelUpEmbed] });
}

module.exports = { data, execute };