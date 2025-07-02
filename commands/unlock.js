const { SlashCommandBuilder, EmbedBuilder  } = require('discord.js');
const User = require('../db/models/User.js');

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function findUserCard(user, cardName) {
  return user.cards?.find(c => normalize(c.name) === normalize(cardName));
}

function findCaseCard(user, cardName) {
  return user.case?.find(c => normalize(c.name) === normalize(cardName));
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

  // Initialize case array if it doesn't exist
  if (!user.case) user.case = [];

  // Find the card in user's case (locked cards)
  const caseCard = findCaseCard(user, cardName);
  if (!caseCard) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`"${cardName}" is not in your case. Only locked cards can be unlocked.`)
      .setFooter({ text: 'Card not found in your case' });
    
    return message.reply({ embeds: [embed] });
  }

  // Move card back to collection and remove from case
  const caseIndex = user.case.findIndex(c => normalize(c.name) === normalize(caseCard.name));
  const cardToMove = { ...user.case[caseIndex] };
  cardToMove.locked = false;
  
  user.cards.push(cardToMove);
  user.case.splice(caseIndex, 1);
  
  user.markModified('case');
  user.markModified('cards');
  await user.save();

  // Create success embed
  const embed = new EmbedBuilder()
    .setTitle('Card Unlocked')
    .setDescription(`**${caseCard.name}** has been moved back to your collection.`)
    .addFields(
      { name: 'Available Actions', value: '• Can be sold or traded\n• Can be added to team\n• Can be leveled up\n• Visible in collection', inline: false },
      { name: 'Lock Again', value: 'Use `op lock <card name>` to move it back to your case', inline: false }
    )
    .setColor(0x2b2d31)
    .setFooter({ text: 'Card returned to collection' });

  await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };