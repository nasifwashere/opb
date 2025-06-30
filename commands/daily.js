
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

async function execute(message, args) {
  const userId = message.author.id;
  let user = await User.findOne({ userId });

  if (!user) {
    return message.reply('Start your journey with `op start` first!');
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
      const hoursLeft = Math.ceil(24 - hoursDiff);
      const embed = new EmbedBuilder()
        .setTitle('⏰ Daily Reward on Cooldown')
        .setDescription(`You've already claimed your daily reward!\n\nCome back in **${hoursLeft} hours**.`)
        .setColor(0x95a5a6);
      
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
    .setTitle('🎁 Daily Reward Claimed!')
    .setDescription(`**Day ${user.dailyReward.streak}** reward collected!`)
    .addFields(
      { name: '💰 Beli', value: `+${reward.beli}`, inline: true },
      { name: '⭐ XP', value: `+${reward.xp}`, inline: true },
      { name: '🎒 Item', value: reward.item || 'None', inline: true }
    )
    .setColor(user.dailyReward.streak === 7 ? 0xffd700 : 0x2ecc71)
    .setFooter({ 
      text: `Streak: ${user.dailyReward.streak}/7 days • Next reward in 24 hours` 
    });

  if (user.dailyReward.streak === 7) {
    embed.setDescription(`**Day ${user.dailyReward.streak}** reward collected! ✨\n*Maximum streak achieved!*`);
  }

  await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };
