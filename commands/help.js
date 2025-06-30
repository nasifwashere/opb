const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Get help with bot commands');

async function execute(message, args) {
  const helpEmbed = new EmbedBuilder()
    .setTitle('🏴‍☠️ One Piece Bot Commands')
    .setDescription('Select a category to view commands')
    .setColor(0x3498db);

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
          .setTitle('🚀 Getting Started')
          .setDescription('Essential commands to begin your adventure')
          .addFields(
            { name: '`op start`', value: 'Start your pirate journey', inline: false },
            { name: '`op daily`', value: 'Claim daily rewards', inline: false },
            { name: '`op balance`', value: 'Check your Beli and stats', inline: false },
            { name: '`op progress`', value: 'View your overall progress', inline: false },
            { name: '`op timers`', value: 'Check all active cooldowns', inline: false }
          )
          .setColor(0x2ecc71);
        break;

      case 'cards':
        categoryEmbed = new EmbedBuilder()
          .setTitle('🃏 Cards & Collection')
          .setDescription('Manage and view your card collection')
          .addFields(
            { name: '`op pull`', value: 'Pull new cards from packs', inline: false },
            { name: '`op collection`', value: 'Browse your card collection', inline: false },
            { name: '`op mycard <name>`', value: 'View detailed card info', inline: false },
            { name: '`op info <name>`', value: 'View any card\'s information', inline: false },
            { name: '`op lock/unlock <name>`', value: 'Protect cards from being sold', inline: false },
            { name: '`op evolve <name>`', value: 'Upgrade cards to higher ranks', inline: false }
          )
          .setColor(0x9b59b6);
        break;

      case 'adventure':
        categoryEmbed = new EmbedBuilder()
          .setTitle('⚔️ Adventure & Combat')
          .setDescription('Explore the world and battle enemies')
          .addFields(
            { name: '`op explore`', value: 'Continue your story adventure', inline: false },
            { name: '`op battle @user`', value: 'Challenge another player', inline: false },
            { name: '`op duel @user`', value: 'Quick 1v1 card battle', inline: false },
            { name: '`op map`', value: 'View current location and progress', inline: false },
            { name: '`op quest`', value: 'View and track your quests', inline: false }
          )
          .setColor(0xe74c3c);
        break;

      case 'economy':
        categoryEmbed = new EmbedBuilder()
          .setTitle('💰 Economy & Trading')
          .setDescription('Manage your wealth and trade with others')
          .addFields(
            { name: '`op shop`', value: 'Buy items and card packs', inline: false },
            { name: '`op sell <name>`', value: 'Sell cards for Beli', inline: false },
            { name: '`op trade @user`', value: 'Trade cards with other players', inline: false },
            { name: '`op market`', value: 'Browse player market listings', inline: false },
            { name: '`op buy <listing>`', value: 'Purchase from the market', inline: false },
            { name: '`op inventory`', value: 'View your items and consumables', inline: false }
          )
          .setColor(0xf39c12);
        break;

      case 'team':
        categoryEmbed = new EmbedBuilder()
          .setTitle('👥 Team & Equipment')
          .setDescription('Set up your team and manage equipment')
          .addFields(
            { name: '`op team`', value: 'View and manage your battle team', inline: false },
            { name: '`op team add <name>`', value: 'Add card to your team', inline: false },
            { name: '`op team remove <name>`', value: 'Remove card from team', inline: false },
            { name: '`op equip <item> <card>`', value: 'Equip items to cards', inline: false },
            { name: '`op unequip <card>`', value: 'Remove equipped items', inline: false },
            { name: '`op use <item>`', value: 'Use consumable items', inline: false }
          )
          .setColor(0x3498db);
        break;
    }

    await msg.edit({ embeds: [categoryEmbed], components: [row] });
  });

  collector.on('end', () => {
    msg.edit({ components: [] }).catch(() => {});
  });
}

module.exports = { data, execute };