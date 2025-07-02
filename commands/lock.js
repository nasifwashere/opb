const { SlashCommandBuilder, EmbedBuilder  } = require('discord.js');
const User = require('../db/models/User.js');

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function findUserCard(user, cardName) {
  if (!user.cards || !Array.isArray(user.cards)) return null;

  const normInput = normalize(cardName);
  return user.cards.find(card => normalize(card.name) === normInput);
}

const data = new SlashCommandBuilder()
  .setName('lock')
  .setDescription('Lock a card to prevent it from being sold or traded.');

async function execute(message, args) {
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

  if (args.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle('Lock Card')
      .setDescription('Locking a card prevents it from being sold, traded, or accidentally deleted.')
      .addFields({
        name: 'Usage',
        value: '`op lock <card name>`',
        inline: false
      })
      .setFooter({ text: 'Protect your valuable cards' });
    
    return message.reply({ embeds: [embed] });
  }

  const cardName = args.join(' ').trim();

  // Find the card in user's collection
  const userCard = findUserCard(user, cardName);
  if (!userCard) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`You don't own "${cardName}".`)
      .setFooter({ text: 'Card not found in your collection' });
    
    return message.reply({ embeds: [embed] });
  }

  // Check if card is already locked
  if (userCard.locked) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`"${userCard.name}" is already locked.`)
      .setFooter({ text: 'Card is already protected' });
    
    return message.reply({ embeds: [embed] });
  }

  // Lock the card
  const cardIndex = user.cards.findIndex(c => normalize(c.name) === normalize(userCard.name));
  user.cards[cardIndex].locked = true;

  await user.save();

  // Create success embed
  const embed = new EmbedBuilder()
    .setTitle('Card Locked')
    .setDescription(`**${userCard.name}** has been locked and is now protected.`)
    .addFields(
      { name: 'Protection', value: 'Selling • Trading • Accidental deletion', inline: false },
      { name: 'Unlock', value: 'Use `op unlock <card name>` to remove protection', inline: false }
    )
    .setColor(0x2b2d31)
    .setFooter({ text: 'Card is now protected' });

  await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };