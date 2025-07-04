const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');

// Load shop data for equipment info
const shopPath = path.resolve('data', 'shop.json');
const shopData = JSON.parse(fs.readFileSync(shopPath, 'utf8'));

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

// Legacy item mappings for old items that users might still have
const legacyItemMappings = {
  'marinesword': 'Marine Saber',
  'townmap': 'Rusty Cutlass',
  'battlebanner': 'Marine Coat',
  'powergloves': 'Leather Vest',
  'defensearmor': 'Marine Coat',
  'luckycharm': 'Rusty Cutlass'
};

// Find equipment item in shop data
function findShopItem(itemName) {
  const normalizedTarget = normalize(itemName);
  
  // Check for legacy item mapping first
  const mappedItem = legacyItemMappings[normalizedTarget];
  if (mappedItem) {
    const allItems = [...shopData.items, ...(shopData.devilFruits || [])];
    return allItems.find(item => normalize(item.name) === normalize(mappedItem));
  }
  
  // Then check normal items
  const allItems = [...shopData.items, ...(shopData.devilFruits || [])];
  return allItems.find(item => normalize(item.name) === normalizedTarget);
}

const data = new SlashCommandBuilder()
  .setName('equip')
  .setDescription('Equip items to your cards for stat bonuses');

// Usage: op equip <item> <card>
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

    if (args.length < 2) {
        // Show equipped items
        if (!user.equipped || Object.keys(user.equipped).length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('Equipment Status')
                .setDescription('No items are currently equipped.\n\nUse `op equip <item> <card>` to equip items.')
                .setColor(0x2b2d31)
                .setFooter({ text: 'Equipment boosts your cards in battle' });
            
            return message.reply({ embeds: [embed] });
        }

            // Show all equipped items
    let equipmentText = '';
    for (const [cardName, itemName] of Object.entries(user.equipped)) {
      const item = findShopItem(itemName);
      const statBoosts = item?.statBoost || {};
      const boostText = Object.entries(statBoosts)
        .map(([stat, boost]) => `${stat}: +${boost}%`)
        .join(', ');
      
      equipmentText += `**${cardName}**: ${itemName}${boostText ? ` (${boostText})` : ''}\n`;
    }

        const embed = new EmbedBuilder()
            .setTitle('Equipment Status')
            .setDescription(equipmentText || 'No items are currently equipped.')
            .setColor(0x2b2d31)
            .setFooter({ text: 'Use op equip <item> <card> to equip items' });
        
        return message.reply({ embeds: [embed] });
    }

    const itemName = args[0];
    const cardName = args.slice(1).join(' ');

    // Check if user owns the item - try fuzzy matching
    const normalizedItemName = normalize(itemName);
    let hasItem = user.inventory?.includes(normalizedItemName);
    let actualItemName = normalizedItemName;
    
    // If exact match not found, try fuzzy matching
    if (!hasItem && user.inventory) {
        const fuzzyMatch = user.inventory.find(invItem => {
            const normInvItem = normalize(invItem);
            return normInvItem.includes(normalizedItemName) || normalizedItemName.includes(normInvItem);
        });
        if (fuzzyMatch) {
            hasItem = true;
            actualItemName = fuzzyMatch;
        }
    }

    if (!hasItem) {
        return message.reply(`You don't own **${itemName}**. Try using partial names like "potion" or "saber"!`);
    }

    // Check if item is equipment (including legacy items)
    const item = findShopItem(itemName);
    
    // List of legacy equipment items that should be considered valid
    const legacyEquipment = ['marinesword', 'townmap', 'battlebanner', 'powergloves', 'defensearmor', 'luckycharm'];
    
    if (!item && !legacyEquipment.includes(normalizedItemName)) {
        return message.reply(`**${itemName}** is not an equipment item that can be equipped.`);
    }
    
    if (item && item.type !== 'equipment') {
        return message.reply(`**${itemName}** is not an equipment item that can be equipped.`);
    }

    // Find the card
    const card = fuzzyFindCard(user.cards || [], cardName);
    if (!card) {
        return message.reply(`You don't own a card named **${cardName}**.`);
    }

    // Initialize equipped object if needed
    if (!user.equipped) user.equipped = {};

    // Check if card already has something equipped
    const currentEquipped = user.equipped[card.name];
    if (currentEquipped) {
        // Return the currently equipped item to inventory
        user.inventory.push(normalize(currentEquipped));
    }

    // Remove item from inventory
    const itemIndex = user.inventory.indexOf(actualItemName);
    user.inventory.splice(itemIndex, 1);

    // Equip the new item (use mapped name if it's a legacy item)
    const equipItemName = item ? item.name : (legacyItemMappings[normalizedItemName] || itemName);
    user.equipped[card.name] = equipItemName;

    // Mark as modified and save
    user.markModified('equipped');
    await user.save();

    // Build stat boost description
    const statBoosts = item.statBoost || {};
    const boostText = Object.entries(statBoosts)
        .map(([stat, boost]) => `**${stat.charAt(0).toUpperCase() + stat.slice(1)}**: +${boost}%`)
        .join('\n');

    const embed = new EmbedBuilder()
        .setTitle('Equipment Changed')
        .setDescription(`Equipped **${equipItemName}** to **${card.name}**!`)
        .addFields({ 
            name: 'Stat Bonuses', 
            value: boostText || 'No stat bonuses', 
            inline: false 
        })
        .setColor(0x2b2d31)
        .setFooter({ text: 'Bonuses are applied in battles' });

    if (currentEquipped) {
        embed.addFields({ 
            name: 'Previous Equipment', 
            value: `**${currentEquipped}** was returned to your inventory`, 
            inline: false 
        });
    }

    return message.reply({ embeds: [embed] });
}

module.exports = { data, execute };
