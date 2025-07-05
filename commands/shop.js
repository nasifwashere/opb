const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle  } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');

const shopPath = path.resolve('data', 'shop.json');

function loadShopData() {
  if (!fs.existsSync(shopPath)) {
    // Create default shop data if file doesn't exist
    const defaultShop = {
      items: [
        { name: 'Healing Potion', price: 100, description: 'Restores HP in battle', type: 'item', available: true },
        { name: 'Power Boost', price: 200, description: 'Increases attack damage temporarily', type: 'boost', available: true },
        { name: 'Lucky Charm', price: 150, description: 'Increases rare pull chances', type: 'item', available: true }
      ],
      cards: [
        { name: 'Training Dummy', price: 500, description: 'Basic training card', type: 'card', rank: 'C', available: true }
      ],
      boosts: [
        { name: 'XP Booster', price: 300, description: 'Doubles XP gain for 1 hour', type: 'boost', available: true, duration: 3600000 },
        { name: 'Beli Multiplier', price: 400, description: 'Increases Beli rewards by 50%', type: 'boost', available: true, duration: 3600000 }
      ]
    };
    fs.writeFileSync(shopPath, JSON.stringify(defaultShop, null, 2));
    return defaultShop;
  }
  return JSON.parse(fs.readFileSync(shopPath, 'utf8'));
}

function createShopEmbed(category, items) {
  const categoryNames = {
    potions: '🧪 Potions',
    equipment: '⚔️ Equipment',
    legendary: '⭐ Legendary Items',
    items: '📦 Items',
    devilfruits: '🍎 Devil Fruits'
  };

  const embed = new EmbedBuilder()
    .setTitle(`Shop - ${categoryNames[category] || '🛒 All Items'}`)
    .setDescription('Purchase items with your Beli!')
    .setColor(0x2b2d31)
    .setFooter({ text: 'Use op buy <item name> to purchase' });

  if (items.length === 0) {
    embed.addFields({ name: 'No Items', value: 'No items available in this category.', inline: false });
    return embed;
  }

  items.forEach((item, index) => {
    const status = item.available ? '✅ Available' : '❌ Out of Stock';
    const duration = item.duration ? `\nDuration: ${Math.floor(item.duration / 60000)} minutes` : '';
    const rarity = item.rarity ? getRarityEmoji(item.rarity) : '';
    const statBoostText = getStatBoostText(item.statBoost);

    embed.addFields({
      name: `${index + 1}. ${item.name} ${rarity}`,
      value: `**${item.price.toLocaleString()} Beli**\n${status}\n${item.description}${statBoostText}${duration}`,
      inline: true
    });
  });

  return embed;
}

function getRarityEmoji(rarity) {
  const rarityEmojis = {
    'common': '⚪',
    'uncommon': '🟢',
    'rare': '🔵',
    'epic': '🟣',
    'legendary': '🟠'
  };
  return rarityEmojis[rarity] || '';
}

function getStatBoostText(statBoost) {
  if (!statBoost) return '';
  
  const boosts = [];
  if (statBoost.power) boosts.push(`+${statBoost.power}% ATK`);
  if (statBoost.health) boosts.push(`+${statBoost.health}% HP`);
  if (statBoost.speed) boosts.push(`+${statBoost.speed}% SPD`);
  
  return boosts.length > 0 ? `\n${boosts.join(', ')}` : '';
}

function createShopButtons(currentCategory) {
  const buttons = [
    new ButtonBuilder()
      .setCustomId('shop_potions')
      .setLabel('🧪 Potions')
      .setStyle(currentCategory === 'potions' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('shop_equipment')
      .setLabel('⚔️ Equipment')
      .setStyle(currentCategory === 'equipment' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('shop_legendary')
      .setLabel('⭐ Legendary')
      .setStyle(currentCategory === 'legendary' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('shop_items')
      .setLabel('📦 Items')
      .setStyle(currentCategory === 'items' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('shop_all')
      .setLabel('🛒 All')
      .setStyle(currentCategory === 'all' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  ];

  return new ActionRowBuilder().addComponents(buttons);
}

const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('Browse and purchase items, cards, and boosts.');

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
    await user.save();
  }

  const shopData = loadShopData();
  let currentCategory = 'all';

  // Check if user specified a category
  if (args.length > 0) {
    const categoryArg = args[0].toLowerCase();
    if (['potions', 'equipment', 'legendary', 'items', 'devilfruits'].includes(categoryArg)) {
      currentCategory = categoryArg;
    }
  }

  // Get items for current category
  let items = [];
  if (currentCategory === 'all') {
    items = [...(shopData.potions || []), ...(shopData.equipment || []), ...(shopData.legendary || []), ...(shopData.items || []), ...(shopData.devilfruits || [])];
  } else {
    items = shopData[currentCategory] || [];
  }

  const embed = createShopEmbed(currentCategory, items);
  const components = [createShopButtons(currentCategory)];

  // Add user's current Beli to embed
  embed.addFields({ name: 'Your Beli', value: `${(user.beli || 0).toLocaleString()} Beli`, inline: false });

  const shopMessage = await message.reply({ embeds: [embed], components });

  // Button interaction collector
  const filter = i => i.user.id === userId;
  const collector = shopMessage.createMessageComponentCollector({ filter, time: 300000 });

  collector.on('collect', async interaction => {
    await interaction.deferUpdate();

    if (interaction.customId.startsWith('shop_')) {
      const newCategory = interaction.customId.split('_')[1];
      currentCategory = newCategory;

      // Get items for new category
      let newItems = [];
      if (currentCategory === 'all') {
        newItems = [...(shopData.potions || []), ...(shopData.equipment || []), ...(shopData.legendary || []), ...(shopData.items || []), ...(shopData.devilfruits || [])];
      } else {
        newItems = shopData[currentCategory] || [];
      }

      const newEmbed = createShopEmbed(currentCategory, newItems);
      const newComponents = [createShopButtons(currentCategory)];

      // Update user's current Beli
      const updatedUser = await User.findOne({ userId });
      newEmbed.addFields({ name: 'Your Beli', value: `${(updatedUser.beli || 0).toLocaleString()} Beli`, inline: false });

      await shopMessage.edit({ embeds: [newEmbed], components: newComponents });
    }
  });

  collector.on('end', () => {
    shopMessage.edit({ components: [] }).catch(() => {});
  });
}

module.exports = { data, execute };