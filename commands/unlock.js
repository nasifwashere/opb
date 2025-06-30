const { EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function findUserCard(user, cardName) {
  return user.cards?.find(c => normalize(c.name) === normalize(cardName));
}

const data = { name: 'unlock', description: 'Unlock a card to allow selling or trading.' };

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
    return message.reply('Usage: `op unlock <card name>`\n\nUnlocking a card allows it to be sold or traded again.');
  }

  const cardName = args.join(' ').trim();

  // Find the card in user's collection
  const userCard = findUserCard(user, cardName);
  if (!userCard) {
    return message.reply(`❌ You don't own "${cardName}".`);
  }

  // Check if card is locked
  if (!userCard.locked) {
    return message.reply(`❌ "${userCard.name}" is not locked.`);
  }

  // Unlock the card
  const cardIndex = user.cards.findIndex(c => normalize(c.name) === normalize(userCard.name));
  user.cards[cardIndex].locked = false;

  await user.save();

  // Create success embed
  const embed = new EmbedBuilder()
    .setTitle('🔓 Card Unlocked!')
    .setDescription(`**${userCard.name}** has been unlocked.`)
    .addFields(
      { name: 'Status', value: 'This card can now be sold or traded', inline: false },
      { name: 'Note', value: 'Use `op lock <card name>` to protect it again', inline: false }
    )
    .setColor(0x2ecc40);

  await message.reply({ embeds: [embed] });
}


module.exports = { data, execute };