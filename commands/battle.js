const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

const data = new SlashCommandBuilder()
  .setName('battle')
  .setDescription('Fight boss battles for rewards.');

async function execute(message) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });

  if (user && !user.username) {
    user.username = username;
    await user.save();
  }

  const embed = new EmbedBuilder()
    .setTitle('Boss Battles Moved')
    .setDescription('Boss battles are now part of your adventure and tied to story progression.\n\nUse **op explore** to fight epic bosses and earn rewards.')
    .setColor(0x2b2d31)
    .setFooter({ text: 'Explore to unlock and battle bosses' });

  return message.reply({ embeds: [embed] });
}

module.exports = { data, execute };
