const { SlashCommandBuilder, EmbedBuilder  } = require('discord.js');
const User = require('../db/models/User.js'); // Adjust path if needed

const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Show your current Beli balance.');

async function execute(message, args) {
  const userId = message.author.id;
  const username = message.author.username;

  let user = await User.findOne({ userId });

  if (!user) {
    return message.reply('You need to start your adventure first! Use `op start` to begin.');
  }

  // Update username if not set
  if (!user.username) {
    user.username = username;
    await user.save();
  }

  const beli = user.beli || 0;

  const embed = new EmbedBuilder()
    .setColor(0x2C2F33)
    .setDescription([
      `**${username}'s Balance**`,
      '',
      `**${beli.toLocaleString()}** Beli`,
      '',
      'Use `op shop` to spend your Beli'
    ].join('\n'))
    .setFooter({ text: 'Economy System' });

  await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };
