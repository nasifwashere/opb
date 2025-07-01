
const { SlashCommandBuilder } = require('discord.js');
const User = require('../db/models/User.js');

const data = new SlashCommandBuilder()
  .setName('clearbattle')
  .setDescription('Clear your battle state if you\'re stuck in battle');

async function execute(message, args) {
  const userId = message.author.id;
  let user = await User.findOne({ userId });

  if (!user) {
    return message.reply('Start your journey with `op start` first!');
  }

  if (!user.battleState || !user.battleState.inBattle) {
    return message.reply('✅ You are not currently in a battle.');
  }

  // Clear battle state
  user.battleState = { inBattle: false };
  await user.save();

  return message.reply('✅ Battle state cleared! You can now start new battles.');
}

module.exports = { data, execute };
