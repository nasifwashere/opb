
const { EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

const data = { name: 'balance', description: 'Show your current Beli balance.' };

async function execute(message) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) return message.reply('Register first with `op start`!');

  const embed = new EmbedBuilder()
    .setTitle(`${message.author.username}'s Balance`)
    .setDescription(`💰 **${user.beli || 0}** Beli`)
    .setColor(0xffd700)
    .setThumbnail(message.author.displayAvatarURL())
    .setFooter({ text: 'Use "op shop" to spend your Beli!' });

  await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };
