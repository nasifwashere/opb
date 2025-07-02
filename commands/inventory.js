const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');

// Load shop data for item info
const shopPath = path.resolve('data', 'shop.json');
const shopData = JSON.parse(fs.readFileSync(shopPath, 'utf8'));

// Item descriptions and categories for new system
const itemData = {
    'basicpotion': { category: 'Potions', description: 'Restores 10% HP to a card during battle' },
    'normalpotion': { category: 'Potions', description: 'Restores 20% HP to a card during battle' },
    'maxpotion': { category: 'Potions', description: 'Restores 30% HP to a card during battle' },
    'rustycutlass': { category: 'Weapons', description: 'A worn but functional sword (+5% power/speed)' },
    'marinesaber': { category: 'Weapons', description: 'Standard Marine sword (+10% power, +8% speed)' },
    'flintlockpistol': { category: 'Weapons', description: 'Basic firearm (+8% power, +12% speed)' },
    'marinerifle': { category: 'Weapons', description: 'Military rifle (+12% power, +10% speed)' },
    'leathervest': { category: 'Armor', description: 'Basic protection (+5% health)' },
    'marinecoat': { category: 'Armor', description: 'Marine officer coat (+10% health)' },
    'wadoichimonji': { category: 'Legendary Weapons', description: "Zoro's legendary katana (+20% power, +18% speed)" },
    'climatact': { category: 'Legendary Weapons', description: "Nami's weather weapon (+18% power, +20% speed)" },
    'piratekingscoat': { category: 'Legendary Armor', description: 'Legendary armor (+20% health)' },
    'gomugomunoMi': { category: 'Devil Fruits', description: 'Rubber paramecia (+15% all stats)' },
    'merameranoMi': { category: 'Devil Fruits', description: 'Fire logia (+25% power/speed, +20% health)' },
    'hiehienoMi': { category: 'Devil Fruits', description: 'Ice logia (+25% power/speed, +20% health)' },
    'yamiyaminoMi': { category: 'Devil Fruits', description: 'Darkness logia (+30% power/speed, +25% health)' }
};

function normalizeItemName(item) {
    return item.replace(/\s+/g, '').toLowerCase();
}

function getItemInfo(itemName) {
    const normalized = normalizeItemName(itemName);
    
    // Check our predefined items first
    if (itemData[normalized]) {
        return itemData[normalized];
    }
    
    // Try to find in shop data
    const allItems = [...shopData.items, ...(shopData.devilFruits || [])];
    const shopItem = allItems.find(item => 
        normalizeItemName(item.name) === normalized
    );
    
    if (shopItem) {
        let category = 'Miscellaneous';
        if (shopItem.type === 'potion') category = 'Potions';
        else if (shopItem.subtype === 'sword' || shopItem.subtype === 'gun') category = 'Weapons';
        else if (shopItem.subtype === 'armor') category = 'Armor';
        else if (shopItem.subtype === 'devil_fruit') category = 'Devil Fruits';
        
        return {
            category: category,
            description: shopItem.description
        };
    }
    
    return { 
        category: 'Miscellaneous', 
        description: 'A mysterious item from your adventures' 
    };
}

function groupItemsByCategory(inventory) {
    const grouped = {};
    
    inventory.forEach(item => {
        const info = getItemInfo(item);
        if (!grouped[info.category]) {
            grouped[info.category] = {};
        }
        
        const normalizedName = normalizeItemName(item);
        if (!grouped[info.category][normalizedName]) {
            grouped[info.category][normalizedName] = {
                name: item,
                count: 0,
                description: info.description
            };
        }
        grouped[info.category][normalizedName].count++;
    });
    
    return grouped;
}

const data = new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View your inventory and items');

async function execute(message, args) {
    const userId = message.author.id;
    let user = await User.findOne({ userId });

    if (!user) {
        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setDescription('Start your journey with `op start` first!')
            .setFooter({ text: 'Use op start to begin your adventure' });
        
        return message.reply({ embeds: [embed] });
    }

    if (!user.inventory || user.inventory.length === 0) {
        const embed = new EmbedBuilder()
            .setTitle('Inventory')
            .setDescription('No items yet.\n\nExplore the world to find treasures and useful items!')
            .setColor(0x2b2d31)
            .setFooter({ text: 'Use op explore to find items' });

        return message.reply({ embeds: [embed] });
    }

    const groupedItems = groupItemsByCategory(user.inventory);
    const categories = Object.keys(groupedItems);
    let currentCategory = 0;

    async function generateInventoryEmbed(categoryIndex) {
        const embed = new EmbedBuilder()
            .setTitle('Inventory')
            .setColor(0x2b2d31);

        if (categories.length === 0) {
            embed.setDescription('No items found');
            return embed;
        }

        const categoryName = categories[categoryIndex];
        const items = groupedItems[categoryName];

        let itemText = '';
        Object.values(items).forEach(item => {
            const displayName = item.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            itemText += `**${displayName}** ×${item.count}\n${item.description}\n\n`;
        });

        embed.addFields({
            name: categoryName,
            value: itemText || 'No items in this category',
            inline: false
        });

        // Add equipment instructions for relevant categories
        if (['Weapons', 'Armor', 'Legendary Weapons', 'Legendary Armor', 'Devil Fruits'].includes(categoryName)) {
            embed.addFields({
                name: '⚔️ Equipment Instructions',
                value: 'Use `op equip <item> <card>` to equip items to your cards for stat bonuses!\nExample: `op equip Rusty Cutlass Luffy`',
                inline: false
            });
        } else if (categoryName === 'Potions') {
            embed.addFields({
                name: '💊 Potion Usage',
                value: 'Potions can be used during battles by clicking the "Items" button!\nThey heal your cards based on their max HP.',
                inline: false
            });
        }

        // Add summary
        const totalItems = user.inventory.length;
        const uniqueItems = Object.values(groupedItems).reduce((acc, category) => 
            acc + Object.keys(category).length, 0);

        embed.addFields({
            name: 'Summary',
            value: `**Total Items** ${totalItems} • **Unique Items** ${uniqueItems}`,
            inline: false
        });

        embed.setFooter({ 
            text: `Category ${categoryIndex + 1}/${categories.length} • Use op equip <item> <card> for equipment` 
        });

        return embed;
    }

    const embed = await generateInventoryEmbed(currentCategory);
    const components = [];

    if (categories.length > 1) {
        const navigationRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('inv_first')
                    .setLabel('First')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentCategory === 0),
                new ButtonBuilder()
                    .setCustomId('inv_prev')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentCategory === 0),
                new ButtonBuilder()
                    .setCustomId('inv_next')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentCategory === categories.length - 1),
                new ButtonBuilder()
                    .setCustomId('inv_last')
                    .setLabel('Last')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentCategory === categories.length - 1)
            );
        components.push(navigationRow);
    }

    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('inv_potions')
                .setLabel('View Potions')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!groupedItems.Potions),
            new ButtonBuilder()
                .setCustomId('inv_equipment')
                .setLabel('Equipment Help')
                .setStyle(ButtonStyle.Secondary)
        );
    components.push(actionRow);

    const inventoryMessage = await message.reply({ embeds: [embed], components });

    const filter = i => i.user.id === userId;
    const collector = inventoryMessage.createMessageComponentCollector({ filter, time: 300000 });

    collector.on('collect', async interaction => {
        await interaction.deferUpdate();

        switch (interaction.customId) {
            case 'inv_first':
                currentCategory = 0;
                break;
            case 'inv_prev':
                currentCategory = Math.max(0, currentCategory - 1);
                break;
            case 'inv_next':
                currentCategory = Math.min(categories.length - 1, currentCategory + 1);
                break;
            case 'inv_last':
                currentCategory = categories.length - 1;
                break;
            case 'inv_potions':
                await showPotions(interaction, user);
                return;
            case 'inv_equipment':
                await showEquipmentHelp(interaction);
                return;
        }

        const newEmbed = await generateInventoryEmbed(currentCategory);
        const newComponents = [];

        if (categories.length > 1) {
            const navigationRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('inv_first')
                        .setLabel('First')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentCategory === 0),
                    new ButtonBuilder()
                        .setCustomId('inv_prev')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentCategory === 0),
                    new ButtonBuilder()
                        .setCustomId('inv_next')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentCategory === categories.length - 1),
                    new ButtonBuilder()
                        .setCustomId('inv_last')
                        .setLabel('Last')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentCategory === categories.length - 1)
                );
            newComponents.push(navigationRow);
        }

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('inv_potions')
                    .setLabel('View Potions')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(!groupedItems.Potions),
                new ButtonBuilder()
                    .setCustomId('inv_equipment')
                    .setLabel('Equipment Help')
                    .setStyle(ButtonStyle.Secondary)
            );
        newComponents.push(actionRow);

        await interaction.editReply({ embeds: [newEmbed], components: newComponents });
    });

    collector.on('end', () => {
        inventoryMessage.edit({ components: [] }).catch(() => {});
    });
}

async function showPotions(interaction, user) {
    const potions = user.inventory.filter(item => {
        const info = getItemInfo(item);
        return info.category === 'Potions';
    });

    const embed = new EmbedBuilder()
        .setTitle('💊 Healing Potions')
        .setColor(0x2b2d31);

    if (potions.length === 0) {
        embed.setDescription('No healing potions\n\nFind potions during your adventures or buy them from the shop!');
    } else {
        const grouped = {};
        potions.forEach(item => {
            const normalized = normalizeItemName(item);
            if (!grouped[normalized]) {
                grouped[normalized] = { name: item, count: 0 };
            }
            grouped[normalized].count++;
        });

        let potionText = '';
        Object.values(grouped).forEach(item => {
            const info = getItemInfo(item.name);
            const displayName = item.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            potionText += `**${displayName}** ×${item.count}\n${info.description}\n\n`;
        });

        embed.setDescription(potionText);
        embed.addFields({
            name: 'How to Use',
            value: 'During battles (explore or duels), click the **Items** button to use potions!\nPotions heal based on percentage of max HP.',
            inline: false
        });
    }

    await interaction.followUp({ embeds: [embed], ephemeral: true });
}

async function showEquipmentHelp(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('⚔️ Equipment System')
        .setDescription([
            '**How to Equip Items:**',
            '• `op equip <item> <card>` - Equip an item to a card',
            '• `op equip` - View all equipped items',
            '',
            '**Equipment Types:**',
            '• **Weapons** (Swords/Guns) - Boost power and speed',
            '• **Armor** - Boosts health',  
            '• **Devil Fruits** - Boost all stats (very rare)',
            '',
            '**Examples:**',
            '• `op equip Rusty Cutlass Luffy`',
            '• `op equip Marine Coat Zoro`',
            '• `op equip Gomu Gomu no Mi Luffy`',
            '',
            '**Tips:**',
            '• Equipment bonuses show in `op mycard` and `op team`',
            '• Bonuses are applied in all battles',
            '• You can only equip one item per card'
        ].join('\n'))
        .setColor(0x2b2d31)
        .setFooter({ text: 'Equipment Help' });

    await interaction.followUp({ embeds: [embed], ephemeral: true });
}

module.exports = { data, execute };
