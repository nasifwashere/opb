const { SlashCommandBuilder } = require('discord.js');
const User = require('../db/models/User.js');

// Normalize string for fuzzy matching
function normalize(str) {
    return String(str || '').replace(/\s+/g, '').toLowerCase();
}

// Fuzzy find in array of strings (inventory items)
function fuzzyFind(arr, target) {
    const normTarget = normalize(target);
    return arr.find(i => normalize(i) === normTarget) || null;
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

// Get equipment stats for calculation
function getEquipmentStats(itemName) {
    const normalizedItem = normalize(itemName);

    // Equipment stat bonuses
    const itemStats = {
        'strawhat': { hp: 10, atk: 5, spd: 5, def: 2 },
        'marinesword': { atk: 15, spd: 5, def: 1 },
        'townmap': { spd: 10, hp: 5 },
        'battlebanner': { hp: 20, atk: 10, def: 3 },
        'speedboostfood': { spd: 25, hp: 5 },
        'defensearmor': { def: 20, hp: 15 },
        'powergloves': { atk: 12, spd: 3 },
        'luckycharm': { hp: 8, atk: 3, spd: 3, def: 2 }
    };

    return itemStats[normalizedItem] || { hp: 0, atk: 0, spd: 0, def: 0 };
}

const data = new SlashCommandBuilder()
  .setName('equip')
  .setDescription('Equip an item to a card to boost its stats.');

// Usage: op equip strawhat luffy
async function execute(message, args, client) {
    const userId = message.author.id;
    const username = message.author.username;
    const [itemName, ...cardParts] = args;
    const cardName = cardParts.join(' ');

    if (!itemName || !cardName) {
        return message.reply({
            embeds: [{
                color: 0x2C2F33,
                title: 'Usage',
                description: '```\nop equip [item] [card]\n```\nExample: `op equip strawhat luffy`',
                footer: { text: 'Equip an item to boost your card’s stats.' }
            }]
        });
    }

    const user = await User.findOne({ userId });
    if (!user) {
        return message.reply({
            embeds: [{
                color: 0x2C2F33,
                description: 'Start your journey with `op start` first.',
            }]
        });
    }

    if (!Array.isArray(user.inventory) || user.inventory.length === 0) {
        return message.reply({
            embeds: [{
                color: 0x2C2F33,
                description: 'Your inventory is empty.',
            }]
        });
    }

    const ownedItem = fuzzyFind(user.inventory, itemName);
    if (!ownedItem) {
        return message.reply({
            embeds: [{
                color: 0x2C2F33,
                description: `You don’t have **${itemName}** in your inventory.`,
            }]
        });
    }

    const cardObj = fuzzyFindCard(user.cards || [], cardName);
    if (!cardObj) {
        return message.reply({
            embeds: [{
                color: 0x2C2F33,
                description: `You don’t have a card named **${cardName}**.`,
            }]
        });
    }

    const normItem = normalize(ownedItem);
    const normCard = normalize(cardObj.name);

    if (normItem === 'strawhat' && !normCard.includes('luffy')) {
        return message.reply({
            embeds: [{
                color: 0x992D22,
                description: 'The Strawhat can only be equipped on Monkey D. Luffy.',
            }]
        });
    }

    if (!user.equipped) user.equipped = {};

    // Unequip old item if needed
    if (user.equipped[normCard]) {
        user.inventory.push(user.equipped[normCard]);
    }

    // Equip new item
    user.equipped[normCard] = ownedItem;

    // Remove item from inventory
    const idx = user.inventory.findIndex(i => normalize(i) === normItem);
    if (idx !== -1) user.inventory.splice(idx, 1);

    const itemStats = getEquipmentStats(ownedItem);
    let statsText = '';

    if (itemStats.hp > 0) statsText += `+${itemStats.hp} HP `;
    if (itemStats.atk > 0) statsText += `+${itemStats.atk} ATK `;
    if (itemStats.spd > 0) statsText += `+${itemStats.spd} SPD `;
    if (itemStats.def > 0) statsText += `+${itemStats.def} DEF `;

    if (statsText === '') statsText = 'No stat bonuses';

    await user.save();

    return message.reply({
        embeds: [{
            color: 0x2C2F33,
            title: `Equipped ${ownedItem} to ${cardObj.name}`,
            description: `**Stat Bonuses:** ${statsText.trim()}`,
            footer: { text: 'Use `op unequip [card]` to remove equipment.' }
        }]
    });
}

module.exports = { data, execute };
