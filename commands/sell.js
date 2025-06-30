const { EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');

const cardsPath = path.resolve('data', 'cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

// Base sell values by rank
const rankValues = {
  C: 25,
  B: 100,
  A: 250,
  S: 1000,
  UR: 5000
};

// Item values (simple mapping for common items)
const itemValues = {
  'strawhat': 100,
  'luckycharm': 50,
  'treasuremap': 200,
  'healingpotion': 75,
  'powerboost': 150
};

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function calculateCardValue(card, cardDef) {
  const baseValue = rankValues[cardDef?.rank] || rankValues.C;
  const level = card.level || card.timesUpgraded + 1 || 1;
  const levelBonus = (level - 1) * 10; // 10 Beli per level above 1
  
  return baseValue + levelBonus;
}

function calculateItemValue(itemName) {
  const normalizedName = normalize(itemName);
  return itemValues[normalizedName] || 10; // Default 10 Beli for unknown items
}

function findCard(cardName) {
  return allCards.find(c => normalize(c.name) === normalize(cardName));
}

function findUserCard(user, cardName) {
  return user.cards?.find(c => normalize(c.name) === normalize(cardName));
}

function findUserItem(user, itemName) {
  return user.inventory?.find(i => normalize(i) === normalize(itemName));
}

const data = { name: 'sell', description: 'Sell cards or items for Beli.' };

async function execute(message, args) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });

  if (!user) return message.reply('Start your journey with `op start` first!');

  // Ensure username is set if missing
  if (!user.username) {
    user.username = username;
    await user.save();
  }

  if (args.length === 0) {
    return message.reply('Usage: `op sell <card/item name>`\n\nExample: `op sell Nami` or `op sell strawhat`');
  }

  const itemName = args.join(' ').trim();

  // First, try to find as a card
  const userCard = findUserCard(user, itemName);
  if (userCard) {
    const cardDef = findCard(userCard.name);
    
    // Check if card is locked
    if (userCard.locked) {
      return message.reply(`❌ "${userCard.name}" is locked and cannot be sold. Use \`op unlock ${userCard.name}\` to unlock it first.`);
    }

    // Prevent selling UR cards (optional safety measure)
    if (cardDef && cardDef.rank === 'UR') {
      return message.reply(`❌ UR rank cards cannot be sold! "${userCard.name}" is too valuable to sell.`);
    }

    const sellValue = calculateCardValue(userCard, cardDef);
    
    // Remove card from user's collection
    const cardIndex = user.cards.findIndex(c => normalize(c.name) === normalize(userCard.name));
    user.cards.splice(cardIndex, 1);
    
    // Remove from team if present
    const teamIndex = user.team?.findIndex(teamCard => normalize(teamCard) === normalize(userCard.name));
    if (teamIndex !== -1) {
      user.team.splice(teamIndex, 1);
    }
    
    // Add Beli
    user.beli = (user.beli || 0) + sellValue;
    
    await user.save();
    
    const embed = new EmbedBuilder()
      .setTitle('💰 Card Sold!')
      .setDescription(`You sold **${userCard.name}** for ${sellValue} Beli.`)
      .addFields(
        { name: 'Card', value: `[${cardDef?.rank || 'Unknown'}] ${userCard.name}`, inline: true },
        { name: 'Level', value: `${userCard.level || 1}`, inline: true },
        { name: 'Sell Price', value: `${sellValue} Beli`, inline: true },
        { name: 'Total Beli', value: `${user.beli}`, inline: false }
      )
      .setColor(0x2ecc40);
    
    if (cardDef && cardDef.image && cardDef.image !== "placeholder") {
      embed.setThumbnail(cardDef.image);
    }
    
    return message.reply({ embeds: [embed] });
  }

  // Try to find as an item
  const userItem = findUserItem(user, itemName);
  if (userItem) {
    // Check for special items that shouldn't be sold
    const normalizedItem = normalize(userItem);
    if (normalizedItem === 'strawhat') {
      return message.reply(`❌ The Strawhat is too precious to sell! It's Luffy's treasure.`);
    }
    
    const sellValue = calculateItemValue(userItem);
    
    // Remove item from inventory
    const itemIndex = user.inventory.findIndex(i => normalize(i) === normalize(userItem));
    user.inventory.splice(itemIndex, 1);
    
    // Add Beli
    user.beli = (user.beli || 0) + sellValue;
    
    await user.save();
    
    const embed = new EmbedBuilder()
      .setTitle('💰 Item Sold!')
      .setDescription(`You sold **${userItem}** for ${sellValue} Beli.`)
      .addFields(
        { name: 'Item', value: userItem, inline: true },
        { name: 'Sell Price', value: `${sellValue} Beli`, inline: true },
        { name: 'Total Beli', value: `${user.beli}`, inline: false }
      )
      .setColor(0x2ecc40);
    
    return message.reply({ embeds: [embed] });
  }

  // Item not found
  return message.reply(`<:arrow:1375872983029256303> You don't own "${itemName}". Check your collection and inventory to see what you can sell.`);
}


module.exports = { data, execute };