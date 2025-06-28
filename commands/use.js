
const { EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

const USABLE_ITEMS = {
  'timecrystal': {
    name: 'Time Crystal',
    description: 'Instantly removes all exploration cooldowns',
    effect: 'clear_explore_cooldowns',
    consumable: true
  },
  'energypotion': {
    name: 'Energy Potion',
    description: 'Removes defeat cooldown',
    effect: 'clear_defeat_cooldown',
    consumable: true
  },
  'speedboostfood': {
    name: 'Speed Boost Food',
    description: 'Temporary speed boost for your team',
    effect: 'speed_boost',
    consumable: true,
    duration: 60 * 60 * 1000 // 1 hour
  }
};

const data = { name: 'use', description: 'Use consumable items from your inventory.' };

async function execute(message, args) {
  const userId = message.author.id;
  let user = await User.findOne({ userId });
  
  if (!user) return message.reply("Start your journey with `op start` first!");

  if (!args.length) {
    return message.reply("Usage: `op use <item_name>`\n\nUsable items: Time Crystal, Energy Potion, Speed Boost Food");
  }

  const itemName = args.join(' ').toLowerCase().replace(/\s+/g, '');
  const item = USABLE_ITEMS[itemName];

  if (!item) {
    return message.reply("That item cannot be used or doesn't exist!");
  }

  if (!user.inventory) user.inventory = [];
  const itemIndex = user.inventory.indexOf(itemName);

  if (itemIndex === -1) {
    return message.reply(`You don't have any ${item.name}!`);
  }

  // Apply item effect
  let effectMessage = '';
  const now = Date.now();

  switch (item.effect) {
    case 'clear_explore_cooldowns':
      user.locationCooldowns = new Map();
      effectMessage = 'All exploration cooldowns have been cleared!';
      break;
    case 'clear_defeat_cooldown':
      user.exploreLossCooldown = 0;
      effectMessage = 'Defeat cooldown has been removed!';
      break;
    case 'speed_boost':
      if (!user.activeBoosts) user.activeBoosts = [];
      user.activeBoosts.push({
        type: 'speed_boost',
        expiresAt: now + item.duration,
        multiplier: 1.5
      });
      effectMessage = 'Your team gains a speed boost for 1 hour!';
      break;
  }

  // Remove item if consumable
  if (item.consumable) {
    user.inventory.splice(itemIndex, 1);
  }

  await user.save();

  const embed = new EmbedBuilder()
    .setTitle(`✨ Used ${item.name}`)
    .setDescription(`${item.description}\n\n${effectMessage}`)
    .setColor(0x27ae60);

  return message.reply({ embeds: [embed] });
}

module.exports = { data, execute };
