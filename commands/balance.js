const data = { name: 'balance', description: 'Show your current Beli.' };

const User = require('../db/models/User.js');

async function execute(message) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) return message.reply('Register first with `op start`!');
  message.reply(`💰 You have ${user.beli} Beli.`);
}

module.exports = { data, execute };