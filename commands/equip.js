import User from '../db/models/User.js';

// Util: Normalize name for fuzzy match (lowercase, no spaces)
function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

// Fuzzy find in array (returns actual item or null)
function fuzzyFind(arr, target) {
  const normTarget = normalize(target);
  return arr.find(i => normalize(i) === normTarget) || null;
}

export const data = { name: 'equip', description: 'Equip an item to a card.' };

// Usage: op equip strawhat money d luffy
export async function execute(message, args, client) {
  const userId = message.author.id;
  const [itemName, ...cardParts] = args;
  const cardName = cardParts.join(' ');
  if (!itemName || !cardName) return message.reply('Usage: op equip [item] [card]');
  const user = await User.findOne({ userId });
  if (!user) return message.reply('Start your journey with `op start`!');
  if (!Array.isArray(user.inventory) || user.inventory.length === 0)
    return message.reply(`Your inventory is empty!`);

  // Fuzzy match the item
  const ownedItem = fuzzyFind(user.inventory, itemName);
  if (!ownedItem)
    return message.reply(`You don't have "${itemName}".`);

  // Fuzzy match the card
  const cardObj = (user.cards || []).find(c => normalize(c.name) === normalize(cardName));
  if (!cardObj)
    return message.reply(`You don't have "${cardName}".`);

  // STRAWHAT CAN ONLY BE EQUIPPED ON MONEY D LUFFY
  const normItem = normalize(ownedItem);
  const normCard = normalize(cardObj.name);
  if (normItem === 'strawhat' && normCard !== 'moneydluffy') {
    return message.reply('The Strawhat can only be equipped on Money D Luffy!');
  }

  // We'll store equipped items as: user.equipped = { normalizedCardName: normalizedItemName }
  if (!user.equipped) user.equipped = {};

  // If the card already has an item equipped, unequip it first (put back to inventory)
  if (user.equipped[normCard]) {
    user.inventory.push(user.equipped[normCard]);
  }

  user.equipped[normCard] = normItem;

  // Remove the item from inventory (first matching instance, as items are strings)
  const idx = user.inventory.findIndex(i => normalize(i) === normItem);
  if (idx !== -1) user.inventory.splice(idx, 1);

  await user.save();
  return message.reply(`✅ Equipped ${ownedItem} to ${cardObj.name}!`);
}