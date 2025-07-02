const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

// Normalize string for fuzzy matching
function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

// Fuzzy find a card from user's card list
function fuzzyFindCard(cards, input) {
  const normInput = normalize(input);
  let bestMatch = null;
  let bestScore = 0;

  for (const card of cards) {
    const normName = normalize(card.name);
    let score = 0;

    if (normName === normInput) score = 3;
    else if (normName.includes(normInput)) score = 2;
    else if (normName.startsWith(normInput)) score = 1;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = card;
    }
  }

  return bestMatch;
}

const data = new SlashCommandBuilder()
  .setName('unequip')
  .setDescription('Unequip an item from a card.');

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
      .setTitle('Unequip Item')
      .setDescription('Remove equipment from a card and return it to your inventory.')
      .addFields({
        name: 'Usage',
        value: '`op unequip <card name>`',
        inline: false
      })
      .setFooter({ text: 'Remove equipment to change your setup' });
    
    return message.reply({ embeds: [embed] });
  }

  const cardInput = args.join(' ');
  const userCard = fuzzyFindCard(user.cards || [], cardInput);

  if (!userCard) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`You don't own a card named "${cardInput}".`)
      .setFooter({ text: 'Check your collection with op collection' });
    
    return message.reply({ embeds: [embed] });
  }

  const normCard = normalize(userCard.name);

  if (!user.equipped || !user.equipped[normCard]) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`${userCard.name} has no equipment to unequip.`)
      .setFooter({ text: 'This card has no items equipped' });
    
    return message.reply({ embeds: [embed] });
  }

  const equippedItem = user.equipped[normCard];

  // Remove from equipped and add back to inventory
  delete user.equipped[normCard];
  user.inventory = user.inventory || [];
  user.inventory.push(equippedItem);

  await user.save();

  const embed = new EmbedBuilder()
    .setTitle('Item Unequipped')
    .setDescription(`Unequipped **${equippedItem}** from **${userCard.name}**`)
    .setColor(0x2b2d31)
    .setFooter({ text: 'Item returned to inventory' });

  return message.reply({ embeds: [embed] });
}

module.exports = { data, execute };