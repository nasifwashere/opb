const { SlashCommandBuilder, EmbedBuilder  } = require('discord.js');
const User = require('../db/models/User.js');
const { addCardWithTransformation } = require('../utils/cardTransformationSystem.js');
const { normalizeInventory } = require('../utils/inventoryUtils.js');
const fs = require('fs');
const path = require('path');

const shopPath = path.resolve('data', 'shop.json');

function loadShopData() {
  if (!fs.existsSync(shopPath)) {
    return { potions: [], equipment: [], legendary: [], items: [], devilfruits: [] };
  }
  return JSON.parse(fs.readFileSync(shopPath, 'utf8'));
}

function findShopItem(itemName, shopData) {
  const normalizedTarget = itemName.toLowerCase();
  
  // Get all items from new shop structure
  const allItems = [];
  ['potions', 'equipment', 'legendary', 'items', 'devilfruits'].forEach(category => {
    if (shopData[category]) {
      shopData[category].forEach(item => allItems.push(item));
    }
  });
  
  // Also check old structure for backward compatibility
  if (shopData.items) allItems.push(...shopData.items);
  if (shopData.cards) allItems.push(...shopData.cards);
  if (shopData.boosts) allItems.push(...shopData.boosts);
  if (shopData.devilFruits) allItems.push(...shopData.devilFruits);
  
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

  // Always normalize inventory to a flat array of strings
  user.inventory = normalizeInventory(user.inventory);

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
  if (item.unique && user.inventory.includes(normalizedItemName)) {
    return message.reply(`You already own "${item.name}". This item can only be purchased once.`);
  }

  // Process purchase
  user.beli -= item.price;

  // Handle different item types
  if (item.type === 'card') {
    const cardToAdd = {
      name: item.name,
      rank: item.rank || 'C',
      level: 1,
      experience: 0,
      timesUpgraded: 0,
      locked: false
    };
    const addResult = addCardWithTransformation(user, cardToAdd);
    let buyMessage = `<:check:1390838766821965955> You bought **${item.name}** for **${item.price} Beli**.`;
    if (addResult && addResult.autosold) {
      buyMessage += `\n **Duplicate card auto-sold!** You already owned this card, so it was automatically sold.`;
    } else if (addResult && addResult.autoleveled) {
      buyMessage += `\n **Duplicate card auto-leveled!** You already owned this card, so its level was increased.`;
    }
    await message.reply(buyMessage);
  } else {
    // Add the normalized item name to inventory array
    user.inventory.push(normalizedItemName);
    await message.reply(`<:check:1390838766821965955> You bought **${item.name}** for **${item.price} Beli**.`);
  }

  // Do NOT update quest progress for market transactions here (shop purchases should not count)

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

  // Get rarity emoji
  const rarityEmojis = {
    'common': '<:c_:1375608627213242468>',
    'uncommon': '<:b_:1375608257921679360>',
    'rare': '<:a_:1375608345288904786>',
    'epic': '<:s_:1375608412477329600>',
    'legendary': '<:ur:1375608483940139048>'
  };
  const rarityEmoji = item.rarity ? rarityEmojis[item.rarity] : '';

  const embed = new EmbedBuilder()
    .setTitle('<:check:1390838766821965955> Purchase Successful')
    .setDescription(`You bought **${item.name}** ${rarityEmoji}${itemTypeDesc} for **${item.price} Beli**.`)
    .addFields(
      { name: 'Item', value: `${item.name} ${rarityEmoji}`, inline: true },
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