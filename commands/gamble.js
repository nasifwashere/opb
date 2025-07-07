const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

const data = new SlashCommandBuilder()
  .setName('gamble')
  .setDescription('Test your luck at gambling! Requires Nami to use. (3 hour cooldown)');

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

  // Defensive: ensure user.cards is always an array
  if (!Array.isArray(user.cards)) user.cards = [];

  // Defensive: ensure gamblingData is always initialized
  if (!user.gamblingData || typeof user.gamblingData !== 'object') {
    user.gamblingData = {
      lastGamble: 0,
      remainingGambles: 3
    };
    await user.save();
  }

  // Check if user has any Nami card (base or evolved forms)
  const hasNami = user.cards && user.cards.some(card => 
    normalize(card.name).includes('nami') && 
    (!user.case || !user.case.find(c => normalize(c.name) === normalize(card.name))) &&
    (!user.training || !user.training.find(t => normalize(t.cardName) === normalize(card.name)))
  );

  if (!hasNami) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle('<:namirich:1375662701702807632> Gambling Den')
      .setDescription('You need **Nami** (any form) in your collection to access the gambling den!')
      .setFooter({ text: 'Nami must not be locked away or training' });
    
    return message.reply({ embeds: [embed] });
  }

  // Initialize gambling data if missing
  if (!user.gamblingData) {
    user.gamblingData = {
      lastGamble: 0,
      remainingGambles: 3
    };
  }

  // Check cooldown (3 hours = 3 * 60 * 60 * 1000 milliseconds)
  const cooldownTime = 3 * 60 * 60 * 1000;
  const timeSinceLastGamble = Date.now() - user.gamblingData.lastGamble;

  if (timeSinceLastGamble >= cooldownTime) {
    // Reset gambling opportunities
    user.gamblingData.remainingGambles = 3;
    user.gamblingData.lastGamble = Date.now();
    await user.save(); // Save the reset to prevent inconsistency
  }

  if (user.gamblingData.remainingGambles <= 0) {
    const timeLeft = cooldownTime - timeSinceLastGamble;
    const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
    const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle('<:namirich:1375662701702807632> Gambling Den - On Cooldown')
      .setDescription(`You've used all your gambling opportunities!\n\n⏰ **Next reset:** ${hoursLeft}h ${minutesLeft}m`)
      .setFooter({ text: 'Gambling resets every 3 hours' });
    
    return message.reply({ embeds: [embed] });
  }

  // Show gambling menu
  const embed = new EmbedBuilder()
    .setTitle('<:namirich:1375662701702807632> Gambling Den')
    .setDescription(`Welcome to the gambling den, ${username}! Nami guides your luck.\n\n**Remaining Gambles:** ${user.gamblingData.remainingGambles}/3`)
    .addFields(
      { 
        name: 'Low Risk Gamble', 
        value: '**50%** chance: +1,000 Beli\n**50%** chance: -500 Beli',
        inline: true 
      },
      { 
        name: 'Medium Risk Gamble', 
        value: '**30%** chance: +2,000 Beli\n**70%** chance: -1,000 Beli',
        inline: true 
      },
      { 
        name: 'High Risk Gamble', 
        value: '**10%** chance: +5,000 Beli\n**90%** chance: -2,500 Beli',
        inline: true 
      }
    )
    .setColor(0xffd700)
    .setFooter({ text: 'Choose your gamble wisely!' });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('gamble_low')
        .setLabel('Low Risk')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('gamble_medium')
        .setLabel('Medium Risk')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('gamble_high')
        .setLabel('High Risk')
        .setStyle(ButtonStyle.Danger)
    );

  const msg = await message.reply({ embeds: [embed], components: [row] });

  const filter = i => i.user.id === userId;
  const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

  collector.on('collect', async interaction => {
    await interaction.deferUpdate();

    // Get fresh user data
    const freshUser = await User.findOne({ userId });
    if (!freshUser || freshUser.gamblingData.remainingGambles <= 0) {
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle('<:namirich:1375662701702807632> Gambling Den')
          .setDescription('No gambles remaining!')
        ],
        components: []
      });
      return;
    }

    let winChance = 0;
    let winAmount = 0;
    let loseAmount = 0;
    let riskLevel = '';

    switch (interaction.customId) {
      case 'gamble_low':
        winChance = 50;
        winAmount = 1000;
        loseAmount = 500;
        riskLevel = 'Low Risk';
        break;
      case 'gamble_medium':
        winChance = 30;
        winAmount = 2000;
        loseAmount = 1000;
        riskLevel = 'Medium Risk';
        break;
      case 'gamble_high':
        winChance = 10;
        winAmount = 5000;
        loseAmount = 2500;
        riskLevel = 'High Risk';
        break;
    }

    // Check if user has enough beli for potential loss
    if (freshUser.beli < loseAmount) {
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle('<:namirich:1375662701702807632> Gambling Den')
          .setDescription(`You don't have enough Beli for this gamble!\n\nYou need at least **${loseAmount}** Beli but only have **${freshUser.beli}** Beli.`)
        ],
        components: []
      });
      return;
    }

    // Roll the dice
    const roll = Math.random() * 100;
    const won = roll < winChance;

    // Update user beli and gambling data
    if (won) {
      freshUser.beli += winAmount;
    } else {
      freshUser.beli -= loseAmount;
    }

    freshUser.gamblingData.remainingGambles -= 1;

    try {
      await freshUser.save();
    } catch (error) {
      console.error('Error saving gambling result:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle('<:namirich:1375662701702807632> Gambling Den')
          .setDescription('An error occurred while processing your gamble. Please try again.')
        ],
        components: []
      });
      return;
    }

    // Show result
    const resultEmbed = new EmbedBuilder()
      .setTitle(` ${riskLevel} Gamble Result`)
      .setDescription(won 
        ? ` **You won!** Nami's luck blessed you!\n\n<:money:1390838687104897136> **+${winAmount}** Beli`
        : `**You lost!** Better luck next time...\n\n<:money:1390838687104897136> **-${loseAmount}** Beli`
      )
      .addFields(
        { name: 'Current Beli', value: `${freshUser.beli}`, inline: true },
        { name: 'Remaining Gambles', value: `${freshUser.gamblingData.remainingGambles}/3`, inline: true }
      )
      .setColor(won ? 0x2ecc71 : 0xe74c3c)
      .setFooter({ text: won ? 'Nami smiles upon you!' : 'Nami shakes her head...' });

    // Add continue button if gambles remaining
    let components = [];
    if (freshUser.gamblingData.remainingGambles > 0) {
      const continueRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('gamble_again')
            .setLabel('Gamble Again')
            .setStyle(ButtonStyle.Secondary)
        );
      components = [continueRow];
    }

    await interaction.editReply({ embeds: [resultEmbed], components });

    // Handle continue gambling
    if (components.length > 0) {
      const continueCollector = msg.createMessageComponentCollector({ 
        filter: i => i.user.id === userId,
        time: 60000 
      });

      continueCollector.on('collect', async continueInteraction => {
        if (continueInteraction.customId === 'gamble_again') {
          await continueInteraction.deferUpdate();
          
          // Show gambling menu again
          const newEmbed = new EmbedBuilder()
            .setTitle('<:namirich:1375662701702807632> Gambling Den')
            .setDescription(`Welcome back! Ready for another round?\n\n**Remaining Gambles:** ${freshUser.gamblingData.remainingGambles}/3`)
            .addFields(
              { 
                name: 'Low Risk Gamble', 
                value: '**50%** chance: +1,000 Beli\n**50%** chance: -500 Beli',
                inline: true 
              },
              { 
                name: 'Medium Risk Gamble', 
                value: '**30%** chance: +2,000 Beli\n**70%** chance: -1,000 Beli',
                inline: true 
              },
              { 
                name: 'High Risk Gamble', 
                value: '**10%** chance: +5,000 Beli\n**90%** chance: -2,500 Beli',
                inline: true 
              }
            )
            .setColor(0xffd700)
            .setFooter({ text: 'Choose your next gamble!' });

          await continueInteraction.editReply({ embeds: [newEmbed], components: [row] });
        }
      });

      continueCollector.on('end', () => {
        msg.edit({ components: [] }).catch(() => {});
      });
    }
  });

  collector.on('end', () => {
    msg.edit({ components: [] }).catch(() => {});
  });
}

module.exports = { data, execute };