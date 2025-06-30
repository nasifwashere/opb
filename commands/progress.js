const { SlashCommandBuilder } = require('discord.js');
const data = new SlashCommandBuilder()
  .setName('progress')
  .setDescription('View your current saga.');

const User = require('../db/models/User.js');

async function execute(message) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });
  
  if (!user) return message.reply('Start your journey with `op start` first!');

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
  
  const { EmbedBuilder } = require('discord.js');
  const embed = new EmbedBuilder()
    .setColor(0x2C2F33)
    .setDescription([
      `**${username}'s Progress**`,
      '',
      `**Current Saga** ${user.saga || 'East Blue'}`,
      `**Current Location** ${currentLocation}`,
      `**Stage** ${stage}`,
      '',
      `Level: ${user.level || 1}`,
      `XP: ${user.xp || 0}`
    ].join('\n'))
    .setFooter({ text: 'Adventure Progress' });

  message.reply({ embeds: [embed] });
}


module.exports = { data, execute };