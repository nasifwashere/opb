const { SlashCommandBuilder } = require('discord.js');
const User = require('../db/models/User.js');

// Normalize string for fuzzy matching
function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

// Fuzzy find a card from user's card list
function fuzzyFindCard(cards, input) {
  const normInput = normalize(input);
  let bestMatch = null;
  let bestScore = 0;

  for (const card of cards) {
    const normName = normalize(card.name);
    let score = 0;

    if (normName === normInput) score = 3;
    else if (normName.includes(normInput)) score = 2;
    else if (normName.startsWith(normInput)) score = 1;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = card;
    }
  }

  return bestMatch;
}

const data = new SlashCommandBuilder()
  .setName('unequip')
  .setDescription('Unequip an item from a card.');

async function execute(message, args) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });

  if (!user) {
    return message.reply('Start your journey with `op start` first!');
  }

  // Ensure username is set if missing
  if (!user.username) {
    user.username = username;
    await user.save();
  }

  if (args.length === 0) {
    return message.reply('Usage: `op unequip <card name>`');
  }

  const cardInput = args.join(' ');
  const userCard = fuzzyFindCard(user.cards || [], cardInput);

  if (!userCard) {
    return message.reply(`You don't own a card named "${cardInput}".`);
  }

  const normCard = normalize(userCard.name);

  if (!user.equipped || !user.equipped[normCard]) {
    return message.reply(`${userCard.name} has no equipment to unequip.`);
  }

  const equippedItem = user.equipped[normCard];

  // Remove from equipped and add back to inventory
  delete user.equipped[normCard];
  user.inventory = user.inventory || [];
  user.inventory.push(equippedItem);

  await user.save();

  return message.reply(`<:sucess:1375872950321811547> Unequipped ${equippedItem} from ${userCard.name}!`);
}

module.exports = { data, execute };