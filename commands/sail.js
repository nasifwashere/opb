const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const { getRandomInt } = require('../utils/uiHelpers.js');
const { saveUserWithRetry } = require('../utils/saveWithRetry.js');
const itemsData = require('../data/shop.json');

const SAIL_UNLOCK_SAGA = 'East Blue';
const SAIL_SAGA_LIST = ['East Blue']; // Expandable for future sagas

// Reward scaling table for East Blue
const SAIL_REWARDS = [
  { min: 1, max: 5,   beli: [5, 10], xp: [1, 5], items: [], enemies: [{ hp: 30, count: 1, type: 'Navy Soldier' }] },
  { min: 6, max: 10,  beli: [10, 50], xp: [5, 10], items: [], enemies: [{ hp: 50, count: 1, type: 'Stronger Navy' }] },
  { min: 11, max: 20, beli: [50, 100], xp: [10, 15], items: ['Common'], enemies: [{ hp: 100, count: getRandomInt(1, 3), type: 'Navy Soldier' }] },
  { min: 21, max: 50, beli: [100, 250], xp: [10, 20], items: ['Uncommon'], enemies: [{ hp: getRandomInt(100, 300), count: getRandomInt(1, 3), type: 'Navy' }] },
  { min: 51, max: 9999, beli: [250, 500], xp: [15, 30], items: ['Rare', 'Epic', 'Legendary'], enemies: [{ hp: getRandomInt(200, 500), count: getRandomInt(2, 4), type: 'Elite Navy' }] }
];

function getSailReward(sailsCompleted) {
  for (const row of SAIL_REWARDS) {
    if (sailsCompleted >= row.min && sailsCompleted <= row.max) return row;
  }
  return SAIL_REWARDS[SAIL_REWARDS.length - 1];
}

const data = new SlashCommandBuilder()
  .setName('sail')
  .setDescription('Infinite grind mode: Sail an arc for endless rewards!')
  .addStringOption(option =>
    option.setName('arc')
      .setDescription('Arc/Saga to sail (e.g., east blue)')
      .setRequired(true)
  );

console.log('[SAIL] sail.js loaded');

async function execute(message, args, client) {
  console.log('[SAIL] execute called', { args, user: message.author?.id || message.user?.id });
  const userId = message.author.id;
  let user = await User.findOne({ userId });
  if (!user) return message.reply('Start your journey with `op start` first!');

  // Parse arc name (fuzzy)
  const arcInput = args.join(' ').trim().toLowerCase();
  const arc = SAIL_SAGA_LIST.find(s => s.toLowerCase().includes(arcInput));
  if (!arc) return message.reply('Unknown arc. Try: `op sail east blue`');

  // Unlock check: allow if saga completed OR user has reached/passed global stage 42 (end of East Blue)
  if (!user.completedSagas || !user.completedSagas.includes(SAIL_UNLOCK_SAGA)) {
    if (typeof user.stage !== 'number' || user.stage < 42) {
      return message.reply('You must complete the full saga (e.g., defeat Arlong in East Blue) to unlock infinite sail mode!');
    } else {
      // Auto-fix: add saga to completedSagas for legacy users
      if (!user.completedSagas) user.completedSagas = [];
      user.completedSagas.push(SAIL_UNLOCK_SAGA);
      await saveUserWithRetry(user);
    }
  }

  // Progress tracking
  if (!user.sailsCompleted) user.sailsCompleted = {};
  if (!user.sailsCompleted[arc]) user.sailsCompleted[arc] = 0;
  user.sailsCompleted[arc]++;
  const sailsDone = user.sailsCompleted[arc];

  // Get reward scaling
  const reward = getSailReward(sailsDone);
  const earnedBeli = getRandomInt(reward.beli[0], reward.beli[1]);
  const earnedXP = getRandomInt(reward.xp[0], reward.xp[1]);
  let earnedItems = [];
  if (reward.items.length > 0) {
    // Pick a random item of the allowed rarities
    const possibleItems = itemsData.filter(i => reward.items.includes(i.rarity));
    if (possibleItems.length > 0) {
      const item = possibleItems[getRandomInt(0, possibleItems.length - 1)];
      earnedItems.push(item.name);
    }
  }

  // Simulate enemies
  const enemy = reward.enemies[0];
  const enemyDesc = `${enemy.count}x ${enemy.type} (${enemy.hp} HP)`;

  // Award rewards
  user.beli = (user.beli || 0) + earnedBeli;
  user.xp = (user.xp || 0) + earnedXP;
  if (!user.inventory) user.inventory = [];
  for (const item of earnedItems) user.inventory.push(item);
  await saveUserWithRetry(user);

  // TODO: Award XP to team cards, allow healing item use, and use real combat logic

  const embed = new EmbedBuilder()
    .setTitle(`🌊 Sailing: ${arc}`)
    .setDescription(`You encountered ${enemyDesc} and won!`)
    .addFields(
      { name: 'Sails Completed', value: sailsDone.toString(), inline: true },
      { name: 'Beli Earned', value: `${earnedBeli}`, inline: true },
      { name: 'XP Earned', value: `${earnedXP}`, inline: true },
      { name: 'Items', value: earnedItems.length ? earnedItems.join(', ') : 'None', inline: true }
    )
    .setColor(0x3498db)
    .setFooter({ text: 'No cooldowns! Use healing items and grind as much as you want.' });

  return message.reply({ embeds: [embed] });
}

module.exports = { data, execute };
