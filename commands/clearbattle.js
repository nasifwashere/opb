const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

const data = new SlashCommandBuilder()
  .setName('clearbattle')
  .setDescription('Clear your battle state if you\'re stuck in battle');

async function execute(message, args) {
  const userId = message.author.id;
  let user = await User.findOne({ userId });

  if (!user) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription('Start your journey with `op start` first!')
      .setFooter({ text: 'Use op start to begin your adventure' });
    
    return message.reply({ embeds: [embed] });
  }

  if (!user.battleState || !user.battleState.inBattle) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription('You are not currently in a battle.')
      .setFooter({ text: 'No battle to clear' });
    
    return message.reply({ embeds: [embed] });
  }

  // Clear battle state
  user.battleState = { inBattle: false };
  await user.save();

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setDescription('Battle state cleared! You can now start new battles.')
    .setFooter({ text: 'Battle state reset' });

  return message.reply({ embeds: [embed] });
}

module.exports = { data, execute };
