const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');

// Safe save with retry mechanism for version conflicts (same as pull command)
async function saveUserWithRetry(user, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await user.save();
      return true;
    } catch (error) {
      if (error.name === 'VersionError' && attempt < maxRetries) {
        // Refresh the user document and try again
        const freshUser = await User.findById(user._id);
        if (freshUser) {
          // Copy our changes to the fresh document
          freshUser.cards = user.cards;
          freshUser.beli = user.beli;
          freshUser.xp = user.xp;
          freshUser.banned = user.banned;
          freshUser.banReason = user.banReason;
          freshUser.bounty = user.bounty;
          freshUser.gamblingData = user.gamblingData;
          freshUser.inventory = user.inventory;
          freshUser.team = user.team;
          freshUser.case = user.case;
          freshUser.activeQuests = user.activeQuests;
          freshUser.completedQuests = user.completedQuests;
          user = freshUser;
          continue;
        }
      }
      throw error;
    }
  }
  return false;
}

const OWNER_ID = '1257718161298690119';

const data = new SlashCommandBuilder()
  .setName('owner')
  .setDescription('Owner commands (owner only)');

async function execute(message, args, client) {
  if (message.author.id !== OWNER_ID) {
    return message.reply({
      embeds: [new EmbedBuilder()
        .setTitle('🚫 Access Denied')
        .setDescription('This command is reserved for the bot owner only.')
        .setColor(0xe74c3c)
      ]
    });
  }

  // Handle direct commands first
  if (args.length > 0) {
    return await handleOwnerCommand(message, args, client);
  }

  // Show owner menu
  const helpEmbed = new EmbedBuilder()
    .setTitle('🏴‍☠️ Owner Control Panel')
    .setDescription('Select a category to view owner commands')
    .setColor(0xffd700)
    .setFooter({ text: 'Choose a category from the menu below' });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('owner_category')
    .setPlaceholder('Choose a command category')
    .addOptions([
      {
        label: 'User Management',
        description: 'Manage user accounts and progress',
        value: 'users'
      },
      {
        label: 'Bot Statistics',
        description: 'View bot performance and usage stats',
        value: 'stats'
      },
      {
        label: 'Game Management',
        description: 'Spawn cards and manage game events',
        value: 'game'
      },
      {
        label: 'Database Operations',
        description: 'Database management and cleanup',
        value: 'database'
      }
    ]);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  const msg = await message.reply({ embeds: [helpEmbed], components: [row] });

  const filter = i => i.user.id === message.author.id;
  const collector = msg.createMessageComponentCollector({ filter, time: 300000 });

  collector.on('collect', async interaction => {
    await interaction.deferUpdate();

    let categoryEmbed;
    const category = interaction.values[0];

    switch (category) {
      case 'users':
        categoryEmbed = new EmbedBuilder()
          .setTitle('👥 User Management')
          .setDescription('Commands to manage user accounts and progress')
          .addFields(
            { name: 'op owner give @user <amount> beli', value: 'Give Beli to a user', inline: false },
            { name: 'op owner give @user <amount> xp', value: 'Give XP to a user', inline: false },
            { name: 'op owner give @user <card_name> <rank>', value: 'Give a specific card to a user', inline: false },
            { name: 'op owner reset @user', value: 'Reset user progress completely', inline: false },
            { name: 'op owner ban @user [reason]', value: 'Ban user from using the bot', inline: false },
            { name: 'op owner unban @user', value: 'Unban a user', inline: false }
          )
          .setColor(0xffd700)
          .setFooter({ text: 'These commands have permanent effects' });
        break;

      case 'stats':
        categoryEmbed = new EmbedBuilder()
          .setTitle('📊 Bot Statistics')
          .setDescription('View bot performance and usage statistics')
          .addFields(
            { name: 'op owner stats', value: 'Show comprehensive bot statistics', inline: false },
            { name: 'op owner userlist [page]', value: 'List all registered users with pagination', inline: false },
            { name: 'op owner userinfo @user', value: 'Get detailed information about a user', inline: false }
          )
          .setColor(0xffd700)
          .setFooter({ text: 'View bot usage and performance data' });
        break;

      case 'game':
        categoryEmbed = new EmbedBuilder()
          .setTitle('🎮 Game Management')
          .setDescription('Spawn cards and manage game events')
          .addFields(
            { name: 'op owner spawn <card_name> <rank>', value: 'Spawn a card for yourself', inline: false },
            { name: 'op owner item <item_name>', value: 'Give yourself an item from the shop', inline: false },
            { name: 'op owner testpull [amount]', value: 'Test pull mechanics with specified amount', inline: false },
            { name: 'op owner toggle-saga on/off', value: 'Toggle saga requirements for card evolution', inline: false }
          )
          .setColor(0xffd700)
          .setFooter({ text: 'Testing and game management commands' });
        break;

      case 'database':
        categoryEmbed = new EmbedBuilder()
          .setTitle('🗄️ Database Operations')
          .setDescription('Database management and cleanup operations')
          .addFields(
            { name: 'op owner cleanup', value: 'Remove users with no cards or progress', inline: false },
            { name: 'op owner backup', value: 'Create a database backup (if configured)', inline: false },
            { name: 'op owner count', value: 'Show detailed database counts', inline: false }
          )
          .setColor(0xffd700)
          .setFooter({ text: 'Use database commands with caution' });
        break;
    }

    await msg.edit({ embeds: [categoryEmbed], components: [row] });
  });

  collector.on('end', () => {
    msg.edit({ components: [] }).catch(() => {});
  });
}

async function handleOwnerCommand(message, args, client) {
  const command = args[0].toLowerCase();

  try {
    switch (command) {
      case 'give':
        return await handleGiveCommand(message, args);
      
      case 'reset':
        return await handleResetCommand(message, args);
      
      case 'ban':
        return await handleBanCommand(message, args);
      
      case 'unban':
        return await handleUnbanCommand(message, args);
      
      case 'stats':
        return await handleStatsCommand(message, client);
      
      case 'userlist':
        return await handleUserListCommand(message, args);
      
      case 'userinfo':
        return await handleUserInfoCommand(message, args);
      
      case 'spawn':
        return await handleSpawnCommand(message, args);
      
      case 'item':
        return await handleItemCommand(message, args);
      
      case 'testpull':
        return await handleTestPullCommand(message, args);
      
      case 'cleanup':
        return await handleCleanupCommand(message);
      
      case 'backup':
        return await handleBackupCommand(message);
      
      case 'count':
        return await handleCountCommand(message);
      
      case 'toggle-saga':
        return await handleToggleSagaCommand(message, args);
      
      default:
        return message.reply('❌ Unknown owner command. Use `op owner` to see available commands.');
    }
  } catch (error) {
    console.error('Owner command error:', error);
    return message.reply('❌ An error occurred while executing the command.');
  }
}

async function handleGiveCommand(message, args) {
  if (args.length < 3) {
    return message.reply('❌ Usage: `op owner give @user <amount> <beli/xp>` or `op owner give @user <card_name> <rank>`');
  }

  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return message.reply('❌ Please mention a user to give items to.');
  }

  let user = await User.findOne({ userId: targetUser.id });
  if (!user) {
    user = new User({ 
      userId: targetUser.id, 
      username: targetUser.username,
      beli: 0,
      xp: 0,
      level: 1,
      cards: [],
      inventory: [],
      team: [],
      case: [],
      activeQuests: [],
      completedQuests: [],
      equipped: {},
      bounty: 0,
      pullData: {
        dailyPulls: 0,
        lastReset: Date.now()
      },
      gamblingData: {
        lastGamble: 0,
        remainingGambles: 3
      }
    });
    
    // Save the new user first
    try {
      await saveUserWithRetry(user);
      console.log(`[OWNER] Created new user: ${targetUser.username} (${targetUser.id})`);
    } catch (error) {
      console.error(`[OWNER] Error creating user ${targetUser.id}:`, error);
      return message.reply(`❌ Error creating user ${targetUser.username}. Please try again.`);
    }
  }

  // Check if it's beli or xp (numeric amount)
  const amount = parseInt(args[2]);
  if (!isNaN(amount) && args[3]) {
    const type = args[3].toLowerCase();
    
    if (type === 'beli') {
      user.beli = (user.beli || 0) + amount;
      await user.save();
      return message.reply(`✅ Gave ${amount} Beli to ${targetUser.username}`);
      
    } else if (type === 'xp') {
      const { awardUserXP, formatLevelUpRewards } = require('../utils/userLevelSystem.js');
      const userLevelResult = awardUserXP(user, amount);
      await user.save();
      
      let response = `✅ Gave ${amount} XP to ${targetUser.username}`;
      if (userLevelResult.leveledUp) {
        response += `\n🌟 **Level Up!** ${userLevelResult.oldLevel} → ${userLevelResult.newLevel}\n${formatLevelUpRewards(userLevelResult.rewards)}`;
      }
      
      return message.reply(response);
    }
  }
  
  // Otherwise treat as card name and rank
  const cardName = args.slice(2, -1).join(' ');
  const rank = args[args.length - 1].toUpperCase();

  // Validate card exists in cards.json
  const cardsPath = require('path').resolve('data', 'cards.json');
  const allCards = JSON.parse(require('fs').readFileSync(cardsPath, 'utf8'));
  const cardDef = allCards.find(c => c && c.name && c.rank && normalize(c.name) === normalize(cardName) && c.rank.toUpperCase() === rank);

  if (cardDef && ['C', 'B', 'A', 'S', 'UR'].includes(rank)) {
    if (!user.cards) user.cards = [];
    user.cards.push({
      name: cardDef.name,
      rank: cardDef.rank,
      level: 1,
      experience: 0,
      timesUpgraded: 0,
      locked: false
    });
    user.markModified('cards');
    try {
      await saveUserWithRetry(user);
      try {
        const { updateQuestProgress } = require('../utils/questSystem.js');
        await updateQuestProgress(user, 'pull', 1);
        await saveUserWithRetry(user);
      } catch (questError) {
        console.log(`[OWNER] Quest progress update failed for ${targetUser.id}:`, questError);
      }
      console.log(`[OWNER] Successfully gave ${cardDef.name} (${cardDef.rank}) to ${targetUser.username} (${targetUser.id})`);
      return message.reply(`✅ Gave ${cardDef.name} (${cardDef.rank}) to ${targetUser.username}`);
    } catch (error) {
      console.error(`[OWNER] Error saving card for user ${targetUser.id}:`, error);
      return message.reply(`❌ Error giving card to ${targetUser.username}. Please try again.`);
    }
  }

  return message.reply('❌ Invalid command format or card does not exist. Use: `op owner give @user <amount> <beli/xp>` or `op owner give @user <card_name> <rank>`');
}

async function handleResetCommand(message, args) {
  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return message.reply('❌ Please mention a user to reset.');
  }

  await User.deleteOne({ userId: targetUser.id });
  return message.reply(`✅ Reset all progress for ${targetUser.username}`);
}

async function handleBanCommand(message, args) {
  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return message.reply('❌ Please mention a user to ban.');
  }

  const reason = args.slice(2).join(' ') || 'No reason provided';
  
  let user = await User.findOne({ userId: targetUser.id });
  if (!user) {
    user = new User({ userId: targetUser.id, username: targetUser.username });
  }

  user.banned = true;
  user.banReason = reason;
  await user.save();

  return message.reply(`✅ Banned ${targetUser.username}. Reason: ${reason}`);
}

async function handleUnbanCommand(message, args) {
  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return message.reply('❌ Please mention a user to unban.');
  }

  const user = await User.findOne({ userId: targetUser.id });
  if (!user) {
    return message.reply('❌ User not found in database.');
  }

  user.banned = false;
  user.banReason = undefined;
  await user.save();

  return message.reply(`✅ Unbanned ${targetUser.username}`);
}

async function handleStatsCommand(message, client) {
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ 
    lastActive: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
  });
  
  const totalCardsResult = await User.aggregate([
    { $unwind: '$cards' },
    { $count: 'total' }
  ]);
  const totalCards = totalCardsResult.length > 0 ? totalCardsResult[0].total : 0;

  const bannedUsers = await User.countDocuments({ banned: true });

  const embed = new EmbedBuilder()
    .setTitle('📊 Bot Statistics')
    .setColor(0x3498db)
    .addFields(
      { name: 'Total Users', value: totalUsers.toString(), inline: true },
      { name: 'Active Users (7 days)', value: activeUsers.toString(), inline: true },
      { name: 'Banned Users', value: bannedUsers.toString(), inline: true },
      { name: 'Total Cards Owned', value: totalCards.toString(), inline: true },
      { name: 'Bot Uptime', value: formatUptime(process.uptime()), inline: true },
      { name: 'Memory Usage', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`, inline: true },
      { name: 'Guilds', value: client.guilds.cache.size.toString(), inline: true },
      { name: 'Node.js Version', value: process.version, inline: true }
    );

  return message.reply({ embeds: [embed] });
}

async function handleUserListCommand(message, args) {
  const page = parseInt(args[1]) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;

  const users = await User.find({})
    .select('userId username beli xp level cards banned')
    .sort({ xp: -1 })
    .skip(skip)
    .limit(limit);

  const totalUsers = await User.countDocuments();
  const totalPages = Math.ceil(totalUsers / limit);

  let userList = '';
  users.forEach((user, index) => {
    const cardCount = user.cards ? user.cards.length : 0;
    const status = user.banned ? '🚫' : '✅';
    userList += `${status} **${user.username}** (ID: ${user.userId})\n`;
    userList += `   Level ${user.level || 1} • ${user.beli || 0} Beli • ${cardCount} cards\n\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`👥 User List - Page ${page}/${totalPages}`)
    .setDescription(userList || 'No users found')
    .setColor(0x3498db)
    .setFooter({ text: `Total users: ${totalUsers}` });

  return message.reply({ embeds: [embed] });
}

async function handleUserInfoCommand(message, args) {
  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return message.reply('❌ Please mention a user to get info about.');
  }

  const user = await User.findOne({ userId: targetUser.id });
  if (!user) {
    return message.reply('❌ User not found in database.');
  }

  const cardCount = user.cards ? user.cards.length : 0;
  const inventoryCount = user.inventory ? user.inventory.length : 0;
  const teamCount = user.team ? user.team.length : 0;

  const embed = new EmbedBuilder()
    .setTitle(`👤 User Info: ${user.username}`)
    .setColor(user.banned ? 0xe74c3c : 0x2ecc71)
    .addFields(
      { name: 'User ID', value: user.userId, inline: true },
      { name: 'Level', value: (user.level || 1).toString(), inline: true },
      { name: 'XP', value: (user.xp || 0).toString(), inline: true },
      { name: 'Beli', value: (user.beli || 0).toString(), inline: true },
      { name: 'Cards', value: cardCount.toString(), inline: true },
      { name: 'Team Size', value: teamCount.toString(), inline: true },
      { name: 'Inventory Items', value: inventoryCount.toString(), inline: true },
      { name: 'Status', value: user.banned ? `🚫 Banned: ${user.banReason}` : '✅ Active', inline: false }
    );

  return message.reply({ embeds: [embed] });
}

async function handleSpawnCommand(message, args) {
  if (args.length < 3) {
    return message.reply('❌ Usage: `op owner spawn <card_name> <rank>`');
  }

  const cardName = args[1];
  const rank = args[2].toUpperCase();

  // Validate card exists in cards.json
  const cardsPath = require('path').resolve('data', 'cards.json');
  const allCards = JSON.parse(require('fs').readFileSync(cardsPath, 'utf8'));
  const cardDef = allCards.find(c => c && c.name && c.rank && normalize(c.name) === normalize(cardName) && c.rank.toUpperCase() === rank);

  if (!cardDef) {
    return message.reply('❌ Card not found in database. Please check the card name and rank.');
  }

  let user = await User.findOne({ userId: message.author.id });
  if (!user) {
    return message.reply('❌ You need to be registered first.');
  }

  if (!user.cards) user.cards = [];
  user.cards.push({
    name: cardDef.name,
    rank: cardDef.rank,
    level: 1,
    experience: 0,
    timesUpgraded: 0,
    locked: false
  });

  await user.save();
  return message.reply(`✅ Spawned ${cardDef.name} (${cardDef.rank}) for yourself`);
}

async function handleItemCommand(message, args) {
  if (args.length < 2) {
    return message.reply('❌ Usage: `op owner item <item_name>`');
  }

  const itemName = args.slice(1).join(' ');
  
  let user = await User.findOne({ userId: message.author.id });
  if (!user) {
    return message.reply('❌ You need to be registered first.');
  }

  if (!user.inventory) user.inventory = [];
  user.inventory.push(itemName.toLowerCase().replace(/\s+/g, ''));

  await user.save();
  return message.reply(`✅ Added ${itemName} to your inventory`);
}

async function handleTestPullCommand(message, args) {
  const amount = parseInt(args[1]) || 1;
  
  if (amount > 10) {
    return message.reply('❌ Maximum 10 test pulls at once.');
  }

  return message.reply(`✅ Test pull command would simulate ${amount} pull(s). Implementation depends on your pull system.`);
}

async function handleCleanupCommand(message) {
  const result = await User.deleteMany({
    $and: [
      { $or: [{ cards: { $size: 0 } }, { cards: { $exists: false } }] },
      { $or: [{ beli: { $lte: 0 } }, { beli: { $exists: false } }] },
      { $or: [{ xp: { $lte: 0 } }, { xp: { $exists: false } }] }
    ]
  });

  return message.reply(`✅ Cleaned up ${result.deletedCount} inactive users`);
}

async function handleBackupCommand(message) {
  return message.reply('ℹ️ Backup functionality not implemented. Configure backup system as needed.');
}

async function handleCountCommand(message) {
  const totalUsers = await User.countDocuments();
  const totalCards = await User.countDocuments({ cards: { $exists: true, $ne: [] } });
  const bannedUsers = await User.countDocuments({ banned: true });
  
  const embed = new EmbedBuilder()
    .setTitle('📊 Database Counts')
    .setColor(0x3498db)
    .addFields(
      { name: 'Total Users', value: totalUsers.toString(), inline: true },
      { name: 'Users with Cards', value: totalCards.toString(), inline: true },
      { name: 'Banned Users', value: bannedUsers.toString(), inline: true }
    );

  return message.reply({ embeds: [embed] });
}

async function handleToggleSagaCommand(message, args) {
  if (args.length < 2) {
    const config = require('../config.json');
    const currentStatus = config.sagaRequirementsEnabled ? 'ON' : 'OFF';
    return message.reply(`❓ Current saga requirements status: **${currentStatus}**\n\nUsage: \`op owner toggle-saga on/off\`\n\n**ON**: Players must reach certain sagas to evolve cards\n**OFF**: All cards can evolve immediately regardless of saga`);
  }

  const toggle = args[1].toLowerCase();
  if (toggle !== 'on' && toggle !== 'off') {
    return message.reply('❌ Invalid option. Use `on` or `off`.');
  }

  const newValue = toggle === 'on';
  
  // Update config.json file
  const configPath = path.resolve('config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.sagaRequirementsEnabled = newValue;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const status = newValue ? 'ON' : 'OFF';
  const emoji = newValue ? '🔒' : '🔓';
  const description = newValue 
    ? 'Players now **must reach certain sagas** to evolve cards' 
    : 'Players can now **evolve cards immediately** regardless of saga';

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} Saga Requirements ${status}`)
    .setDescription(description)
    .setColor(newValue ? 0xe74c3c : 0x2ecc71)
    .setFooter({ text: `Changed by ${message.author.username}` });

  return message.reply({ embeds: [embed] });
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(' ') || '< 1m';
}

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

module.exports = { data, execute };
