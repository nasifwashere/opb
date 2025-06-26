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

const data = {
  name: 'unequip',
  description: 'Unequip an item from a card.',
};

// Usage: op unequip luffy
async function execute(message, args, client) {
  const userId = message.author.id;
  const cardName = args.join(' ');
  if (!cardName) return message.reply('Usage: op unequip [card]');

  const user = await User.findOne({ userId });
  if (!user) return message.reply('Start your journey with `op start`!');
  if (!user.equipped) return message.reply(`You don't have any equipped items!`);

  const cardObj = fuzzyFindCard(user.cards || [], cardName);
  if (!cardObj) return message.reply(`You don't have "${cardName}".`);

  const normCard = normalize(cardObj.name);

  if (!user.equipped[normCard])
    return message.reply(`No item equipped to ${cardObj.name}.`);

  const unequippedItem = user.equipped[normCard];
  delete user.equipped[normCard];

  if (!user.inventory) user.inventory = [];
  user.inventory.push(unequippedItem);

  await user.save();
  return message.reply(`✅ Unequipped ${unequippedItem} from ${cardObj.name}!`);
}

module.exports = { data, execute };
