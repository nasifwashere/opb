const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

const data = new SlashCommandBuilder()
  .setName('bounty')
  .setDescription('Get a random bounty target for bonus rewards');

function formatTime(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  
  return parts.join(' ') || '0s';
}

async function execute(message, args) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });

  if (!user) {
    return message.reply('Start your journey with `op start` first!');
  }

  // Ensure username is set if missing
  if (!user.username) {
    user.username = username;
    await user.save();
  }

  const now = Date.now();
  
  // Initialize bounty target if missing
  if (!user.bountyTarget) {
    user.bountyTarget = {
      userId: null,
      username: null,
      targetBounty: 0,
      assignedAt: 0,
      cooldownUntil: 0,
      isActive: false
    };
  }

  // Check if user has an active bounty target
  if (user.bountyTarget.isActive && user.bountyTarget.userId) {
    const targetUser = await User.findOne({ userId: user.bountyTarget.userId });
    
    if (targetUser) {
      const embed = new EmbedBuilder()
        .setTitle('<:zorolaugh:1390838553889476719> Active Bounty Target')
        .setDescription(`Your current bounty target is **${user.bountyTarget.username}**`)
        .addFields(
          { name: 'Target Bounty', value: `${user.bountyTarget.targetBounty.toLocaleString()} Beli`, inline: true },
          { name: 'Potential Reward', value: `${Math.floor(user.bountyTarget.targetBounty * 0.5).toLocaleString()} Beli (5x multiplier)`, inline: true }
        )
        .setColor(0xff6b35)
        .setFooter({ text: 'Defeat this player in a duel to claim the bounty!' });

      // Check if cooldown is active
      if (user.bountyTarget.cooldownUntil > now) {
        const timeLeft = user.bountyTarget.cooldownUntil - now;
        embed.addFields({
          name: 'Cooldown', 
          value: `Next reroll available in ${formatTime(timeLeft)}`, 
          inline: false
        });
      } else {
        embed.addFields({
          name: 'Reroll Available', 
          value: 'You can get a new bounty target!', 
          inline: false
        });
      }

      return message.reply({ embeds: [embed] });
    } else {
      // Target no longer exists, clear bounty
      user.bountyTarget.isActive = false;
      await user.save();
    }
  }

  // Check cooldown
  if (user.bountyTarget.cooldownUntil > now) {
    const timeLeft = user.bountyTarget.cooldownUntil - now;
    return message.reply(`You can get a new bounty target in ${formatTime(timeLeft)}!`);
  }

  // Find a random target (excluding self and users with very low bounty)
  const potentialTargets = await User.find({
    userId: { $ne: userId },
    bounty: { $gt: 1000 }, // Must have at least 1000 bounty
    banned: { $ne: true }
  }).select('userId username bounty');

  if (potentialTargets.length === 0) {
    return message.reply('No suitable bounty targets found. Players need at least 1,000 bounty to be eligible.');
  }

  // Select random target
  const randomTarget = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
  
  // Update user's bounty target
  user.bountyTarget = {
    userId: randomTarget.userId,
    username: randomTarget.username,
    targetBounty: randomTarget.bounty,
    assignedAt: now,
    cooldownUntil: now + (24 * 60 * 60 * 1000), // 24 hours
    isActive: true
  };

  await user.save();

  const embed = new EmbedBuilder()
    .setTitle('<:zorolaugh:1390838553889476719> New Bounty Target Assigned!')
    .setDescription(`Your bounty target is **${randomTarget.username}**`)
    .addFields(
      { name: 'Target Bounty', value: `${randomTarget.bounty.toLocaleString()} Beli`, inline: true },
      { name: 'Potential Reward', value: `${Math.floor(randomTarget.bounty * 0.5).toLocaleString()} Beli (5x multiplier)`, inline: true },
      { name: 'Next Reroll', value: 'Available in 24 hours (or after defeating this target)', inline: false }
    )
    .setColor(0x2ecc71)
    .setFooter({ text: 'Use "op duel @' + randomTarget.username + '" to challenge them!' });

  return message.reply({ embeds: [embed] });
}

module.exports = { data, execute };