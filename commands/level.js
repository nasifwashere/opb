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
  const currentLevel = mainCard.level || 1;

  if (currentLevel >= 100) {
    return message.reply(`❌ "${mainCard.name}" is already at maximum level (100).`);
  }

  if (duplicates < amount) {
    return message.reply(`❌ You need ${amount} duplicate card${amount > 1 ? 's' : ''} to level up. You have ${duplicates} duplicate${duplicates !== 1 ? 's' : ''}.`);
  }

  // Get card definition for stat calculation
  const cardDef = allCards.find(c => normalize(c.name) === normalize(cardName));

  if (!cardDef) {
    return message.reply('❌ Card definition not found.');
  }

  // Use level system functions
  const { canLevelUp, levelUp, calculateCardStats } = require('../utils/levelSystem.js');

  // Check if we can level up
  if (!canLevelUp(mainCard, duplicates)) {
    if (duplicates === 0) {
      return message.reply(`❌ You need duplicate cards to level up "${mainCard.name}". You currently have ${duplicates} duplicates.`);
    }
    if (currentLevel >= 100) {
      return message.reply(`❌ "${mainCard.name}" is already at maximum level (100).`);
    }
  }

  // Calculate cost
  const costPerLevel = 1000;
  const totalCost = costPerLevel * amount;

  if ((user.beli || 0) < totalCost) {
    return message.reply(`❌ You need **${totalCost}** Beli to level up ${amount} time${amount > 1 ? 's' : ''}. You have **${user.beli || 0}** Beli.`);
  }

  // Calculate old stats
  const oldStats = calculateCardStats(cardDef, currentLevel);

  // Perform level up
  const levelsGained = levelUp(mainCard, duplicates, amount);

  if (levelsGained === 0) {
    return message.reply(`❌ Unable to level up "${mainCard.name}".`);
  }

  // Remove duplicate cards used
  for (let i = 0; i < levelsGained; i++) {
    const duplicateIndex = user.cards.findIndex((c, index) => 
      index !== user.cards.indexOf(mainCard) && 
      normalize(c.name) === normalize(cardName)
    );
    if (duplicateIndex !== -1) {
      user.cards.splice(duplicateIndex, 1);
    }
  }

  // Deduct Beli
  const actualCost = costPerLevel * levelsGained;
  user.beli = (user.beli || 0) - actualCost;

  await user.save();

  // Calculate new stats
  const newLevel = currentLevel + levelsGained;
  const newStats = calculateCardStats(cardDef, newLevel);

  // Create beautiful level up embed
  const levelUpEmbed = new EmbedBuilder()
    .setTitle(`🎉 **LEVEL UP SUCCESSFUL!** 🎉`)
    .setDescription(`✨ **${mainCard.name}** has grown stronger! ✨`)
    .setColor(0x4169E1)
    .addFields(
      { 
        name: '📊 **Level Progress**', 
        value: `\`\`\`diff\n- Level ${currentLevel}\n+ Level ${newLevel}\n\`\`\``, 
        inline: false 
      },
      { 
        name: '💎 **Investment**', 
        value: `💰 **${actualCost.toLocaleString()}** Beli spent\n🃏 **${levelsGained}** duplicate card${levelsGained > 1 ? 's' : ''} consumed`, 
        inline: false 
      },
      { 
        name: '⚔️ **Power**', 
        value: `\`\`\`diff\n- ${oldStats.power}\n+ ${newStats.power} (+${newStats.power - oldStats.power})\n\`\`\``, 
        inline: true 
      },
      { 
        name: '❤️ **Health**', 
        value: `\`\`\`diff\n- ${oldStats.health}\n+ ${newStats.health} (+${newStats.health - oldStats.health})\n\`\`\``, 
        inline: true 
      },
      { 
        name: '💨 **Speed**', 
        value: `\`\`\`diff\n- ${oldStats.speed}\n+ ${newStats.speed} (+${newStats.speed - oldStats.speed})\n\`\`\``, 
        inline: true 
      }
    )
    .setFooter({ 
      text: `${cardDef.rank} Rank • Total Power: ${newStats.power + newStats.health + newStats.speed}`,
      iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png' 
    })
    .setTimestamp();

  if (cardDef.image) {
    levelUpEmbed.setThumbnail(cardDef.image);
  }

  return message.reply({ embeds: [levelUpEmbed] });
}

module.exports = { data, execute };