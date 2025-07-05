const { SlashCommandBuilder, EmbedBuilder  } = require('discord.js');
const User = require('../db/models/User.js');
const { addCardWithTransformation } = require('../utils/cardTransformationSystem.js');
const fs = require('fs');
const path = require('path');

const shopPath = path.resolve('data', 'shop.json');

function loadShopData() {
  if (!fs.existsSync(shopPath)) {
    return { items: [], cards: [], boosts: [], devilFruits: [] };
  }
  return JSON.parse(fs.readFileSync(shopPath, 'utf8'));
}

function findShopItem(itemName, shopData) {
  const normalizedTarget = itemName.toLowerCase();
  const allItems = [...shopData.items, ...shopData.cards, ...shopData.boosts, ...(shopData.devilFruits || [])];
  
  // First try exact match
  let exactMatch = allItems.find(item =>
    item.name.toLowerCase() === normalizedTarget
  );
  if (exactMatch) return exactMatch;
  
  // Then try fuzzy matching - contains search
  let fuzzyMatch = allItems.find(item =>
    item.name.toLowerCase().includes(normalizedTarget) ||
    normalizedTarget.includes(item.name.toLowerCase())
  );
  if (fuzzyMatch) return fuzzyMatch;
  
  // Finally try partial word matching
  const targetWords = normalizedTarget.split(' ');
  return allItems.find(item => {
    const itemWords = item.name.toLowerCase().split(' ');
    return targetWords.some(targetWord => 
      itemWords.some(itemWord => 
        itemWord.includes(targetWord) || targetWord.includes(itemWord)
      )
    );
  });
}

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

const data = new SlashCommandBuilder()
  .setName('buy')
  .setDescription('Buy items from the shop using Beli.');

async function execute(message, args) {
  const userId = message.author.id;
  const itemName = args.join(' ').trim();

  if (!itemName) {
    return message.reply('Usage: `op buy <item name>`\n\nUse `op shop` to see available items.');
  }

  let user = await User.findOne({ userId });
  if (!user) return message.reply('Start your journey with `op start` first!');

  if (!user.username) {
    user.username = message.author.username;
    await user.save();
  }

  const shopData = loadShopData();
  const item = findShopItem(itemName, shopData);

  if (!item) {
    return message.reply(`Item "${itemName}" not found in shop. Try using partial names like "potion" or "devil". Use \`op shop\` to see available items.`);
  }

  if (!item.available) {
    return message.reply(`"${item.name}" is currently out of stock.`);
  }

  if (user.beli < item.price) {
    return message.reply(`You don't have enough Beli! You need ${item.price}, but you only have ${user.beli}.`);
  }

  const normalizedItemName = normalize(item.name);
  if (item.unique && user.inventory && user.inventory.includes(normalizedItemName)) {
    return message.reply(`You already own "${item.name}". This item can only be purchased once.`);
  }

  // Process purchase
  user.beli -= item.price;

  // Handle different item types
  if (item.type === 'potion' || item.type === 'equipment') {
    if (!user.inventory) user.inventory = [];
    user.inventory.push(normalizedItemName);
  } else if (item.type === 'card') {
    const cardToAdd = {
      name: item.name,
      rank: item.rank || 'C',
      level: 1,
      experience: 0,
      timesUpgraded: 0,
      locked: false
    };
    addCardWithTransformation(user, cardToAdd);
  } else {
    // Default to inventory for any other items
    if (!user.inventory) user.inventory = [];
    user.inventory.push(normalizedItemName);
  }

  // Update quest progress for market transactions
  try {
    const { updateQuestProgress } = require('../utils/questSystem.js');
    await updateQuestProgress(user, 'market_transaction', 1);
  } catch (error) {
    // Ignore quest system errors
  }

  await user.save();

  // Build item type description
  let itemTypeDesc = '';
  if (item.type === 'potion') {
    itemTypeDesc = ` (Heals ${item.healPercent}% HP in battle)`;
  } else if (item.type === 'equipment') {
    const statBoosts = item.statBoost || {};
    const boostText = Object.entries(statBoosts)
      .map(([stat, boost]) => `${stat} +${boost}%`)
      .join(', ');
    itemTypeDesc = boostText ? ` (${boostText})` : '';
  }

  const embed = new EmbedBuilder()
    .setTitle('<:check:1390838766821965955> Purchase Successful')
    .setDescription(`You bought **${item.name}**${itemTypeDesc} for **${item.price} Beli**.`)
    .addFields(
      { name: 'Item', value: item.name, inline: true },
      { name: 'Price', value: `${item.price.toLocaleString()} Beli`, inline: true },
      { name: 'Remaining Beli', value: `${user.beli.toLocaleString()}`, inline: true }
    )
    .setColor(0x2c2f33)
    .setFooter({ text: 'Shop · One Piece Bot' });

  if (item.description) {
    embed.addFields({ name: 'Description', value: item.description, inline: false });
  }

  await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };