const data = { name: 'progress', description: 'View your current saga.' };

const User = require('../db/models/User.js');

async function execute(message) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });
  
  if (!user) return message.reply('Do `op start` first!');

  // Ensure username is set if missing
  if (!user.username) {
    user.username = username;
    await user.save();
  }
  
  message.reply(`Your current saga: **${user.saga}**`);
}


module.exports = { data, execute };