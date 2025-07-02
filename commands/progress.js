const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

const data = new SlashCommandBuilder()
  .setName('progress')
  .setDescription('View your current saga.');

async function execute(message) {
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

  // Ensure username is set if missing
  if (!user.username) {
    user.username = username;
    await user.save();
  }

  // Get current location for explore
  function getCurrentLocation(stage) {
    if (stage < 7) return 'Windmill Village';
    if (stage < 16) return 'Shells Town';
    if (stage < 24) return 'Orange Town';
    if (stage < 29) return 'Syrup Village';
    if (stage < 34) return 'Baratie';
    if (stage < 43) return 'Arlong Park';
    return 'East Blue Complete';
  }

  const currentLocation = getCurrentLocation(user.stage || 0);
  const stage = user.stage || 0;
  
  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('Adventure Progress')
    .addFields(
      { name: 'Current Saga', value: user.saga || 'East Blue', inline: true },
      { name: 'Location', value: currentLocation, inline: true },
      { name: 'Stage', value: `${stage}`, inline: true },
      { name: 'Level', value: `${user.level || 1} (${user.xp || 0} XP)`, inline: false }
    )
    .setFooter({ text: 'Use op explore to continue your journey' });

  message.reply({ embeds: [embed] });
}

module.exports = { data, execute };