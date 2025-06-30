const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle  } = require('discord.js');
const User = require('../db/models/User.js');
const MarketListing = require('../db/models/Market.js');
const fs = require('fs');
const path = require('path');

const configPath = path.resolve('config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const MARKET_TAX = config.marketTax || 0.05;
const MAX_LISTINGS_PER_USER = 5;

function normalize(str) {
    return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function createMarketEmbed(listings, page, totalPages, type = 'all') {
    const embed = new EmbedBuilder()
        .setTitle('Marketplace')
        .setDescription(`Showing: ${type === 'all' ? 'All Items' : type.charAt(0).toUpperCase() + type.slice(1)}`)
        .setColor(0x2f3136)
        .setFooter({ text: `Page ${page + 1}/${totalPages || 1} • Use 'op market buy <number>' to purchase` });

    if (listings.length === 0) {
        embed.addFields({ name: 'No Listings', value: 'No items are currently for sale in this category.', inline: false });
        return embed;
    }

    let marketDisplay = '';
    listings.forEach((listing, index) => {
        const itemDisplay = listing.type === 'card'
            ? `[${listing.itemRank}] ${listing.itemName}${listing.itemLevel ? ` (Lv.${listing.itemLevel})` : ''}`
            : listing.itemName;

        const timeLeft = Math.max(0, Math.floor((listing.expiresAt - Date.now()) / (1000 * 60 * 60)));
        const pageOffset = page * 6; // 6 items per page
        const itemNumber = pageOffset + index + 1;

        marketDisplay += `**${itemNumber}.** ${itemDisplay}\n`;
        marketDisplay += `\`\`\`${listing.price} Beli • ${listing.sellerName} • ${timeLeft}h left\`\`\``;
        
        if (listing.description) {
            marketDisplay += `*${listing.description}*\n`;
        }
        marketDisplay += '\n';
    });

    embed.setDescription(`${embed.data.description}\n\n${marketDisplay}`);

    return embed;
}

function createMarketButtons(page, totalPages, hasMyListings = false) {
    const navButtons = [
        new ButtonBuilder()
            .setCustomId('market_prev')
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId('market_next')
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1)
    ];

    const filterButtons = [
        new ButtonBuilder()
            .setCustomId('market_all')
            .setLabel('All')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('market_cards')
            .setLabel('Cards')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('market_items')
            .setLabel('Items')
            .setStyle(ButtonStyle.Secondary)
    ];

    const actionButtons = [
        new ButtonBuilder()
            .setCustomId('market_buy')
            .setLabel('📋 How to Buy')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('market_list')
            .setLabel('📦 List Item')
            .setStyle(ButtonStyle.Primary)
    ];

    if (hasMyListings) {
        actionButtons.push(
            new ButtonBuilder()
                .setCustomId('market_mylistings')
                .setLabel('My Listings')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    return [
        new ActionRowBuilder().addComponents(filterButtons),
        new ActionRowBuilder().addComponents(actionButtons),
        new ActionRowBuilder().addComponents(navButtons)
    ];
}

async function getMarketListings(type = 'all', page = 0, limit = 6) {
    const skip = page * limit;
    let filter = { active: true, expiresAt: { $gt: new Date() } };

    if (type !== 'all') {
        filter.type = type === 'cards' ? 'card' : 'item';
    }

    const listings = await MarketListing.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const totalCount = await MarketListing.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limit);

    return { listings, totalPages };
}

const data = new SlashCommandBuilder()
  .setName('market')
  .setDescription('Browse the player marketplace to buy and sell items.');

async function execute(message, args) {
    const userId = message.author.id;
    const username = message.author.username;
    let user = await User.findOne({ userId });

    if (!user) return message.reply('Start your journey with `op start` first!');

    // Ensure username is set if missing
    if (!user.username) {
        user.username = username;
        await user.save();
    }

    // Handle subcommands first to avoid recursive market display
    if (args.length > 0) {
        const subcommand = args[0].toLowerCase();

        if (subcommand === 'buy') {
            return await handleMarketBuy(message, user, args.slice(1));
        } else if (subcommand === 'list') {
            return await handleMarketList(message, user, args.slice(1));
        } else if (subcommand === 'unlist') {
            return await handleMarketUnlist(message, user, args.slice(1));
        }
    }

    // If no subcommand, show market interface
    let currentPage = 0;
    let currentType = 'all';

    // Load initial market data
    let { listings, totalPages } = await getMarketListings(currentType, currentPage);

    // Check if user has any listings
    const userListings = await MarketListing.find({ sellerId: userId, active: true });
    const hasMyListings = userListings.length > 0;

    const embed = createMarketEmbed(listings, currentPage, totalPages, currentType);
    const components = createMarketButtons(currentPage, totalPages, hasMyListings);

    const marketMessage = await message.reply({ embeds: [embed], components });

    // Button interaction collector
    const filter = i => i.user.id === userId;
    const collector = marketMessage.createMessageComponentCollector({ filter, time: 300000 });

    collector.on('collect', async interaction => {
        await interaction.deferUpdate();

        if (interaction.customId === 'market_prev' && currentPage > 0) {
            currentPage--;
        } else if (interaction.customId === 'market_next' && currentPage < totalPages - 1) {
            currentPage++;
        } else if (interaction.customId.startsWith('market_') && ['all', 'cards', 'items'].includes(interaction.customId.split('_')[1])) {
            currentType = interaction.customId.split('_')[1];
            currentPage = 0;
        } else if (interaction.customId === 'market_buy') {
            await interaction.followUp({
                content: '**How to Buy Items:**\n\nUse: `op market buy <item number>`\n\nExample: `op market buy 1` buys the first item shown\n\n*Item numbers are shown next to each listing*',
                ephemeral: true
            });
            return;
        } else if (interaction.customId === 'market_list') {
            await interaction.followUp({
                content: 'To list an item for sale, use: `op market list <type> <item name> <price> [description]`\n\nExamples:\n• `op market list card Luffy 1000 Great starter card!`\n• `op market list item strawhat 500`\n\n**To remove a listing:**\n1. Use `op market` and click "My Listings" to see your listing numbers\n2. Use `op market unlist <listing number>` to remove it\n\nExample: `op market unlist 1` removes your first listing',
                ephemeral: true
            });
            return;
        } else if (interaction.customId === 'market_mylistings') {
            const myListings = await MarketListing.find({ sellerId: userId, active: true });
            if (myListings.length === 0) {
                await interaction.followUp({ content: 'You have no active listings.', ephemeral: true });
                return;
            }

            let listingText = '**Your Active Listings:**\n\n';
            myListings.forEach((listing, index) => {
                const timeLeft = Math.max(0, Math.floor((listing.expiresAt - Date.now()) / (1000 * 60 * 60)));
                listingText += `${index + 1}. ${listing.itemName} - ${listing.price} Beli (${timeLeft}h left)\n`;
            });

            await interaction.followUp({ content: listingText, ephemeral: true });
            return;
        }

        // Reload data
        ({ listings, totalPages } = await getMarketListings(currentType, currentPage));
        const newEmbed = createMarketEmbed(listings, currentPage, totalPages, currentType);
        const newComponents = createMarketButtons(currentPage, totalPages, hasMyListings);

        await marketMessage.edit({ embeds: [newEmbed], components: newComponents });
    });

    collector.on('end', () => {
        marketMessage.edit({ components: [] }).catch(() => {});
    });
}

async function handleMarketBuy(message, user, args) {
    // Ensure username is set if missing
    if (!user.username) {
        user.username = message.author.username;
        await user.save();
    }
    const itemNumber = parseInt(args[0]);

    // Get current listings to validate item number
    const { listings } = await getMarketListings('all', 0, 50); // Get more listings for buy command

    if (!itemNumber || itemNumber < 1 || itemNumber > listings.length) {
        return message.reply('Invalid item number. Use the number shown in the market listing.');
    }

    const listing = listings[itemNumber - 1];

    if (listing.sellerId === user.userId) {
        return message.reply('You cannot buy your own listing!');
    }

    if (user.beli < listing.price) {
        return message.reply(`You don't have enough Beli! You need ${listing.price} but only have ${user.beli}.`);
    }

    // Process purchase
    const seller = await User.findOne({ userId: listing.sellerId });
    if (!seller) {
        return message.reply('Seller not found. This listing may be invalid.');
    }

    const tax = Math.floor(listing.price * MARKET_TAX);
    const sellerAmount = listing.price - tax;

    // Transfer funds
    user.beli -= listing.price;
    seller.beli += sellerAmount;

    // Transfer item
    if (listing.type === 'card') {
        if (!user.cards) user.cards = [];
        user.cards.push({
            name: listing.itemName,
            rank: listing.itemRank,
            level: listing.itemLevel || 1,
            timesUpgraded: 0
        });
    } else {
        if (!user.inventory) user.inventory = [];
        user.inventory.push(normalize(listing.itemName));
    }

    // Remove listing
    await MarketListing.findByIdAndUpdate(listing._id, { active: false });
    await user.save();
    await seller.save();

    return message.reply(`Successfully purchased **${listing.itemName}** for ${listing.price} Beli!`);
}

async function handleMarketList(message, user, args) {
    // Ensure username is set if missing
    if (!user.username) {
        user.username = message.author.username;
        await user.save();
    }
    const [type, ...itemParts] = args;

    if (!type || !['card', 'item'].includes(type)) {
        return message.reply('Usage: `op market list <card/item> <name> <price> [description]`');
    }

    // Parse arguments
    const priceIndex = itemParts.findIndex(part => !isNaN(parseInt(part)));
    if (priceIndex === -1) {
        return message.reply('Please specify a valid price.');
    }

    const itemName = itemParts.slice(0, priceIndex).join(' ').trim();
    const price = parseInt(itemParts[priceIndex]);
    const description = itemParts.slice(priceIndex + 1).join(' ').trim();

    if (!itemName || price < 1) {
        return message.reply('Invalid item name or price.');
    }

    // Check user's active listings
    const activeListings = await MarketListing.countDocuments({ sellerId: user.userId, active: true });
    if (activeListings >= MAX_LISTINGS_PER_USER) {
        return message.reply(`You can only have ${MAX_LISTINGS_PER_USER} active listings at a time.`);
    }

    // Check if user owns the item
    let hasItem = false;
    let itemRank = null;
    let itemLevel = null;

    if (type === 'card') {
        const userCard = user.cards?.find(c => normalize(c.name) === normalize(itemName));
        if (userCard) {
            hasItem = true;
            itemRank = userCard.rank;
            itemLevel = userCard.level || 1;
            // Remove from user's collection
            const cardIndex = user.cards.findIndex(c => normalize(c.name) === normalize(itemName));
            user.cards.splice(cardIndex, 1);
        }
    } else {
        const itemIndex = user.inventory?.findIndex(i => normalize(i) === normalize(itemName));
        if (itemIndex !== -1) {
            hasItem = true;
            user.inventory.splice(itemIndex, 1);
        }
    }

    if (!hasItem) {
        return message.reply(`You don't own "${itemName}".`);
    }

    // Create listing
    const listing = new MarketListing({
        sellerId: user.userId,
        sellerName: message.author.username,
        type: type,
        itemName: itemName,
        itemRank: itemRank,
        itemLevel: itemLevel,
        price: price,
        description: description || undefined
    });

    await listing.save();
    await user.save();

    // Announce the listing in the configured channel
    try {
        const configPath = path.resolve('config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        if (config.marketChannelId) {
            const marketChannel = message.client.channels.cache.get(config.marketChannelId);
            if (marketChannel) {
                // Get the current market position for this item
                const { listings } = await getMarketListings('all', 0, 50);
                const itemPosition = listings.findIndex(listing => 
                    listing.sellerId === user.userId && 
                    listing.itemName === itemName && 
                    listing.price === price
                ) + 1;

                const marketEmbed = new EmbedBuilder()
                    .setTitle('New Market Listing')
                    .setDescription(`${itemRank ? `**[${itemRank}]** ` : ''}**${itemName}**${itemLevel ? ` (Lv.${itemLevel})` : ''}\n\n\`\`\`${price} Beli\`\`\``)
                    .addFields(
                        { name: 'Seller', value: message.author.username, inline: true },
                        { name: 'Item Number', value: `${itemPosition > 0 ? itemPosition : 'TBD'}`, inline: true }
                    )
                    .setColor(0x2f3136)
                    .setFooter({ text: `Use 'op market buy ${itemPosition > 0 ? itemPosition : '<number>'}' to purchase` });

                if (description) {
                    marketEmbed.addFields({ name: 'Description', value: description, inline: false });
                }

                await marketChannel.send({ embeds: [marketEmbed] });
            }
        }
    } catch (error) {
        console.error('Error announcing market listing:', error);
    }

    return message.reply(`Listed **${itemName}** for ${price} Beli! It will expire in 7 days.`);
}

module.exports = { data, execute };


async function handleMarketUnlist(message, user, args) {
    // Ensure username is set if missing
    if (!user.username) {
        user.username = message.author.username;
        await user.save();
    }

    const listingNumber = parseInt(args[0]);

    if (!listingNumber || listingNumber < 1) {
        return message.reply('Usage: `op market unlist <listing number>`\n\nUse `op market` and check "My Listings" to see your listing numbers.');
    }

    // Get user's active listings
    const userListings = await MarketListing.find({ 
        sellerId: user.userId, 
        active: true,
        expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (userListings.length === 0) {
        return message.reply('You have no active listings to remove.');
    }

    if (listingNumber > userListings.length) {
        return message.reply(`Invalid listing number. You only have ${userListings.length} active listings.`);
    }

    const listing = userListings[listingNumber - 1];

    // Return item to user
    if (listing.type === 'card') {
        if (!user.cards) user.cards = [];
        user.cards.push({
            name: listing.itemName,
            rank: listing.itemRank,
            level: listing.itemLevel || 1,
            timesUpgraded: 0,
            locked: false
        });
    } else {
        if (!user.inventory) user.inventory = [];
        user.inventory.push(normalize(listing.itemName));
    }

    // Remove listing
    await MarketListing.findByIdAndUpdate(listing._id, { active: false });
    await user.save();

    return message.reply(`Successfully removed listing for **${listing.itemName}** and returned it to your ${listing.type === 'card' ? 'collection' : 'inventory'}.`);
}