const { EmbedBuilder } = require('discord.js');
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

const data = { name: 'buy', description: 'Buy items from the shop using Beli.' };

async function execute(message, args) {
  const userId = message.author.id;
  const itemName = args.join(' ').trim();

  if (!itemName) {
    return message.reply('Usage: `op buy <item name>`\n\nUse `op shop` to see available items.');
  }

  const user = await User.findOne({ userId });
  if (!user) return message.reply('Start your journey with `op start` first!');

  const shopData = loadShopData();
  const item = findShopItem(itemName, shopData);

  if (!item) {
    return message.reply(`❌ Item "${itemName}" not found in shop. Use \`op shop\` to see available items.`);
  }

  if (!item.available) {
    return message.reply(`❌ "${item.name}" is currently out of stock.`);
  }

  if (user.beli < item.price) {
    return message.reply(`❌ You don't have enough Beli! You need ${item.price} but only have ${user.beli}.`);
  }

  // Check if user already owns the item (for unique items)
  if (item.unique && user.inventory && user.inventory.includes(item.name.toLowerCase().replace(/\s+/g, ''))) {
    return message.reply(`❌ You already own "${item.name}". This item can only be purchased once.`);
  }

  // Process purchase
  user.beli -= item.price;

  if (item.type === 'item') {
    if (!user.inventory) user.inventory = [];
    user.inventory.push(item.name.toLowerCase().replace(/\s+/g, ''));
  } else if (item.type === 'boost') {
    // Apply boost effects immediately
    if (!user.activeBoosts) user.activeBoosts = [];
    
    switch (item.effect) {
      case 'double_xp':
        user.activeBoosts.push({
          type: 'double_xp',
          expiresAt: Date.now() + item.duration,
          name: item.name
        });
        break;
      case 'beli_boost':
        user.activeBoosts.push({
          type: 'beli_boost',
          expiresAt: Date.now() + item.duration,
          multiplier: 1.5,
          name: item.name
        });
        break;
      case 'reset_pull_cooldown':
        user.pullLast = 0;
        break;
      case 'no_battle_cooldown':
        user.activeBoosts.push({
          type: 'no_battle_cooldown',
          expiresAt: Date.now() + item.duration,
          name: item.name
        });
        break;
      case 'fast_explore':
        user.activeBoosts.push({
          type: 'fast_explore',
          expiresAt: Date.now() + item.duration,
          reduction: 0.75,
          name: item.name
        });
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

  await user.save();

  const embed = new EmbedBuilder()
    .setTitle('🛍️ Purchase Successful!')
    .setDescription(`You bought **${item.name}** for ${item.price} Beli!`)
    .addFields(
      { name: 'Item', value: item.name, inline: true },
      { name: 'Price', value: `${item.price} Beli`, inline: true },
      { name: 'Remaining Beli', value: `${user.beli}`, inline: true }
    )
    .setColor(0x2ecc40);

  if (item.description) {
    embed.addFields({ name: 'Description', value: item.description, inline: false });
  }

  await message.reply({ embeds: [embed] });
}


module.exports = { data, execute };