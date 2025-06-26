const User = require('../db/models/User.js');

// Util: Normalize for fuzzy matching
function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

const data = { name: 'unequip', description: 'Unequip an item from a card.' };

// Usage: op unequip luffy
async function execute(message, args, client) {
  const userId = message.author.id;
  const cardName = args.join(' ');
  if (!cardName) return message.reply('Usage: op unequip [card]');
  const user = await User.findOne({ userId });
  if (!user) return message.reply('Start your journey with `op start`!');
  if (!user.equipped) return message.reply(`You don't have any equipped items!`);

  const normCard = normalize(cardName);

  if (!user.cards || !user.cards.find(c => normalize(c.name) === normCard))
    return message.reply(`You don't have "${cardName}".`);

  if (!user.equipped[normCard])
    return message.reply(`No item equipped to ${cardName}.`);

  const unequippedItem = user.equipped[normCard];
  delete user.equipped[normCard];

  // Place the unequipped item back into inventory
  if (!user.inventory) user.inventory = [];
  user.inventory.push(unequippedItem);

  await user.save();
  return message.reply(`✅ Unequipped ${unequippedItem} from ${cardName}!`);
}


module.exports = { data, execute };