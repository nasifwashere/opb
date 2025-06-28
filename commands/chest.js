
const { EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

const CHEST_REWARDS = {
  'c': {
    name: 'C Chest',
    color: 0x8B4513,
    emoji: '🟫',
    rewards: {
      guaranteed: [
        { type: 'card', rank: 'C' },
        { type: 'beli', min: 50, max: 100 }
      ],
      chance: [
        { type: 'item', name: 'Rusty Dagger', chance: 0.05 }
      ]
    }
  },
  'b': {
    name: 'B Chest',
    color: 0x0066CC,
    emoji: '🟦',
    rewards: {
      guaranteed: [
        { type: 'card', rank: 'B' },
        { type: 'beli', min: 150, max: 300 }
      ],
      chance: [
        { type: 'item', name: 'Healing Fish', chance: 0.10 },
        { type: 'xp', amount: 100, chance: 0.05 }
      ]
    }
  },
  'a': {
    name: 'A Chest',
    color: 0xFFD700,
    emoji: '🟨',
    rewards: {
      guaranteed: [
        { type: 'card', rank: 'A' },
        { type: 'beli', min: 300, max: 500 }
      ],
      chance: [
        { type: 'item', name: 'Stat Boost Potion', chance: 0.20 },
        { type: 'item', name: 'Level Up Card', chance: 0.10 }
      ]
    }
  },
  's': {
    name: 'S Chest',
    color: 0xFF0000,
    emoji: '🟥',
    rewards: {
      guaranteed: [
        { type: 'card', rank: 'S' },
        { type: 'beli', min: 500, max: 1000 },
        { type: 'item', name: 'Rare Equipment' }
      ],
      chance: [
        { type: 'item', name: 'Upgrade Stone', chance: 0.10 },
        { type: 'card', name: 'Limited Skin', chance: 0.05 }
      ]
    }
  },
  'ur': {
    name: 'UR Chest',
    color: 0x9932CC,
    emoji: '🟪',
    rewards: {
      guaranteed: [
        { type: 'card', rank: 'UR' },
        { type: 'beli', min: 1000, max: 2000 },
        { type: 'item', name: 'Legendary Equipment' }
      ],
      chance: [
        { type: 'card', name: 'Mythic Card', chance: 0.01 },
        { type: 'card', name: 'Time Skip Luffy', chance: 0.10 }
      ]
    }
  }
};

function getRandomCard(rank) {
  // This would need to be integrated with your card system
  const cardsByRank = {
    'C': ['Marine Recruit', 'Village Guard', 'Pirate Grunt'],
    'B': ['Monkey D. Luffy', 'Roronoa Zoro', 'Nami'],
    'A': ['Sanji', 'Usopp', 'Tony Tony Chopper'],
    'S': ['Nico Robin', 'Franky', 'Brook'],
    'UR': ['Portgas D. Ace', 'Sabo', 'Edward Newgate']
  };
  
  const cards = cardsByRank[rank] || cardsByRank['C'];
  return cards[Math.floor(Math.random() * cards.length)];
}

function openChest(chestType) {
  const chest = CHEST_REWARDS[chestType];
  if (!chest) return null;

  const rewards = [];

  // Process guaranteed rewards
  for (const reward of chest.rewards.guaranteed) {
    if (reward.type === 'card') {
      rewards.push({
        type: 'card',
        name: getRandomCard(reward.rank),
        rank: reward.rank
      });
    } else if (reward.type === 'beli') {
      const amount = Math.floor(Math.random() * (reward.max - reward.min + 1)) + reward.min;
      rewards.push({
        type: 'beli',
        amount: amount
      });
    } else {
      rewards.push(reward);
    }
  }

  // Process chance rewards
  for (const reward of chest.rewards.chance) {
    if (Math.random() < reward.chance) {
      rewards.push(reward);
    }
  }

  return { chest, rewards };
}

const data = { name: 'chest', description: 'Open chests to get rewards!' };

async function execute(message, args) {
  const userId = message.author.id;
  let user = await User.findOne({ userId });
  
  if (!user) return message.reply("Start your journey with `op start` first!");

  if (!user.inventory) user.inventory = [];

  // Show available chests if no arguments
  if (args.length === 0) {
    const chests = {
      'cchest': 0,
      'bchest': 0,
      'achest': 0,
      'schest': 0,
      'urchest': 0
    };

    for (const item of user.inventory) {
      if (chests.hasOwnProperty(item)) {
        chests[item]++;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('📦 Your Chests')
      .setDescription('Use `op chest open <type>` to open a chest!')
      .setColor(0x3498db)
      .addFields([
        { name: '🟫 C Chests', value: chests['cchest'].toString(), inline: true },
        { name: '🟦 B Chests', value: chests['bchest'].toString(), inline: true },
        { name: '🟨 A Chests', value: chests['achest'].toString(), inline: true },
        { name: '🟥 S Chests', value: chests['schest'].toString(), inline: true },
        { name: '🟪 UR Chests', value: chests['urchest'].toString(), inline: true },
        { name: '\u200b', value: '\u200b', inline: true }
      ]);

    return message.reply({ embeds: [embed] });
  }

  const subcommand = args[0].toLowerCase();
  if (subcommand !== 'open') {
    return message.reply('Usage: `op chest` to view or `op chest open <type>` to open');
  }

  const chestType = args[1]?.toLowerCase();
  if (!chestType) {
    return message.reply('Specify a chest type: c, b, a, s, or ur');
  }

  const chestItem = `${chestType}chest`;
  const chestIndex = user.inventory.indexOf(chestItem);
  
  if (chestIndex === -1) {
    return message.reply(`You don't have any ${chestType.toUpperCase()} chests!`);
  }

  // Remove chest from inventory
  user.inventory.splice(chestIndex, 1);

  // Open chest
  const result = openChest(chestType);
  if (!result) {
    return message.reply('Invalid chest type!');
  }

  const { chest, rewards } = result;

  // Apply rewards
  let rewardText = '';
  for (const reward of rewards) {
    switch (reward.type) {
      case 'card':
        if (!user.cards) user.cards = [];
        user.cards.push({
          name: reward.name,
          rank: reward.rank,
          level: 1,
          experience: 0,
          timesUpgraded: 0
        });
        rewardText += `🎴 ${reward.name} (${reward.rank})\n`;
        break;
      case 'beli':
        user.beli = (user.beli || 0) + reward.amount;
        rewardText += `💰 ${reward.amount} Beli\n`;
        break;
      case 'xp':
        user.xp = (user.xp || 0) + reward.amount;
        rewardText += `⭐ ${reward.amount} XP\n`;
        break;
      case 'item':
        user.inventory.push(reward.name.toLowerCase().replace(/\s+/g, ''));
        rewardText += `🎒 ${reward.name}\n`;
        break;
    }
  }

  await user.save();

  const embed = new EmbedBuilder()
    .setTitle(`${chest.emoji} ${chest.name} Opened!`)
    .setDescription(`**Rewards received:**\n${rewardText}`)
    .setColor(chest.color);

  return message.reply({ embeds: [embed] });
}

module.exports = { data, execute };
