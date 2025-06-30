
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const User = require('../db/models/User.js');

const data = {
  name: 'battle',
  description: 'Fight boss battles for rewards.'
};

async function execute(message) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });

  if (user && !user.username) {
    user.username = username;
    await user.save();
  }

  const embed = new EmbedBuilder()
    .setTitle('⚔️ Boss Battles Moved!')
    .setDescription(
      `Boss battles are now part of your **adventure** and tied to **story progression**.\n\n` +
      `To fight epic bosses and earn rewards, use:\n\n**/op explore** 🚀`
    )
    .setColor(0xff4d4d)
    .setThumbnail('https://i.imgur.com/oZ5vZgN.png')
    .setFooter({ text: 'Explore to unlock and battle bosses!' });

  return message.reply({ embeds: [embed] });
}

module.exports = { data, execute };
