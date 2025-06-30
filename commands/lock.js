const { EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function findUserCard(user, cardName) {
  if (!user.cards || !Array.isArray(user.cards)) return null;

  const normInput = normalize(cardName);
  return user.cards.find(card => normalize(card.name) === normInput);
}

const data = { name: 'lock', description: 'Lock a card to prevent it from being sold or traded.' };

async function execute(message, args) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });

  if (!user) {
    return message.reply('Start your journey with `op start` first!');
  }

  // Ensure username is set if missing
  if (!user.username) {
    user.username = username;
    await user.save();
  }

  if (args.length === 0) {
    return message.reply('Usage: `op lock <card name>`\n\nLocking a card prevents it from being sold, traded, or accidentally deleted.');
  }

  const cardName = args.join(' ').trim();

  // Find the card in user's collection
  const userCard = findUserCard(user, cardName);
  if (!userCard) {
    return message.reply(`❌ You don't own "${cardName}".`);
  }

  // Check if card is already locked
  if (userCard.locked) {
    return message.reply(`❌ "${userCard.name}" is already locked.`);
  }

  // Lock the card
  const cardIndex = user.cards.findIndex(c => normalize(c.name) === normalize(userCard.name));
  user.cards[cardIndex].locked = true;

  await user.save();

  // Create success embed
  const embed = new EmbedBuilder()
    .setTitle('🔒 Card Locked!')
    .setDescription(`**${userCard.name}** has been locked and is now protected from:`)
    .addFields(
      { name: 'Protection', value: '• Selling\n• Trading\n• Accidental deletion', inline: false },
      { name: 'Note', value: 'Use `op unlock <card name>` to remove protection', inline: false }
    )
    .setColor(0xe67e22);

  await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };