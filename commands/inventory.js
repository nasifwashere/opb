
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');

// Item descriptions and categories
const itemData = {
    'strawhat': { category: 'Treasures', description: 'Shanks\' precious straw hat, a symbol of dreams' },
    'marinesword': { category: 'Weapons', description: 'A standard Marine-issued sword' },
    'townmap': { category: 'Tools', description: 'A detailed map of the local area' },
    'battlebanner': { category: 'Treasures', description: 'A rallying banner from an epic battle' },
    'healthpotion': { category: 'Consumables', description: 'Restores 50 HP to a crew member' },
    'strengthpotion': { category: 'Consumables', description: 'Temporarily boosts attack power' },
    'speedboostfood': { category: 'Consumables', description: 'Enhances speed for a short time' },
    'defensepotion': { category: 'Consumables', description: 'Increases defensive capabilities' },
    'treasurechest': { category: 'Containers', description: 'A mysterious chest that may contain rewards' },
    'goldcoin': { category: 'Currency', description: 'A valuable gold coin' },
    'silvercoin': { category: 'Currency', description: 'A standard silver coin' }
};

function normalizeItemName(item) {
    return item.replace(/\s+/g, '').toLowerCase();
}

function getItemInfo(itemName) {
    const normalized = normalizeItemName(itemName);
    return itemData[normalized] || { 
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
        return message.reply('Start your journey with `op start` first!');
    }

    if (!user.inventory || user.inventory.length === 0) {
        const embed = new EmbedBuilder()
            .setColor(0x2C2F33)
            .setDescription([
                '**Your Inventory**',
                '',
                '*No items yet*',
                '',
                'Explore the world to find treasures and useful items!'
            ].join('\n'))
            .setFooter({ text: 'Inventory Management' });

        return message.reply({ embeds: [embed] });
    }

    const groupedItems = groupItemsByCategory(user.inventory);
    const categories = Object.keys(groupedItems);
    let currentCategory = 0;

    async function generateInventoryEmbed(categoryIndex) {
        const embed = new EmbedBuilder()
            .setColor(0x2C2F33)
            .setDescription(`**${user.username || message.author.username}'s Inventory**`);

        if (categories.length === 0) {
            embed.addFields({
                name: ' ',
                value: '*No items found*',
                inline: false
            });
            return embed;
        }

        const categoryName = categories[categoryIndex];
        const items = groupedItems[categoryName];

        let itemText = '';
        Object.values(items).forEach(item => {
            const displayName = item.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            itemText += `**${displayName}** ×${item.count}\n*${item.description}*\n\n`;
        });

        embed.addFields({
            name: `${getCategoryIcon(categoryName)} ${categoryName}`,
            value: itemText || '*No items in this category*',
            inline: false
        });

        // Add summary
        const totalItems = user.inventory.length;
        const uniqueItems = Object.values(groupedItems).reduce((acc, category) => 
            acc + Object.keys(category).length, 0);

        embed.addFields({
            name: '📊 Summary',
            value: `**Total Items:** ${totalItems} • **Unique Items:** ${uniqueItems}`,
            inline: false
        });

        embed.setFooter({ 
            text: `Category ${categoryIndex + 1}/${categories.length} • Use items with "op use <item>"` 
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
                    .setLabel('⏮️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentCategory === 0),
                new ButtonBuilder()
                    .setCustomId('inv_prev')
                    .setLabel('◀️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentCategory === 0),
                new ButtonBuilder()
                    .setCustomId('inv_next')
                    .setLabel('▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentCategory === categories.length - 1),
                new ButtonBuilder()
                    .setCustomId('inv_last')
                    .setLabel('⏭️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentCategory === categories.length - 1)
            );
        components.push(navigationRow);
    }

    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('inv_consumables')
                .setLabel('Quick Use')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!groupedItems.Consumables),
            new ButtonBuilder()
                .setCustomId('inv_search')
                .setLabel('Search Items')
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
            case 'inv_consumables':
                await showConsumables(interaction, user);
                return;
            case 'inv_search':
                await showSearchHelp(interaction);
                return;
        }

        const newEmbed = await generateInventoryEmbed(currentCategory);
        const newComponents = [];

        if (categories.length > 1) {
            const navigationRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('inv_first')
                        .setLabel('⏮️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentCategory === 0),
                    new ButtonBuilder()
                        .setCustomId('inv_prev')
                        .setLabel('◀️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentCategory === 0),
                    new ButtonBuilder()
                        .setCustomId('inv_next')
                        .setLabel('▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentCategory === categories.length - 1),
                    new ButtonBuilder()
                        .setCustomId('inv_last')
                        .setLabel('⏭️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentCategory === categories.length - 1)
                );
            newComponents.push(navigationRow);
        }

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('inv_consumables')
                    .setLabel('Quick Use')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(!groupedItems.Consumables),
                new ButtonBuilder()
                    .setCustomId('inv_search')
                    .setLabel('Search Items')
                    .setStyle(ButtonStyle.Secondary)
            );
        newComponents.push(actionRow);

        await interaction.editReply({ embeds: [newEmbed], components: newComponents });
    });

    collector.on('end', () => {
        inventoryMessage.edit({ components: [] }).catch(() => {});
    });
}

async function showConsumables(interaction, user) {
    const consumables = user.inventory.filter(item => {
        const info = getItemInfo(item);
        return info.category === 'Consumables';
    });

    const embed = new EmbedBuilder()
        .setColor(0x2C2F33)
        .setDescription('**Usable Items**');

    if (consumables.length === 0) {
        embed.addFields({
            name: ' ',
            value: '*No consumable items*\n\nFind potions and food during your adventures!',
            inline: false
        });
    } else {
        const grouped = {};
        consumables.forEach(item => {
            const normalized = normalizeItemName(item);
            if (!grouped[normalized]) {
                grouped[normalized] = { name: item, count: 0 };
            }
            grouped[normalized].count++;
        });

        let consumableText = '';
        Object.values(grouped).forEach(item => {
            const info = getItemInfo(item.name);
            const displayName = item.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            consumableText += `**${displayName}** ×${item.count}\n*${info.description}*\n\n`;
        });

        embed.addFields({
            name: ' ',
            value: consumableText,
            inline: false
        });
    }

    embed.setFooter({ text: 'Use items with "op use <item name>"' });

    await interaction.followUp({ embeds: [embed], ephemeral: true });
}

async function showSearchHelp(interaction) {
    const embed = new EmbedBuilder()
        .setColor(0x2C2F33)
        .setDescription([
            '**Item Search Help**',
            '',
            '**Commands:**',
            '• `op use <item>` - Use a consumable item',
            '• `op info <item>` - Get detailed item information',
            '',
            '**Tips:**',
            '• Item names are case-insensitive',
            '• You can use partial names',
            '• Check different categories for organization'
        ].join('\n'))
        .setFooter({ text: 'Inventory Help' });

    await interaction.followUp({ embeds: [embed], ephemeral: true });
}

function getCategoryIcon(category) {
    const icons = {
        'Treasures': '💎',
        'Weapons': '⚔️',
        'Tools': '🔧',
        'Consumables': '🧪',
        'Containers': '📦',
        'Currency': '💰',
        'Miscellaneous': '📋'
    };
    return icons[category] || '📋';
}

module.exports = { data, execute };
