const { SlashCommandBuilder, EmbedBuilder  } = require('discord.js');
const User = require('../db/models/User.js');

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function fuzzyFindCard(cards, input) {
  if (!cards || cards.length === 0) return null;
  
  const normInput = normalize(input);
  
  // First try exact match
  let match = cards.find(card => normalize(card.name) === normInput);
  if (match) return match;
  
  // Then try partial matches with scoring
  let bestMatch = null;
  let bestScore = 0;

  for (const card of cards) {
    const normName = normalize(card.name);
    let score = 0;

    if (normName.includes(normInput)) score = 2;
    else if (normName.startsWith(normInput)) score = 1;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = card;
    }
  }

  return bestMatch;
}

function findUserCard(user, cardName) {
  return fuzzyFindCard(user.cards, cardName);
}

function findCaseCard(user, cardName) {
  return fuzzyFindCard(user.case, cardName);
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
  const originalCard = user.case[caseIndex];
  
  // Create new card object with all required fields
  const cardToMove = {
    name: originalCard.name,
    rank: originalCard.rank,
    level: originalCard.level || 1,
    experience: originalCard.experience || 0,
    timesUpgraded: originalCard.timesUpgraded || 0,
    locked: false
  };
  
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