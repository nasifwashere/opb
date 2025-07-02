const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

const dailyRewards = [
  { beli: 100, xp: 50, item: null },           // Day 1
  { beli: 150, xp: 75, item: null },           // Day 2
  { beli: 200, xp: 100, item: 'Health Potion' }, // Day 3
  { beli: 250, xp: 125, item: null },          // Day 4
  { beli: 300, xp: 150, item: 'Strength Potion' }, // Day 5
  { beli: 400, xp: 200, item: null },          // Day 6
  { beli: 500, xp: 300, item: 'Rare Card Pack' }  // Day 7 (Premium)
];

const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily reward!');

// Add proper time formatting function
function prettyTime(ms) {
    if (ms <= 0) return "Ready";

    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);

    seconds = seconds % 60;
    minutes = minutes % 60;
    hours = hours % 24;

    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (parts.length === 0 && seconds > 0) parts.push(`${seconds}s`);
    if (parts.length === 0) return "Ready";

    return parts.join(" ");
}

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

  // Initialize daily reward data if needed
  if (!user.dailyReward) {
    user.dailyReward = {
      lastClaimed: null,
      streak: 0
    };
  }

  const now = Date.now();
  const lastClaimed = user.dailyReward.lastClaimed;
  
  // Check if user can claim today
  if (lastClaimed) {
    const timeDiff = now - lastClaimed;
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    if (hoursDiff < 24) { // Must wait 24 hours between claims
      const nextClaim = lastClaimed + (24 * 60 * 60 * 1000);
      const timeLeft = nextClaim - now;
      
      const embed = new EmbedBuilder()
        .setTitle('Daily Reward on Cooldown')
        .setDescription(`You've already claimed your daily reward!\n\nNext reward available in **${prettyTime(timeLeft)}**`)
        .setColor(0x2b2d31)
        .setFooter({ text: 'Daily rewards reset every 24 hours' });
      
      return message.reply({ embeds: [embed] });
    }
    
    // Check if streak should continue (claimed within 48 hours)
    if (hoursDiff > 48) {
      user.dailyReward.streak = 0; // Reset streak
    }
  }

  // Increment streak
  user.dailyReward.streak = Math.min(user.dailyReward.streak + 1, 7);
  user.dailyReward.lastClaimed = now;

  // Get reward for current streak day
  const rewardIndex = (user.dailyReward.streak - 1) % 7;
  const reward = dailyRewards[rewardIndex];

  // Apply rewards
  user.beli = (user.beli || 0) + reward.beli;
  user.xp = (user.xp || 0) + reward.xp;

  if (reward.item) {
    if (!user.inventory) user.inventory = [];
    user.inventory.push(reward.item);
  }

  await user.save();

  const embed = new EmbedBuilder()
    .setTitle('Daily Reward Claimed')
    .setDescription(`**Day ${user.dailyReward.streak}** reward collected!${user.dailyReward.streak === 7 ? '\n*Maximum streak achieved!*' : ''}`)
    .addFields(
      { name: 'Beli', value: `+${reward.beli}`, inline: true },
      { name: 'XP', value: `+${reward.xp}`, inline: true },
      { name: 'Item', value: reward.item || 'None', inline: true }
    )
    .setColor(0x2b2d31)
    .setFooter({ 
      text: `Streak: ${user.dailyReward.streak}/7 days • Next reward in 24 hours` 
    });

  await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };
