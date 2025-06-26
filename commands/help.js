const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const commandCategories = {
  '📦 Collection': {
    commands: [
      { name: 'start', desc: 'Begin your pirate adventure' },
      { name: 'pull', desc: 'Pull random cards from gacha' },
      { name: 'collection [rank]', desc: 'View your card collection' },
      { name: 'info <card>', desc: 'View detailed card information' },
      { name: 'inventory', desc: 'View your items' },
      { name: 'equip <item> <card>', desc: 'Equip items to cards' },
      { name: 'unequip <card>', desc: 'Unequip items from cards' },
      { name: 'lock <card>', desc: 'Protect cards from selling/trading' },
      { name: 'unlock <card>', desc: 'Remove card protection' }
    ]
  },
  '⚔️ Battle': {
    commands: [
      { name: 'team [add/remove] [card]', desc: 'Manage your battle team' },
      { name: 'battle', desc: 'Fight PvE boss battles' },
      { name: 'duel @user', desc: 'Challenge another player' },
      { name: 'level <card>', desc: 'Level up cards using duplicates' },
      { name: 'evolve <card>', desc: 'Evolve cards to stronger forms' }
    ]
  },
  '🗺️ Adventure': {
    commands: [
      { name: 'explore', desc: 'Continue your story adventure' },
      { name: 'progress', desc: 'View your current saga' },
      { name: 'map', desc: 'View unlocked islands and sagas' },
      { name: 'quest', desc: 'View and track daily/weekly quests' }
    ]
  },
  '💰 Economy': {
    commands: [
      { name: 'shop', desc: 'Browse items for purchase' },
      { name: 'buy <item>', desc: 'Purchase items with Beli' },
      { name: 'sell <card/item>', desc: 'Sell items for Beli' },
      { name: 'market', desc: 'Player trading marketplace' }
    ]
  },
  '🏆 Social': {
    commands: [
      { name: 'leaderboard', desc: 'View top players' },
      { name: 'set <setting> <value>', desc: 'Change bot settings' }
    ]
  },
  '🛡️ Admin': {
    commands: [
      { name: 'disallow <card>', desc: 'Disable cards from battles' }
    ]
  }
};

function createCategoryEmbed(category, categoryData) {
  const embed = new EmbedBuilder()
    .setTitle(`${category} Commands`)
    .setDescription('Here are the available commands in this category:')
    .setColor(0x3498db);

  categoryData.commands.forEach(cmd => {
    embed.addFields({ name: `op ${cmd.name}`, value: cmd.desc, inline: false });
  });

  embed.setFooter({ text: 'Use op help to return to the main menu' });
  return embed;
}

function createMainEmbed() {
  const embed = new EmbedBuilder()
    .setTitle('🏴‍☠️ One Piece Bot Commands')
    .setDescription('Welcome to the One Piece Gacha RPG! Choose a category below to see available commands.')
    .setColor(0xe67e22);

  Object.keys(commandCategories).forEach(category => {
    const count = commandCategories[category].commands.length;
    embed.addFields({ 
      name: category, 
      value: `${count} command${count !== 1 ? 's' : ''}`, 
      inline: true 
    });
  });

  embed.addFields({ 
    name: '💡 Quick Start', 
    value: 'New to the bot? Start with `op start` then `op pull` to get your first cards!', 
    inline: false 
  });

  return embed;
}

function createNavigationButtons() {
  const categories = Object.keys(commandCategories);
  const buttons = [];
  
  // Create buttons for each category (max 5 per row)
  for (let i = 0; i < Math.min(categories.length, 5); i++) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`help_${i}`)
        .setLabel(categories[i].split(' ')[1] || categories[i]) // Remove emoji for button label
        .setStyle(ButtonStyle.Secondary)
    );
  }

  const rows = [new ActionRowBuilder().addComponents(buttons)];

  // Add second row if needed
  if (categories.length > 5) {
    const secondRowButtons = [];
    for (let i = 5; i < categories.length; i++) {
      secondRowButtons.push(
        new ButtonBuilder()
          .setCustomId(`help_${i}`)
          .setLabel(categories[i].split(' ')[1] || categories[i])
          .setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(new ActionRowBuilder().addComponents(secondRowButtons));
  }

  return rows;
}

function createBackButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('help_back')
      .setLabel('← Back to Categories')
      .setStyle(ButtonStyle.Primary)
  );
}

const data = { name: 'help', description: 'Display bot commands and help information.' };

async function execute(message, args) {
  const categories = Object.keys(commandCategories);
  
  // If specific category requested
  const categoryArg = args.join(' ').toLowerCase();
  const matchedCategory = categories.find(cat => 
    cat.toLowerCase().includes(categoryArg) || 
    cat.split(' ')[1]?.toLowerCase() === categoryArg
  );

  if (matchedCategory) {
    const embed = createCategoryEmbed(matchedCategory, commandCategories[matchedCategory]);
    return message.reply({ embeds: [embed], components: [createBackButton()] });
  }

  // Show main help menu
  const embed = createMainEmbed();
  const components = createNavigationButtons();
  
  const helpMessage = await message.reply({ embeds: [embed], components });

  // Button interaction collector
  const filter = i => i.user.id === message.author.id;
  const collector = helpMessage.createMessageComponentCollector({ filter, time: 300000 });

  collector.on('collect', async interaction => {
    await interaction.deferUpdate();

    if (interaction.customId === 'help_back') {
      // Return to main menu
      const mainEmbed = createMainEmbed();
      const mainComponents = createNavigationButtons();
      await helpMessage.edit({ embeds: [mainEmbed], components: mainComponents });
      return;
    }

    // Handle category selection
    if (interaction.customId.startsWith('help_')) {
      const categoryIndex = parseInt(interaction.customId.split('_')[1]);
      const categoryName = categories[categoryIndex];
      
      if (categoryName && commandCategories[categoryName]) {
        const categoryEmbed = createCategoryEmbed(categoryName, commandCategories[categoryName]);
        await helpMessage.edit({ embeds: [categoryEmbed], components: [createBackButton()] });
      }
    }
  });

  collector.on('end', () => {
    helpMessage.edit({ components: [] }).catch(() => {});
  });
}


module.exports = { data, execute };