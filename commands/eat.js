const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');
const { normalizeInventory } = require('../utils/inventoryUtils.js');

const shopPath = path.resolve('data', 'shop.json');
const shopData = JSON.parse(fs.readFileSync(shopPath, 'utf8'));

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function fuzzyFindCard(cards, input) {
  if (!cards || cards.length === 0) return null;
  
  const normInput = normalize(input);
  
  // First try exact match
  let match = cards.find(card => normalize(card.name) === normInput);
  if (match) return match;
  
  // Then try partial matches with scoring
  let bestMatch = null;
  let bestScore = 0;

  for (const card of cards) {
    const normName = normalize(card.name);
    let score = 0;

    if (normName.includes(normInput)) score = 2;
    else if (normName.startsWith(normInput)) score = 1;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = card;
    }
  }

  return bestMatch;
}

function findShopFruit(fruitName) {
  const normalized = normalize(fruitName);
  const allFruits = [
    ...(shopData.devilFruits || []),
    ...(shopData.devilfruits || [])
  ];
  return allFruits.find(fruit => normalize(fruit.name) === normalized);
}

const data = new SlashCommandBuilder()
  .setName('eat')
  .setDescription('Feed a devil fruit from your inventory to a card (permanent).')
  .addStringOption(option =>
    option.setName('fruit')
      .setDescription('Name of the devil fruit in your inventory')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('card')
      .setDescription('Name of the card to eat the fruit')
      .setRequired(true));

async function execute(message, args) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });

  if (!user) {
    return message.reply('Start your journey with `op start` first!');
  }

  // Always normalize inventory to a flat array of strings
  user.inventory = normalizeInventory(user.inventory);

  if (args.length < 2) {
    return message.reply('Usage: `op eat <fruit name> <card name>`');
  }

  const fruitName = args[0];
  const cardName = args.slice(1).join(' ');
  const shopFruit = findShopFruit(fruitName);
  if (!shopFruit) {
    return message.reply('That devil fruit does not exist.');
  }
  // Check inventory
  const invIndex = user.inventory.findIndex(i => normalize(i) === normalize(shopFruit.name));
  if (invIndex === -1) {
    return message.reply(`You do not have any ${shopFruit.name} in your inventory.`);
  }
  // Find the card with fuzzy matching
  const card = fuzzyFindCard(user.cards || [], cardName);
  if (!card) {
    return message.reply(`You don't own a card named **${cardName}**. Try using partial names like "luffy" or "gear"!`);
  }
  // Check if card already ate a devil fruit
  if (card.eatenFruit) {
    return message.reply(`**${card.name}** has already eaten a devil fruit (${card.eatenFruit}) and cannot eat another!`);
  }
  // Remove fruit from inventory
  user.inventory.splice(invIndex, 1);
  // Mark fruit as eaten
  card.eatenFruit = shopFruit.name;
  await user.save();
  const embed = new EmbedBuilder()
    .setTitle('Devil Fruit Eaten!')
    .setDescription(`**${card.name}** has eaten the **${shopFruit.name}**! This is permanent and cannot be undone.`)
    .setColor(0x2b2d31);
  return message.reply({ embeds: [embed] });
}

module.exports = { data, execute };
