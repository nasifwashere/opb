const { SlashCommandBuilder, EmbedBuilder  } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');

const shopPath = path.resolve('data', 'shop.json');

function loadShopData() {
  if (!fs.existsSync(shopPath)) {
    return { items: [], cards: [], boosts: [] };
  }
  return JSON.parse(fs.readFileSync(shopPath, 'utf8'));
}

function findShopItem(itemName, shopData) {
  const allItems = [...shopData.items, ...shopData.cards, ...shopData.boosts];
  return allItems.find(item =>
    item.name.toLowerCase() === itemName.toLowerCase() ||
    item.name.toLowerCase().includes(itemName.toLowerCase())
  );
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
    return message.reply(`Item "${itemName}" not found in shop. Use \`op shop\` to see available items.`);
  }

  if (!item.available) {
    return message.reply(`⚠️ "${item.name}" is currently out of stock.`);
  }

  if (user.beli < item.price) {
    return message.reply(`⚠️ You don't have enough Beli! You need ${item.price}, but you only have ${user.beli}.`);
  }

  const normalizedItemName = item.name.toLowerCase().replace(/\s+/g, '');
  if (item.unique && user.inventory && user.inventory.includes(normalizedItemName)) {
    return message.reply(`⚠️ You already own "${item.name}". This item can only be purchased once.`);
  }

  // Process purchase
  user.beli -= item.price;

  if (item.type === 'item' || item.type === 'equipment') {
    if (!user.inventory) user.inventory = [];
    user.inventory.push(normalizedItemName);
  } else if (item.type === 'boost') {
    if (!user.activeBoosts) user.activeBoosts = [];

    switch (item.effect) {
      case 'double_xp':
        user.activeBoosts.push({
          type: 'double_xp',
          expiresAt: Date.now() + (item.duration || 3600000),
          name: item.name
        });
        break;
      case 'beli_boost':
        user.activeBoosts.push({
          type: 'beli_boost',
          expiresAt: Date.now() + (item.duration || 3600000),
          multiplier: 1.5,
          name: item.name
        });
        break;
      case 'reset_pull_cooldown':
        user.pullLast = 0;
        if (!user.inventory) user.inventory = [];
        user.inventory.push(normalizedItemName);
        break;
      case 'no_battle_cooldown':
        user.activeBoosts.push({
          type: 'no_battle_cooldown',
          expiresAt: Date.now() + (item.duration || 1800000),
          name: item.name
        });
        break;
      case 'fast_explore':
        user.activeBoosts.push({
          type: 'fast_explore',
          expiresAt: Date.now() + (item.duration || 7200000),
          reduction: 0.75,
          name: item.name
        });
        break;
      default:
        if (!user.inventory) user.inventory = [];
        user.inventory.push(normalizedItemName);
        break;
    }
  } else if (item.type === 'card') {
    if (!user.cards) user.cards = [];
    user.cards.push({
      name: item.name,
      rank: item.rank || 'C',
      level: 1,
      timesUpgraded: 0
    });
  }

  // Update quest progress for market transactions
  const { updateQuestProgress } = require('../utils/questSystem.js');
  await updateQuestProgress(user, 'market_transaction', 1);

  await user.save();

  const embed = new EmbedBuilder()
    .setTitle('✅ Purchase Successful')
    .setDescription(`You bought **${item.name}** for **${item.price} Beli**.`)
    .addFields(
      { name: 'Item', value: item.name, inline: true },
      { name: 'Price', value: `${item.price.toLocaleString()} Beli`, inline: true },
      { name: 'Remaining Beli', value: `${user.beli.toLocaleString()}`, inline: true }
    )
    .setColor(0x2c2f33)
    .setFooter({ text: 'Shop · One Piece Bot', iconURL: 'https://i.imgur.com/KqAB5Mn.png' });

  if (item.description) {
    embed.addFields({ name: 'Description', value: item.description, inline: false });
  }

  await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };