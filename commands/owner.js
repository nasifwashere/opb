const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle  } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');

const OWNER_ID = '1257718161298690119';

const ownerCommands = {
  ' User Management': {
    commands: [
      { name: 'owner give @user <amount> beli', desc: 'Give Beli to a user' },
      { name: 'owner give @user <amount> xp', desc: 'Give XP to a user' },
      { name: 'owner give @user card <card_name>', desc: 'Give a card to a user' },
      { name: 'owner set @user level <card> <level>', desc: 'Set card level for user' },
      { name: 'owner reset @user', desc: 'Reset user progress completely' },
      { name: 'owner ban @user', desc: 'Ban user from using the bot' },
      { name: 'owner unban @user', desc: 'Unban user' }
    ]
  },
  ' Bot Management': {
    commands: [
      { name: 'owner reload', desc: 'Reload all bot commands' },
      { name: 'owner shutdown', desc: 'Safely shutdown the bot' },
      { name: 'owner announce <message>', desc: 'Send announcement to all guilds' },
      { name: 'owner stats', desc: 'Show bot statistics' },
      { name: 'owner maintenance on/off', desc: 'Toggle maintenance mode' }
    ]
  },
  ' Game Management': {
    commands: [
      { name: 'owner spawn <card> <rank>', desc: 'Spawn card in current channel' },
      { name: 'owner event start <type>', desc: 'Start special event' },
      { name: 'owner event stop', desc: 'Stop current event' },
      { name: 'owner rates <pull_rate> <rank>', desc: 'Modify pull rates' },
      { name: 'owner quest reset all', desc: 'Reset all user quests' }
    ]
  },
  ' Database': {
    commands: [
      { name: 'owner backup', desc: 'Create database backup' },
      { name: 'owner purge inactive <days>', desc: 'Remove inactive users' },
      { name: 'owner fix duplicates', desc: 'Fix duplicate user entries' },
      { name: 'owner query <mongodb_query>', desc: 'Execute raw MongoDB query' }
    ]
  }
};

const data = new SlashCommandBuilder()
  .setName('owner')
  .setDescription('Owner commands (owner only).');

function createOwnerMainEmbed() {
  const embed = new EmbedBuilder()
    .setTitle(' Owner Commands - Control Panel')
    .setDescription('**Welcome, Owner!** 🏴‍☠️\n\nYou have complete control over the One Piece bot. Use these commands wisely!')
    .setColor(0xffd700)
    .setThumbnail('https://i.imgur.com/X8HDGNQ.png');

  const categories = Object.keys(ownerCommands);
  let categoryList = '';
  categories.forEach(category => {
    const commandCount = ownerCommands[category].commands.length;
    categoryList += `${category} (${commandCount} commands)\n`;
  });

  embed.addFields({ 
    name: ' Command Categories', 
    value: categoryList || 'No categories available', 
    inline: false 
  });

  embed.addFields({ 
    name: ' Important Notes', 
    value: '• These commands have **permanent effects**\n• Always double-check before executing\n• Use responsibly to maintain game balance\n• Some commands cannot be undone', 
    inline: false 
  });

  embed.setFooter({ text: 'Click a category below to view commands' });
  return embed;
}

function createOwnerCategoryEmbed(category, categoryData) {
  const embed = new EmbedBuilder()
    .setTitle(` ${category}`)
    .setDescription(`Commands for ${category.toLowerCase()}`)
    .setColor(0xffd700);

  let commandText = '';
  categoryData.commands.forEach(cmd => {
    commandText += `**op ${cmd.name}**\n${cmd.desc}\n\n`;
  });

  embed.addFields({ 
    name: 'Available Commands', 
    value: commandText || 'No commands in this category', 
    inline: false 
  });

  return embed;
}

function createOwnerNavigationButtons() {
  const categories = Object.keys(ownerCommands);
  const buttons = [];
  
  for (let i = 0; i < Math.min(categories.length, 5); i++) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`owner_${i}`)
        .setLabel(categories[i].replace(/^[^\w\s]+/, '').trim()) // Remove emoji for label
        .setStyle(ButtonStyle.Secondary)
    );
  }

  const rows = [new ActionRowBuilder().addComponents(buttons)];

  if (categories.length > 5) {
    const secondRowButtons = [];
    for (let i = 5; i < categories.length; i++) {
      secondRowButtons.push(
        new ButtonBuilder()
          .setCustomId(`owner_${i}`)
          .setLabel(categories[i].replace(/^[^\w\s]+/, '').trim())
          .setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(new ActionRowBuilder().addComponents(secondRowButtons));
  }

  return rows;
}

function createOwnerBackButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('owner_back')
      .setLabel('← Back to Categories')
      .setStyle(ButtonStyle.Primary)
  );
}

async function execute(message, args, client) {
  if (message.author.id !== OWNER_ID) {
    return message.reply({
      embeds: [new EmbedBuilder()
        .setTitle(' Access Denied')
        .setDescription('This command is reserved for the bot owner only.')
        .setColor(0xe74c3c)
      ]
    });
  }

  const categories = Object.keys(ownerCommands);

  // Show embed on "op owner" command with no args
  if (args.length === 0) {
    const mainEmbed = createOwnerMainEmbed();
    const navigationButtons = createOwnerNavigationButtons();

    const helpMessage = await message.reply({ 
      embeds: [mainEmbed], 
      components: navigationButtons 
    });

    const filter = interaction => interaction.user.id === message.author.id;
    const collector = helpMessage.createMessageComponentCollector({ filter, time: 300000 });

    collector.on('collect', async interaction => {
      try {
        if (interaction.customId === 'owner_back') {
          const mainEmbed = createOwnerMainEmbed();
          const navigationButtons = createOwnerNavigationButtons();
          await interaction.update({ embeds: [mainEmbed], components: navigationButtons });
        } else if (interaction.customId.startsWith('owner_')) {
          const categoryIndex = parseInt(interaction.customId.split('_')[1]);
          const categoryName = categories[categoryIndex];
          const categoryData = ownerCommands[categoryName];

          if (categoryData) {
            const embed = createOwnerCategoryEmbed(categoryName, categoryData);
            await interaction.update({ embeds: [embed], components: [createOwnerBackButton()] });
          }
        }
      } catch (error) {
        console.error('Owner command interaction error:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
        }
      }
    });

    collector.on('end', () => {
      try {
        const disabledButtons = createOwnerNavigationButtons();
        disabledButtons.forEach(row => {
          row.components.forEach(button => button.setDisabled(true));
        });
        helpMessage.edit({ components: disabledButtons }).catch(() => {});
      } catch (error) {
        console.error('Owner collector end error:', error);
      }
    });

    return; // Prevent further execution on op cheats
  }

  // Handle owner subcommands starting with 'owner <cmd>'
  if (args.length > 0) {
    const command = args[0].toLowerCase();

    if (command === 'give' && args.length >= 4) {
      const targetUser = message.mentions.users.first();
      if (!targetUser) return message.reply('Please mention a user to give items to.');

      const amount = parseInt(args[2]);
      const type = args[3].toLowerCase();

      try {
        let user = await User.findOne({ userId: targetUser.id });
        if (!user) user = new User({ userId: targetUser.id, username: targetUser.username });

        if (type === 'beli' && !isNaN(amount)) {
          user.beli = (user.beli || 0) + amount;
          await user.save();
          return message.reply(`<:sucess:1375872950321811547> Gave ${amount} Beli to ${targetUser.username}`);
        } else if (type === 'xp' && !isNaN(amount)) {
          user.xp = (user.xp || 0) + amount;
          await user.save();
          return message.reply(`<:sucess:1375872950321811547> Gave ${amount} XP to ${targetUser.username}`);
        } else if (type === 'card' && args[4]) {
          const cardName = args.slice(4).join(' ');
          if (!user.cards) user.cards = [];

          const cardsPath = path.resolve('data', 'cards.json');
          const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
          const cardExists = allCards.find(c => c.name.toLowerCase() === cardName.toLowerCase());

          if (cardExists) {
            user.cards.push({
              name: cardExists.name,
              rank: cardExists.rank,
              timesUpgraded: 0,
              level: 1
            });
            await user.save();
            return message.reply(`<:sucess:1375872950321811547> Gave ${cardExists.name} (${cardExists.rank}) to ${targetUser.username}`);
          } else {
            return message.reply('<:arrow:1375872983029256303> Card not found in database.');
          }
        }
      } catch (error) {
        console.error('Owner give command error:', error);
        return message.reply('<:arrow:1375872983029256303> An error occurred while giving items.');
      }
    }

    if (command === 'stats') {
      try {
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ lastSeen: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } });
        const totalCards = await User.aggregate([
          { $unwind: '$cards' },
          { $count: 'total' }
        ]);

        const embed = new EmbedBuilder()
          .setTitle(' Bot Statistics')
          .setColor(0x3498db)
          .addFields(
            { name: 'Total Users', value: totalUsers.toString(), inline: true },
            { name: 'Active Users (7 days)', value: activeUsers.toString(), inline: true },
            { name: 'Total Cards Owned', value: totalCards.length > 0 ? totalCards[0].total.toString() : '0', inline: true },
            { name: 'Bot Uptime', value: formatUptime(process.uptime()), inline: true },
            { name: 'Memory Usage', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`, inline: true },
            { name: 'Guilds', value: client.guilds.cache.size.toString(), inline: true }
          );

        return message.reply({ embeds: [embed] });
      } catch (error) {
        console.error('Stats command error:', error);
        return message.reply('<:arrow:1375872983029256303> Error retrieving stats.');
      }
    }

    if (command === 'reset' && message.mentions.users.first()) {
      const targetUser = message.mentions.users.first();
      try {
        await User.deleteOne({ userId: targetUser.id });
        return message.reply(`<:sucess:1375872950321811547> Reset all progress for ${targetUser.username}`);
      } catch (error) {
        console.error('Reset command error:', error);
        return message.reply('<:arrow:1375872983029256303> Error resetting user.');
      }
    }
  }

  return message.reply('<:arrow:1375872983029256303> Unknown owner command or missing arguments.');
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

module.exports = { data, execute };
