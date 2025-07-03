const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const { distributeXPToTeam } = require('../utils/levelSystem.js');

function normalize(str) {
    return String(str || '').replace(/\s+/g, '').toLowerCase();
}

const dailyRewards = [
  { beli: 100, xp: 50, item: null },           // Day 1
  { beli: 150, xp: 75, item: null },           // Day 2
  { beli: 200, xp: 100, item: 'Basic Potion' }, // Day 3
  { beli: 250, xp: 125, item: null },          // Day 4
  { beli: 300, xp: 150, item: 'Normal Potion' }, // Day 5
  { beli: 400, xp: 200, item: 'Rusty Cutlass' },          // Day 6
  { beli: 500, xp: 300, item: 'Max Potion' }  // Day 7 (Premium)
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
  
  // Check if user can claim today - prevent infinite claiming
  if (lastClaimed && typeof lastClaimed === 'number') {
    const timeDiff = now - lastClaimed;
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    // Strict 24 hour cooldown - must wait full 24 hours
    if (hoursDiff < 24) { 
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

  // Increment streak and set claim time BEFORE applying rewards
  user.dailyReward.streak = Math.min(user.dailyReward.streak + 1, 7);
  user.dailyReward.lastClaimed = now;

  // Save user data immediately to prevent multiple claims
  await user.save();

  // Get reward for current streak day
  const rewardIndex = (user.dailyReward.streak - 1) % 7;
  const reward = dailyRewards[rewardIndex];

  // Apply rewards
  user.beli = (user.beli || 0) + reward.beli;
  
  // Award XP to user with new leveling system
  const { awardUserXP } = require('../utils/userLevelSystem.js');
  const userLevelResult = awardUserXP(user, reward.xp);

  // Distribute XP to team cards
  const levelUpChanges = distributeXPToTeam(user, reward.xp);

  if (reward.item) {
    if (!user.inventory) user.inventory = [];
    user.inventory.push(normalize(reward.item));
  }

  // Save final rewards
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

  // Add user level up notifications
  if (userLevelResult.leveledUp) {
    const { formatLevelUpRewards } = require('../utils/userLevelSystem.js');
    const levelUpText = `**🌟 LEVEL UP! 🌟**\n${userLevelResult.oldLevel} → **${userLevelResult.newLevel}**\n${formatLevelUpRewards(userLevelResult.rewards)}`;
    embed.addFields({ name: 'Pirate Level Up!', value: levelUpText.trim(), inline: false });
  }

  // Add card level up notifications if any cards leveled up
  if (levelUpChanges && levelUpChanges.length > 0) {
    const levelUpText = levelUpChanges.map(change => 
      `**${change.name}** leveled up! (${change.oldLevel} → ${change.newLevel})`
    ).join('\n');
    embed.addFields({ name: 'Card Level Ups!', value: levelUpText, inline: false });
  }

  await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };
