const User = require('../db/models/User.js');

const data = { name: 'inventory', description: 'View your inventory items.' };

async function execute(message, args, client) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });

  if (!user) return message.reply('Start your journey with `op start`!');

  const inventory = Array.isArray(user.inventory) ? user.inventory : [];

  if (!inventory.length) {
    return message.reply('Your inventory is empty! Collect items on your adventure.');
  }

  let reply = `📦 **${message.author.username}'s Inventory**\n`;
  for (const name of inventory) {
    reply += `‣ ${name}\n`;
  }
  message.reply(reply);
}


module.exports = { data, execute };