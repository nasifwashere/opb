const { SlashCommandBuilder, EmbedBuilder  } = require('discord.js');
const User = require('../db/models/User.js');

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function findUserCard(user, cardName) {
  return user.cards?.find(c => normalize(c.name) === normalize(cardName));
}

const data = new SlashCommandBuilder()
  .setName('unlock')
  .setDescription('Unlock a card to allow selling or trading.');

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
      .setTitle('Unlock Card')
      .setDescription('Unlocking a card allows it to be sold or traded again.')
      .addFields({
        name: 'Usage',
        value: '`op unlock <card name>`',
        inline: false
      })
      .setFooter({ text: 'Remove protection from cards' });
    
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

  // Check if card is locked
  if (!userCard.locked) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`"${userCard.name}" is not locked.`)
      .setFooter({ text: 'Card is not protected' });
    
    return message.reply({ embeds: [embed] });
  }

  // Unlock the card
  const cardIndex = user.cards.findIndex(c => normalize(c.name) === normalize(userCard.name));
  user.cards[cardIndex].locked = false;

  await user.save();

  // Create success embed
  const embed = new EmbedBuilder()
    .setTitle('Card Unlocked')
    .setDescription(`**${userCard.name}** has been unlocked.`)
    .addFields(
      { name: 'Status', value: 'This card can now be sold or traded', inline: false },
      { name: 'Protection', value: 'Use `op lock <card name>` to protect it again', inline: false }
    )
    .setColor(0x2b2d31)
    .setFooter({ text: 'Card protection removed' });

  await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };