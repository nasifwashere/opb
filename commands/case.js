const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');

const data = new SlashCommandBuilder()
  .setName('case')
  .setDescription('View all your locked cards stored safely in your case.');

async function execute(message, args, client) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });

  if (!user) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription('Start your journey with `op start` first!')
      .setFooter({ text: 'Use op start to begin your adventure' });
    
    return message.reply({ embeds: [embed] });
  }

  // Ensure username is set if missing
  if (!user.username) {
    user.username = username;
    await user.save();
  }

  // Initialize case if it doesn't exist
  if (!user.case) user.case = [];

  // Check if case is empty
  if (user.case.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle('<:Padlock_Crown:1390839220016250890> Your Case')
      .setDescription('Your case is empty! No cards are currently locked away.')
      .addFields(
        { name: 'Lock Cards', value: 'Use `op lock <card name>` to safely store valuable cards', inline: false }
      )
      .setColor(0x2b2d31)
      .setFooter({ text: 'Protect your valuable cards from accidents' });
    
    return message.reply({ embeds: [embed] });
  }

  // Sort cards by rank (UR, S, A, B, C) then by name
  const rankOrder = { 'UR': 0, 'S': 1, 'A': 2, 'B': 3, 'C': 4 };
  const sortedCards = user.case.sort((a, b) => {
    const rankDiff = (rankOrder[a.rank] || 5) - (rankOrder[b.rank] || 5);
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });

  const CARDS_PER_PAGE = 10;
  const totalPages = Math.ceil(sortedCards.length / CARDS_PER_PAGE);
  
  // Get page number from args or default to 1
  let page = 1;
  if (args.length > 0) {
    const inputPage = parseInt(args[0]);
    if (inputPage > 0 && inputPage <= totalPages) {
      page = inputPage;
    }
  }

  const startIndex = (page - 1) * CARDS_PER_PAGE;
  const endIndex = Math.min(startIndex + CARDS_PER_PAGE, sortedCards.length);
  const pageCards = sortedCards.slice(startIndex, endIndex);

  // Build card list
  let cardList = '';
  pageCards.forEach((card, index) => {
    const globalIndex = startIndex + index + 1;
    const rankEmoji = getRankEmoji(card.rank);
    cardList += `${globalIndex}. ${rankEmoji} **${card.name}** (${card.rank}) • Lv.${card.level}\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle('🗄️ Your Case')
    .setDescription(`Here are your safely locked cards:\n\n${cardList}`)
    .addFields(
      { name: 'Total Locked Cards', value: `${user.case.length}`, inline: true },
      { name: 'Page', value: `${page}/${totalPages}`, inline: true },
      { name: 'Unlock', value: 'Use `op unlock <card name>` to return a card to your collection', inline: false }
    )
    .setColor(0x2b2d31)
    .setFooter({ text: `Showing cards ${startIndex + 1}-${endIndex} of ${sortedCards.length}` });

  // Add navigation buttons if there are multiple pages
  if (totalPages > 1) {
    const row = new ActionRowBuilder();

    if (page > 1) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`case_page_${page - 1}`)
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
      );
    }

    if (page < totalPages) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`case_page_${page + 1}`)
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('➡️')
      );
    }

    if (row.components.length > 0) {
      const msg = await message.reply({ embeds: [embed], components: [row] });

      // Set up button collector
      const filter = i => i.user.id === message.author.id && i.customId.startsWith('case_page_');
      const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

      collector.on('collect', async interaction => {
        await interaction.deferUpdate();
        
        const newPage = parseInt(interaction.customId.split('_')[2]);
        
        // Recalculate for new page
        const newStartIndex = (newPage - 1) * CARDS_PER_PAGE;
        const newEndIndex = Math.min(newStartIndex + CARDS_PER_PAGE, sortedCards.length);
        const newPageCards = sortedCards.slice(newStartIndex, newEndIndex);

        let newCardList = '';
        newPageCards.forEach((card, index) => {
          const globalIndex = newStartIndex + index + 1;
          const rankEmoji = getRankEmoji(card.rank);
          newCardList += `${globalIndex}. ${rankEmoji} **${card.name}** (${card.rank}) • Lv.${card.level}\n`;
        });

        const newEmbed = new EmbedBuilder()
          .setTitle('🗄️ Your Case')
          .setDescription(`Here are your safely locked cards:\n\n${newCardList}`)
          .addFields(
            { name: 'Total Locked Cards', value: `${user.case.length}`, inline: true },
            { name: 'Page', value: `${newPage}/${totalPages}`, inline: true },
            { name: 'Unlock', value: 'Use `op unlock <card name>` to return a card to your collection', inline: false }
          )
          .setColor(0x2b2d31)
          .setFooter({ text: `Showing cards ${newStartIndex + 1}-${newEndIndex} of ${sortedCards.length}` });

        // Update buttons
        const newRow = new ActionRowBuilder();

        if (newPage > 1) {
          newRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`case_page_${newPage - 1}`)
              .setLabel('Previous')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('⬅️')
          );
        }

        if (newPage < totalPages) {
          newRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`case_page_${newPage + 1}`)
              .setLabel('Next')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('➡️')
          );
        }

        await msg.edit({ embeds: [newEmbed], components: newRow.components.length > 0 ? [newRow] : [] });
      });

      collector.on('end', () => {
        msg.edit({ components: [] }).catch(() => {});
      });

      return;
    }
  }

  await message.reply({ embeds: [embed] });
}

function getRankEmoji(rank) {
  switch (rank) {
    case 'UR': return '';
    case 'S': return '';
    case 'A': return '';
    case 'B': return '';
    case 'C': return '';
    default: return '';
  }
}

module.exports = { data, execute };