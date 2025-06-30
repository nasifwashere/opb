const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js'); // adjust path if needed

const commandCategories = {
  'Collection': {
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
  'Battle': {
    commands: [
      { name: 'team [add/remove] [card]', desc: 'Manage your battle team' },
      { name: 'duel @user', desc: 'Challenge another player' },
      { name: 'level <card>', desc: 'Level up cards using duplicates' },
      { name: 'evolve <card>', desc: 'Evolve cards to stronger forms' }
    ]
  },
  'Adventure': {
    commands: [
      { name: 'explore', desc: 'Continue your story adventure and fight bosses' },
      { name: 'progress', desc: 'View your current saga' },
      { name: 'map', desc: 'View unlocked islands and sagas' },
      { name: 'quest', desc: 'Track and complete missions' }
    ]
  },
  'Economy': {
    commands: [
      { name: 'shop', desc: 'Browse items for purchase' },
      { name: 'buy <item>', desc: 'Purchase items with Beli' },
      { name: 'sell <card/item>', desc: 'Sell items for Beli' },
      { name: 'market', desc: 'Player trading marketplace' }
    ]
  },
  'Social': {
    commands: [
      { name: 'leaderboard', desc: 'View top players' },
      { name: 'set <setting> <value>', desc: 'Change bot settings' }
    ]
  }
};

function createCategoryEmbed(category, categoryData) {
  const embed = new EmbedBuilder()
    .setTitle(`${category} Commands`)
    .setColor(0x1f1f1f)
    .setDescription('`op` prefix is used for all commands.\n\n**Available Commands:**');

  const commandsList = categoryData.commands
    .map(cmd => `› **op ${cmd.name}** — ${cmd.desc}`)
    .join('\n');

  embed.addFields({
    name: '\u200B',
    value: commandsList || 'No commands available.',
    inline: false
  });

  embed.setFooter({
    text: `${categoryData.commands.length} commands • Use "op help" to return`,
    iconURL: 'https://i.imgur.com/KqAB5Mn.png'
  });

  return embed;
}

function createMainEmbed() {
  const embed = new EmbedBuilder()
    .setTitle('One Piece Bot Help Menu')
    .setColor(0x2c2f33)
    .setDescription([
      'Welcome to the **One Piece Gacha RPG**.',
      'Use the buttons below to view commands by category.\n',
      'Start your journey with:',
      '`op start` — create your pirate profile',
      '`op pull` — pull cards from the gacha'
    ].join('\n'));

  Object.keys(commandCategories).forEach(category => {
    const count = commandCategories[category].commands.length;
    embed.addFields({
      name: category,
      value: `${count} command${count !== 1 ? 's' : ''}`,
      inline: true
    });
  });

  embed.setFooter({
    text: 'Use the category buttons below to navigate',
    iconURL: 'https://i.imgur.com/KqAB5Mn.png'
  });

  return embed;
}

function createNavigationButtons() {
  const categories = Object.keys(commandCategories);
  const buttons = [];

  for (let i = 0; i < Math.min(categories.length, 5); i++) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`help_${i}`)
        .setLabel(categories[i])
        .setStyle(ButtonStyle.Secondary)
    );
  }

  const rows = [new ActionRowBuilder().addComponents(buttons)];

  if (categories.length > 5) {
    const secondRowButtons = [];
    for (let i = 5; i < categories.length; i++) {
      secondRowButtons.push(
        new ButtonBuilder()
          .setCustomId(`help_${i}`)
          .setLabel(categories[i])
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
      .setLabel('Back to Categories')
      .setStyle(ButtonStyle.Primary)
  );
}

const data = {
  name: 'help',
  description: 'Display bot commands and help information.'
};

async function execute(message, args, client) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });

  if (user && !user.username) {
    user.username = username;
    await user.save();
  }

  const embed = createMainEmbed();
  const components = createNavigationButtons();

  const helpMessage = await message.reply({ embeds: [embed], components });

  const filter = i => i.user.id === message.author.id;
  const collector = helpMessage.createMessageComponentCollector({ filter, time: 300000 });

  collector.on('collect', async interaction => {
    await interaction.deferUpdate();

    if (interaction.customId === 'help_back') {
      const mainEmbed = createMainEmbed();
      const mainComponents = createNavigationButtons();
      await helpMessage.edit({ embeds: [mainEmbed], components: mainComponents });
      return;
    }

    if (interaction.customId.startsWith('help_')) {
      const categories = Object.keys(commandCategories);
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
