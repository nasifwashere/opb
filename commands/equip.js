const User = require('../db/models/User.js');

// Normalize string for fuzzy matching
function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

// Fuzzy find in array of strings (inventory items)
function fuzzyFind(arr, target) {
  const normTarget = normalize(target);
  return arr.find(i => normalize(i) === normTarget) || null;
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
  name: 'equip',
  description: 'Equip an item to a card.',
};

// Usage: op equip strawhat luffy
async function execute(message, args, client) {
  const userId = message.author.id;
  const [itemName, ...cardParts] = args;
  const cardName = cardParts.join(' ');
  if (!itemName || !cardName) return message.reply('Usage: op equip [item] [card]');

  const user = await User.findOne({ userId });
  if (!user) return message.reply('Start your journey with `op start`!');
  if (!Array.isArray(user.inventory) || user.inventory.length === 0)
    return message.reply(`Your inventory is empty!`);

  const ownedItem = fuzzyFind(user.inventory, itemName);
  if (!ownedItem)
    return message.reply(`You don't have "${itemName}".`);

  const cardObj = fuzzyFindCard(user.cards || [], cardName);
  if (!cardObj)
    return message.reply(`You don't have "${cardName}".`);

  const normItem = normalize(ownedItem);
  const normCard = normalize(cardObj.name);

  // Strawhat lock logic
  if (normItem === 'strawhat' && !normCard.includes('luffy')) {
    return message.reply('The Strawhat can only be equipped on Monkey D. Luffy!');
  }

  if (!user.equipped) user.equipped = {};

  // Unequip old item if needed
  if (user.equipped[normCard]) {
    user.inventory.push(user.equipped[normCard]);
  }

  user.equipped[normCard] = ownedItem;

  // Remove item from inventory
  const idx = user.inventory.findIndex(i => normalize(i) === normItem);
  if (idx !== -1) user.inventory.splice(idx, 1);

  await user.save();
  return message.reply(`✅ Equipped ${ownedItem} to ${cardObj.name}!`);
}

module.exports = { data, execute };
