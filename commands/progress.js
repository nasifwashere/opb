const data = { name: 'progress', description: 'View your current saga.' };

const User = require('../db/models/User.js');

async function execute(message) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) return message.reply('Do `op start` first!');
  message.reply(`Your current saga: **${user.saga}**`);
}


module.exports = { data, execute };