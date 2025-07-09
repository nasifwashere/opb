const { SlashCommandBuilder, EmbedBuilder  } = require('discord.js');
const User = require('../db/models/User.js'); // Adjust path if needed

const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Show your current Beli balance.');

data.aliases = ['bal'];

async function execute(message, args) {
  const userId = message.author.id;
  const username = message.author.username;

  let user = await User.findOne({ userId });

  if (!user) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription('Start your journey with `op start` first!')
      .setFooter({ text: 'Use op start to begin your adventure' });
    
    return message.reply({ embeds: [embed] });
  }

  // Update username if not set
  if (!user.username) {
    user.username = username;
    await user.save();
  }

  const beli = user.beli || 0;

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('Balance')
    .setDescription(`**${beli.toLocaleString()}** Beli`)
    .setFooter({ text: 'Use op shop to spend your Beli' });

  await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };
