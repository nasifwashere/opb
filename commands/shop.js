
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle  } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');

const shopPath = path.resolve('data', 'shop.json');

function loadShopData() {
  if (!fs.existsSync(shopPath)) {
    // Create default shop data if file doesn't exist
    const defaultShop = {
      potions: [
        { name: 'Healing Potion', price: 100, description: 'Restores HP in battle', type: 'item', available: true },
        { name: 'Power Boost', price: 200, description: 'Increases attack damage temporarily', type: 'boost', available: true },
        { name: 'Lucky Charm', price: 150, description: 'Increases rare pull chances', type: 'item', available: true }
      ],
      equipment: [
        { name: 'Training Dummy', price: 500, description: 'Basic training equipment', type: 'equipment', available: true }
      ],
      legendary: [
        { name: 'XP Booster', price: 300, description: 'Doubles XP gain for 1 hour', type: 'boost', available: true, duration: 3600000 },
        { name: 'Beli Multiplier', price: 400, description: 'Increases Beli rewards by 50%', type: 'boost', available: true, duration: 3600000 }
      ],
      items: [
        { name: 'Basic Item', price: 50, description: 'A basic utility item', type: 'item', available: true }
      ],
      devilfruits: [
        { name: 'Random Devil Fruit', price: 1000, description: 'A mysterious devil fruit', type: 'devilfruit', available: true }
      ]
    };
    fs.writeFileSync(shopPath, JSON.stringify(defaultShop, null, 2));
    return defaultShop;
  }
  return JSON.parse(fs.readFileSync(shopPath, 'utf8'));
}

function createWelcomeEmbed(userBeli) {
  const embed = new EmbedBuilder()
    .setTitle('Welcome to the Shop')
    .setDescription('Browse our selection of items, equipment, and more.\nSelect a category below to get started.')
    .setColor(0x2b2d31)
    .addFields(
      { name: 'Categories Available', value: 'Potions • Equipment • Legendary • Items • Devil Fruits', inline: false },
      { name: 'Your Balance', value: `${userBeli.toLocaleString()} Beli`, inline: false }
    )
    .setFooter({ text: 'Use the buttons below to browse categories' });

  return embed;
}

function createShopEmbed(category, items, page = 0) {
  const categoryNames = {
    potions: 'Potions',
    equipment: 'Equipment', 
    legendary: 'Legendary Items',
    items: 'Items',
    devilfruits: 'Devil Fruits'
  };

  const itemsPerPage = 15; // Reduced to prevent flooding
  const startIndex = page * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageItems = items.slice(startIndex, endIndex);
  const totalPages = Math.ceil(items.length / itemsPerPage);

  const embed = new EmbedBuilder()
    .setTitle(`Shop • ${categoryNames[category]}`)
    .setDescription('Purchase items with your Beli')
    .setColor(0x2b2d31)
    .setFooter({ text: `Page ${page + 1}/${totalPages || 1} • Use "op buy <item name>" to purchase` });

  if (pageItems.length === 0) {
    embed.addFields({ name: 'No Items Available', value: 'This category is currently empty.', inline: false });
    return embed;
  }

  pageItems.forEach((item, index) => {
    const status = item.available ? 'Available' : 'Out of Stock';
    const duration = item.duration ? `\nDuration: ${Math.floor(item.duration / 60000)} minutes` : '';
    const statBoostText = getStatBoostText(item.statBoost);

    embed.addFields({
      name: `${startIndex + index + 1}. ${item.name}`,
      value: `**${item.price.toLocaleString()} Beli** • ${status}\n${item.description}${statBoostText}${duration}`,
      inline: true
    });
  });

  return embed;
}

function getStatBoostText(statBoost) {
  if (!statBoost) return '';
  
  const boosts = [];
  if (statBoost.power) boosts.push(`+${statBoost.power}% ATK`);
  if (statBoost.health) boosts.push(`+${statBoost.health}% HP`);
  if (statBoost.speed) boosts.push(`+${statBoost.speed}% SPD`);
  
  return boosts.length > 0 ? `\n${boosts.join(', ')}` : '';
}

function createShopButtons(currentCategory, currentPage, totalPages) {
  const categoryButtons = [
    new ButtonBuilder()
      .setCustomId('shop_potions')
      .setLabel('Potions')
      .setStyle(currentCategory === 'potions' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('shop_equipment')
      .setLabel('Equipment')
      .setStyle(currentCategory === 'equipment' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('shop_legendary')
      .setLabel('Legendary')
      .setStyle(currentCategory === 'legendary' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('shop_items')
      .setLabel('Items')
      .setStyle(currentCategory === 'items' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('shop_devilfruits')
      .setLabel('Devil Fruits')
      .setStyle(currentCategory === 'devilfruits' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  ];

  const rows = [new ActionRowBuilder().addComponents(categoryButtons)];

  // Add pagination buttons if needed
  if (totalPages > 1) {
    const paginationButtons = [];
    
    if (currentPage > 0) {
      paginationButtons.push(
        new ButtonBuilder()
          .setCustomId('shop_prev')
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary)
      );
    }
    
    if (currentPage < totalPages - 1) {
      paginationButtons.push(
        new ButtonBuilder()
          .setCustomId('shop_next')
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    if (paginationButtons.length > 0) {
      rows.push(new ActionRowBuilder().addComponents(paginationButtons));
    }
  }

  return rows;
}

const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('Browse and purchase items, equipment, and boosts.');

async function execute(message, args) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });

  if (!user) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription('Start your journey with `op start` first!')
      .setFooter({ text: 'Use "op start" to begin your adventure' });
    
    return message.reply({ embeds: [embed] });
  }

  // Ensure username is set if missing
  if (!user.username) {
    user.username = username;
    await user.save();
  }

  const shopData = loadShopData();
  let currentCategory = 'welcome';
  let currentPage = 0;

  // Check if user specified a category
  if (args.length > 0) {
    const categoryArg = args[0].toLowerCase();
    if (['potions', 'equipment', 'legendary', 'items', 'devilfruits'].includes(categoryArg)) {
      currentCategory = categoryArg;
    }
  }

  let embed, components;

  if (currentCategory === 'welcome') {
    embed = createWelcomeEmbed(user.beli || 0);
    components = createShopButtons('welcome', 0, 1);
  } else {
    // Get items for current category
    const items = shopData[currentCategory] || [];
    const itemsPerPage = 15;
    const totalPages = Math.ceil(items.length / itemsPerPage);
    embed = createShopEmbed(currentCategory, items, currentPage);
    components = createShopButtons(currentCategory, currentPage, totalPages);
    
    // Add user's current Beli to embed
    embed.addFields({ name: 'Your Balance', value: `${(user.beli || 0).toLocaleString()} Beli`, inline: false });
  }

  const shopMessage = await message.reply({ embeds: [embed], components });

  // Button interaction collector
  const filter = i => i.user.id === userId;
  const collector = shopMessage.createMessageComponentCollector({ filter, time: 300000 });

  collector.on('collect', async interaction => {
    await interaction.deferUpdate();

    if (interaction.customId.startsWith('shop_')) {
      const action = interaction.customId.split('_')[1];
      
      if (action === 'prev') {
        currentPage = Math.max(0, currentPage - 1);
      } else if (action === 'next') {
        const items = shopData[currentCategory] || [];
        const itemsPerPage = 15;
        const maxPage = Math.ceil(items.length / itemsPerPage) - 1;
        currentPage = Math.min(maxPage, currentPage + 1);
      } else if (['potions', 'equipment', 'legendary', 'items', 'devilfruits'].includes(action)) {
        // Category change
        currentCategory = action;
        currentPage = 0;
      }

      let newEmbed, newComponents;

      if (currentCategory === 'welcome') {
        const updatedUser = await User.findOne({ userId });
        newEmbed = createWelcomeEmbed(updatedUser.beli || 0);
        newComponents = createShopButtons('welcome', 0, 1);
      } else {
        // Get items for current category
        const items = shopData[currentCategory] || [];
        const itemsPerPage = 15;
        const totalPages = Math.ceil(items.length / itemsPerPage);
        newEmbed = createShopEmbed(currentCategory, items, currentPage);
        newComponents = createShopButtons(currentCategory, currentPage, totalPages);

        // Update user's current Beli
        const updatedUser = await User.findOne({ userId });
        newEmbed.addFields({ name: 'Your Balance', value: `${(updatedUser.beli || 0).toLocaleString()} Beli`, inline: false });
      }

      await shopMessage.edit({ embeds: [newEmbed], components: newComponents });
    }
  });

  collector.on('end', () => {
    shopMessage.edit({ components: [] }).catch(() => {});
  });
}

module.exports = { data, execute };
