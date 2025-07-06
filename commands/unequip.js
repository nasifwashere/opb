const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

// Normalize string for consistent comparison
function normalize(str) {
    return String(str || '').replace(/\s+/g, '').toLowerCase();
}

// Fuzzy find card
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
  .setDescription('Remove equipped items from your cards');

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
        return message.reply('Please specify a card to unequip from. Usage: `op unequip <card name>`');
    }

    const cardName = args.join(' ');

    // Find the card
    const userCard = fuzzyFindCard(user.cards || [], cardName);
    if (!userCard) {
        return message.reply(`You don't own a card named **${cardName}**.`);
    }

    const normCard = userCard.name;

    // Check if card has equipment
    if (!user.equipped || !user.equipped[normCard]) {
        const embed = new EmbedBuilder()
            .setTitle('No Equipment')
            .setDescription(`**${userCard.name}** has no items equipped.`)
            .setColor(0x2b2d31)
            .setFooter({ text: 'This card has no items equipped' });
        
        return message.reply({ embeds: [embed] });
    }

    const equippedItem = user.equipped[normCard];

    // Remove from equipped and add back to inventory (array-based)
    delete user.equipped[normCard];
    if (!user.inventory || !Array.isArray(user.inventory)) user.inventory = [];
    user.inventory.push(equippedItem);

    // Mark as modified and save
    user.markModified('equipped');
    await user.save();

    const embed = new EmbedBuilder()
        .setTitle('Item Unequipped')
        .setDescription(`Unequipped **${equippedItem}** from **${userCard.name}**`)
        .addFields({ 
            name: 'Item Returned', 
            value: `**${equippedItem}** was returned to your inventory`, 
            inline: false 
        })
        .setColor(0x2b2d31)
        .setFooter({ text: 'Use op equip to equip items again' });

    return message.reply({ embeds: [embed] });
}

module.exports = { data, execute };