
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');

const cardsPath = path.resolve('data', 'cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

const activeTrades = new Map();

const data = new SlashCommandBuilder()
  .setName('trade')
  .setDescription('Trade cards with another player')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('The user you want to trade with')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('your_card')
      .setDescription('The card you want to trade away')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('their_card')
      .setDescription('The card you want from them')
      .setRequired(true));

async function execute(message, args, client) {
  const userId = message.author.id;
  const targetUser = message.mentions.users.first();
  
  if (!targetUser) {
    return message.reply('Please mention a user to trade with!');
  }

  if (targetUser.id === userId) {
    return message.reply('You cannot trade with yourself!');
  }

  if (targetUser.bot) {
    return message.reply('You cannot trade with bots!');
  }

  // Find the @ mention position to properly split the arguments
  const mentionIndex = args.findIndex(arg => arg.startsWith('<@'));
  if (mentionIndex === -1) {
    return message.reply('Please mention a user! Usage: `op trade @user "Your Card Name" "Their Card Name"`');
  }

  // Get everything after the mention
  const cardArgs = args.slice(mentionIndex + 1);
  
  if (cardArgs.length < 2) {
    return message.reply('Please specify both cards! Usage: `op trade @user "Your Card Name" "Their Card Name"`');
  }

  // Split arguments - everything except last word is your card, last word is their card
  const yourCardName = cardArgs.slice(0, -1).join(' ');
  const theirCardName = cardArgs[cardArgs.length - 1];

  if (!yourCardName || !theirCardName) {
    return message.reply('Please specify both cards! Usage: `op trade @user "Your Card Name" "Their Card Name"`');
  }

  // Get both users from database
  const [user1, user2] = await Promise.all([
    User.findOne({ userId }),
    User.findOne({ userId: targetUser.id })
  ]);

  if (!user1) {
    return message.reply('Start your journey with `op start` first!');
  }

  if (!user2) {
    return message.reply('The other user needs to start their journey first!');
  }

  // Fuzzy matching function
  function fuzzyFindCard(cards, searchName) {
    if (!cards || !searchName) return null;
    
    const search = searchName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Exact match first
    let match = cards.find(c => c.name.toLowerCase() === searchName.toLowerCase());
    if (match) return match;
    
    // Fuzzy match
    match = cards.find(c => {
      const cardName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cardName.includes(search) || search.includes(cardName);
    });
    
    return match;
  }

  // Check if users have the cards
  const user1Card = fuzzyFindCard(user1.cards, yourCardName);
  const user2Card = fuzzyFindCard(user2.cards, theirCardName);

  if (!user1Card) {
    return message.reply(`You don't have **${yourCardName}**!`);
  }

  if (!user2Card) {
    return message.reply(`${targetUser.username} doesn't have **${theirCardName}**!`);
  }

  // Check if cards are locked
  if (user1Card.locked) {
    return message.reply(`Your **${yourCardName}** is locked and cannot be traded!`);
  }

  if (user2Card.locked) {
    return message.reply(`Their **${theirCardName}** is locked and cannot be traded!`);
  }

  // Create trade offer
  const tradeId = `${userId}_${targetUser.id}_${Date.now()}`;
  const tradeData = {
    user1: { id: userId, username: message.author.username, card: user1Card },
    user2: { id: targetUser.id, username: targetUser.username, card: user2Card },
    status: 'pending',
    expiresAt: Date.now() + 300000 // 5 minutes
  };

  activeTrades.set(tradeId, tradeData);

  const embed = new EmbedBuilder()
    .setTitle('🤝 Trade Offer')
    .setDescription(`**${message.author.username}** wants to trade with **${targetUser.username}**`)
    .addFields(
      {
        name: `${message.author.username} offers:`,
        value: `**${user1Card.name}** (Rank ${user1Card.rank}, Level ${user1Card.level || 1})`,
        inline: true
      },
      {
        name: `${targetUser.username} gives:`,
        value: `**${user2Card.name}** (Rank ${user2Card.rank}, Level ${user2Card.level || 1})`,
        inline: true
      }
    )
    .setColor(0xffa500)
    .setFooter({ text: 'Trade expires in 5 minutes' });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`trade_accept_${tradeId}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`trade_decline_${tradeId}`)
        .setLabel('Decline')
        .setStyle(ButtonStyle.Danger)
    );

  const tradeMessage = await message.reply({ 
    content: `${targetUser}, you have a trade offer!`,
    embeds: [embed], 
    components: [row] 
  });

  // Handle trade responses
  const filter = i => i.user.id === targetUser.id && i.customId.startsWith('trade_');
  const collector = tradeMessage.createMessageComponentCollector({ filter, time: 300000 });

  collector.on('collect', async interaction => {
    await interaction.deferUpdate();

    const trade = activeTrades.get(tradeId);
    if (!trade || trade.status !== 'pending') {
      return await interaction.followUp({ content: 'This trade is no longer available.', ephemeral: true });
    }

    if (interaction.customId.includes('accept')) {
      // Execute trade
      try {
        // Refresh user data
        const [freshUser1, freshUser2] = await Promise.all([
          User.findOne({ userId: trade.user1.id }),
          User.findOne({ userId: trade.user2.id })
        ]);

        // Verify cards still exist
        const card1Index = freshUser1.cards.findIndex(c => c.name === trade.user1.card.name);
        const card2Index = freshUser2.cards.findIndex(c => c.name === trade.user2.card.name);

        if (card1Index === -1 || card2Index === -1) {
          throw new Error('One of the cards is no longer available');
        }

        // Swap cards
        const tempCard = freshUser1.cards[card1Index];
        freshUser1.cards[card1Index] = freshUser2.cards[card2Index];
        freshUser2.cards[card2Index] = tempCard;

        await Promise.all([freshUser1.save(), freshUser2.save()]);

        trade.status = 'completed';
        
        const successEmbed = new EmbedBuilder()
          .setTitle('✅ Trade Completed!')
          .setDescription('The trade has been successfully completed!')
          .addFields(
            {
              name: `${trade.user1.username} received:`,
              value: `**${trade.user2.card.name}**`,
              inline: true
            },
            {
              name: `${trade.user2.username} received:`,
              value: `**${trade.user1.card.name}**`,
              inline: true
            }
          )
          .setColor(0x00ff00);

        await tradeMessage.edit({ embeds: [successEmbed], components: [] });
        
      } catch (error) {
        console.error('Trade execution error:', error);
        const errorEmbed = new EmbedBuilder()
          .setTitle('❌ Trade Failed')
          .setDescription('An error occurred while executing the trade.')
          .setColor(0xff0000);

        await tradeMessage.edit({ embeds: [errorEmbed], components: [] });
      }
    } else {
      // Decline trade
      trade.status = 'declined';
      
      const declineEmbed = new EmbedBuilder()
        .setTitle('❌ Trade Declined')
        .setDescription(`${targetUser.username} declined the trade offer.`)
        .setColor(0xff0000);

      await tradeMessage.edit({ embeds: [declineEmbed], components: [] });
    }

    activeTrades.delete(tradeId);
    collector.stop();
  });

  collector.on('end', () => {
    const trade = activeTrades.get(tradeId);
    if (trade && trade.status === 'pending') {
      trade.status = 'expired';
      activeTrades.delete(tradeId);
      
      const expiredEmbed = new EmbedBuilder()
        .setTitle('⏰ Trade Expired')
        .setDescription('This trade offer has expired.')
        .setColor(0x95a5a6);

      tradeMessage.edit({ embeds: [expiredEmbed], components: [] }).catch(() => {});
    }
  });
}

module.exports = { data, execute };
