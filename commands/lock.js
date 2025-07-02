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

  // Check if card is already in case
  if (!user.case) user.case = [];
  const alreadyInCase = user.case.find(c => normalize(c.name) === normalize(userCard.name));
  if (alreadyInCase) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`"${userCard.name}" is already in your case.`)
      .setFooter({ text: 'Card is already locked away' });
    
    return message.reply({ embeds: [embed] });
  }

  // Check if card is in team - can't lock team cards
  if (user.team && user.team.includes(userCard.name)) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`"${userCard.name}" is in your team. Remove it from your team first.`)
      .setFooter({ text: 'Cannot lock team cards' });
    
    return message.reply({ embeds: [embed] });
  }

  // Check if card is training - can't lock training cards
  if (user.training && user.training.find(t => normalize(t.cardName) === normalize(userCard.name))) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`"${userCard.name}" is currently training. Untrain it first.`)
      .setFooter({ text: 'Cannot lock training cards' });
    
    return message.reply({ embeds: [embed] });
  }

  // Move card to case and remove from cards
  const cardIndex = user.cards.findIndex(c => normalize(c.name) === normalize(userCard.name));
  const originalCard = user.cards[cardIndex];
  
  // Create new card object with all required fields
  const cardToMove = {
    name: originalCard.name,
    rank: originalCard.rank,
    level: originalCard.level || 1,
    experience: originalCard.experience || 0,
    timesUpgraded: originalCard.timesUpgraded || 0,
    locked: true
  };
  
  user.case.push(cardToMove);
  user.cards.splice(cardIndex, 1);
  
  user.markModified('case');
  user.markModified('cards');
  await user.save();

  // Create success embed
  const embed = new EmbedBuilder()
    .setTitle('Card Locked Away')
    .setDescription(`**${userCard.name}** has been moved to your case and is now safely locked away.`)
    .addFields(
      { name: 'Restrictions', value: '• Cannot be sold or traded\n• Cannot be added to team\n• Cannot be leveled up\n• Not visible in collection', inline: false },
      { name: 'Access', value: 'Use `op case` to view your locked cards\nUse `op unlock <card name>` to return it to your collection', inline: false }
    )
    .setColor(0x2b2d31)
    .setFooter({ text: 'Card safely stored in your case' });

  await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };