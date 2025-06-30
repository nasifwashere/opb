const { EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

const ITEM_DESCRIPTIONS = {
  'strawhat': { desc: 'Luffy\'s iconic hat - Equip to Luffy for +30% stats', usage: 'op equip strawhat luffy' },
  'luckycharm': { desc: 'Increases rare card pull chances', usage: 'Passive effect when owned' },
  'healingpotion': { desc: 'Restores 50 HP during battle', usage: 'Use during battle' },
  'powerboost': { desc: 'Temporarily increases attack by 25%', usage: 'Use before battle' },
  'trainingmanual': { desc: 'Reduces level-up cost by 50%', usage: 'Use before leveling' },
  'treasuremapfragment': { desc: 'Collect 3 for special reward', usage: 'Collect more fragments' },
  'speedboost': { desc: 'Increases speed stat by 10%', usage: 'op equip speedboost <card>' },
  'timecrystal': { desc: 'Removes all exploration cooldowns', usage: 'op use timecrystal' },
  'energypotion': { desc: 'Removes defeat cooldown', usage: 'op use energypotion' },
  'speedboostfood': { desc: 'Temporary speed boost for team', usage: 'op use speedboostfood' }
};

const data = { name: 'inventory', description: 'View your inventory items with descriptions.' };

async function execute(message, args, client) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });

  if (!user) {
    return message.reply('Start your journey with `op start`!');
  }

  // Ensure username is set if missing
  if (!user.username) {
    user.username = username;
    await user.save();
  }

  const inventory = Array.isArray(user.inventory) ? user.inventory : [];

  if (!inventory.length) {
    const embed = new EmbedBuilder()
      .setTitle('<:emptybox:1388587415018410177> Empty Inventory')
      .setDescription('Your inventory is empty! Collect items on your adventure.')
      .setColor(0x95a5a6)
      .addFields({
        name: ' How to get items:',
        value: '• Complete exploration stages\n• Purchase from shop with `op shop`\n• Complete quests with `op quest`',
        inline: false
      });

    return message.reply({ embeds: [embed] });
  }

  // Count duplicates
  const itemCounts = {};
  inventory.forEach(item => {
    itemCounts[item] = (itemCounts[item] || 0) + 1;
  });

  const embed = new EmbedBuilder()
    .setTitle(`<:emptybox:1388587415018410177> ${message.author.username}'s Inventory`)
    .setDescription(`You have ${inventory.length} items in your inventory`)
    .setColor(0x3498db)
    .setThumbnail(message.author.displayAvatarURL());

  let itemsText = '';
  for (const [itemName, count] of Object.entries(itemCounts)) {
    const itemInfo = ITEM_DESCRIPTIONS[itemName.toLowerCase()] || { 
      desc: 'Unknown item', 
      usage: 'Check item details' 
    };

    const displayName = itemName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    const countText = count > 1 ? ` x${count}` : '';

    itemsText += `**${displayName}${countText}**\n`;
    itemsText += `${itemInfo.desc}\n`;
    itemsText += `*Usage:* ${itemInfo.usage}\n\n`;
  }

  embed.addFields({ 
    name: '<:emptybox:1388587415018410177> Your Items:', 
    value: itemsText || 'No items found', 
    inline: false 
  });

  embed.addFields({
    name: ' Equipment Tips:',
    value: '• Use `op equip <item> <card>` to equip items\n• Use `op use <item>` for consumables\n• Some items work automatically when owned',
    inline: false
  });

  await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };