const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Get help with bot commands');

async function execute(message, args) {
  const helpEmbed = new EmbedBuilder()
    .setTitle('Command Help')
    .setDescription('Select a category to view commands')
    .setColor(0x2b2d31)
    .setFooter({ text: 'Choose a category from the menu below' });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('help_category')
    .setPlaceholder('Choose a command category')
    .addOptions([
      {
        label: 'Getting Started',
        description: 'Basic commands to begin your journey',
        value: 'basics'
      },
      {
        label: 'Cards & Collection',
        description: 'Card management and viewing',
        value: 'cards'
      },
      {
        label: 'Adventure & Combat',
        description: 'Exploration and battle commands',
        value: 'adventure'
      },
      {
        label: 'Economy & Trading',
        description: 'Beli, trading, and market commands',
        value: 'economy'
      },
      {
        label: 'Team & Equipment',
        description: 'Team setup and item management',
        value: 'team'
      },
      {
        label: 'Crews & Raids',
        description: 'Crew management and raid battles',
        value: 'crews'
      }
    ]);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  const msg = await message.reply({ embeds: [helpEmbed], components: [row] });

  const filter = i => i.user.id === message.author.id;
  const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

  collector.on('collect', async interaction => {
    await interaction.deferUpdate();

    let categoryEmbed;
    const category = interaction.values[0];

    switch (category) {
      case 'basics':
        categoryEmbed = new EmbedBuilder()
          .setTitle('Getting Started')
          .setDescription('Essential commands to begin your adventure')
          .addFields(
            { name: 'op start', value: 'Start your pirate journey', inline: true },
            { name: 'op daily', value: 'Claim daily rewards', inline: true },
            { name: 'op balance', value: 'Check your Beli and stats', inline: true },
            { name: 'op user [@player]', value: 'View profile stats and rankings', inline: true },
            { name: 'op leaderboard', value: 'View top player rankings', inline: true },
            { name: 'op progress', value: 'View your overall progress', inline: true },
            { name: 'op timers', value: 'Check all active cooldowns', inline: true },
            { name: 'op bounty', value: 'Get random bounty target (24h cooldown)', inline: true },
            { name: 'op help', value: 'Show this help menu', inline: true }
          )
          .setColor(0x2b2d31)
          .setFooter({ text: 'Start with op start to begin your adventure' });
        break;

      case 'cards':
        categoryEmbed = new EmbedBuilder()
          .setTitle('Cards & Collection')
          .setDescription('Manage and view your card collection')
          .addFields(
            { name: 'op pull', value: 'Pull new cards from packs', inline: true },
            { name: 'op collection', value: 'Browse your card collection', inline: true },
            { name: 'op mycard <n>', value: 'View detailed card info', inline: true },
            { name: 'op info <n>', value: 'View any card information', inline: true },
            { name: 'op lock <n>', value: 'Lock cards away in your case', inline: true },
            { name: 'op unlock <n>', value: 'Return locked cards to collection', inline: true },
            { name: 'op case', value: 'View all your locked cards', inline: true },
            { name: 'op evolve <n>', value: 'Upgrade cards to higher ranks', inline: true }
          )
          .setColor(0x2b2d31)
          .setFooter({ text: 'Build your collection and evolve your cards' });
        break;

      case 'adventure':
        categoryEmbed = new EmbedBuilder()
          .setTitle('Adventure & Combat')
          .setDescription('Explore the world and battle enemies')
          .addFields(
            { name: 'op explore', value: 'Continue your story adventure', inline: true },
            { name: 'op sail', value: 'Travel between different arcs/sagas', inline: true },
            { name: 'op battle @user', value: 'Challenge another player', inline: true },
            { name: 'op duel @user', value: 'Quick 1v1 card battle with bounty', inline: true },
            { name: 'op map', value: 'View current location', inline: true },
            { name: 'op quest', value: 'View and track your quests', inline: true },
            { name: 'op level <n>', value: 'Level up your cards', inline: true }
          )
          .setColor(0x2b2d31)
          .setFooter({ text: 'Explore the Grand Line and grow stronger' });
        break;

      case 'economy':
        categoryEmbed = new EmbedBuilder()
          .setTitle('Economy & Trading')
          .setDescription('Manage your wealth and trade with others')
          .addFields(
            { name: 'op shop', value: 'Buy items and card packs', inline: true },
            { name: 'op buy <item>', value: 'Purchase items from shop', inline: true },
            { name: 'op gamble', value: 'Test your luck with Nami (3h cooldown)', inline: true },
            { name: 'op sell <n>', value: 'Sell cards for Beli', inline: true },
            { name: 'op trade @user', value: 'Trade cards with players', inline: true },
            { name: 'op market', value: 'Browse player market', inline: true },
            { name: 'op market list <type> <item> <price>', value: 'List items for sale (use _worst/_best)', inline: false },
            { name: 'op market buy <listing>', value: 'Purchase from market', inline: true },
            { name: 'op inventory', value: 'View your items', inline: true }
          )
          .setColor(0x2b2d31)
          .setFooter({ text: 'Build your fortune and trade with others' });
        break;

      case 'team':
        categoryEmbed = new EmbedBuilder()
          .setTitle('Team & Equipment')
          .setDescription('Set up your team and manage equipment')
          .addFields(
            { name: 'op team', value: 'View and manage battle team', inline: true },
            { name: 'op team add <n>', value: 'Add card to your team', inline: true },
            { name: 'op team remove <n>', value: 'Remove card from team', inline: true },
            { name: 'op autoteam', value: 'Auto-organize team by power/rarity', inline: true },
            { name: 'op equip <item> <card>', value: 'Equip items to cards', inline: true },
            { name: 'op unequip <card>', value: 'Remove equipped items', inline: true },
            { name: 'op train <card>', value: 'Train cards to gain XP (1/min)', inline: true },
            { name: 'op untrain <card>', value: 'Stop training and get card back', inline: true },
            { name: 'op use <item>', value: 'Use consumable items', inline: true },
            { name: 'op set <setting>', value: 'Configure bot settings/preferences', inline: true },
            { name: 'op clearstuck', value: 'Clear stuck battle states', inline: true },
            { name: 'op clearbattle', value: 'Force end current battle', inline: true }
          )
          .setColor(0x2b2d31)
          .setFooter({ text: 'Build your team and optimize your setup' });
        break;

      case 'crews':
        categoryEmbed = new EmbedBuilder()
          .setTitle('Crews & Raids')
          .setDescription('Join crews and participate in challenging raids')
          .addFields(
            { name: 'op crew', value: 'View your crew information', inline: true },
            { name: 'op crew create <name>', value: 'Create a new crew (as captain)', inline: true },
            { name: 'op crew invite @user', value: 'Invite someone to your crew', inline: true },
            { name: 'op crew accept', value: 'Accept a crew invitation', inline: true },
            { name: 'op crew decline', value: 'Decline a crew invitation', inline: true },
            { name: 'op crew leave', value: 'Leave your current crew', inline: true },
            { name: 'op crew kick @user', value: 'Kick member from crew (captain only)', inline: true },
            { name: 'op raid', value: 'View available raids and raid status', inline: true },
            { name: 'op raid <boss>', value: 'Start raid vs boss (captain only, needs ticket)', inline: true },
            { name: 'op raid add @user', value: 'Add crew member to active raid', inline: true },
            { name: 'op raid leave', value: 'Leave current raid', inline: true },
            { name: 'op raid start', value: 'Force start raid early (captain only)', inline: true },
            { name: 'op raid cancel', value: 'Cancel active raid (captain only)', inline: true }
          )
          .setColor(0x2b2d31)
          .setFooter({ text: 'Team up with others and defeat powerful bosses' });
        break;
    }

    await msg.edit({ embeds: [categoryEmbed], components: [row] });
  });

  collector.on('end', () => {
    msg.edit({ components: [] }).catch(() => {});
  });
}

module.exports = { data, execute };