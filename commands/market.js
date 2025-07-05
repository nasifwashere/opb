const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle  } = require('discord.js');
const User = require('../db/models/User.js');
const MarketListing = require('../db/models/Market.js');
const { addCardWithTransformation } = require('../utils/cardTransformationSystem.js');
const fs = require('fs');
const path = require('path');

const configPath = path.resolve('config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const MARKET_TAX = config.marketTax || 0.05;
const MAX_LISTINGS_PER_USER = 5;

function normalize(str) {
    return String(str || '').replace(/\s+/g, '').toLowerCase();
}

// Generate a unique listing ID
function generateListingId() {
    return 'MKT' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function createMarketEmbed(listings, page, totalPages, type = 'all') {
    const embed = new EmbedBuilder()
        .setTitle('Marketplace')
        .setDescription(`Showing: ${type === 'all' ? 'All Items' : type.charAt(0).toUpperCase() + type.slice(1)}`)
        .setColor(0x2f3136)
        .setFooter({ text: `Page ${page + 1}/${totalPages || 1} • Use 'op market buy <listing ID>' to purchase` });

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

        marketDisplay += `**ID: ${listing.listingId}** - ${itemDisplay}\n`;
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
            .setLabel('How to Buy')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('market_list')
            .setLabel('List Item')
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
                content: '**How to Buy Items:**\n\nUse: `op market buy <listing ID>`\n\nExample: `op market buy MKT12345` buys the item with ID MKT12345\n\n*Listing IDs are shown next to each listing*',
                ephemeral: true
            });
            return;
        } else if (interaction.customId === 'market_list') {
            await interaction.followUp({
                content: 'To list an item for sale, use: `op market list <type> <item name> <price> [description]`\n\nExamples:\n• `op market list card Luffy 1000 Great starter card!`\n• `op market list card Garp_worst 500 Selling worst copy`\n• `op market list card Garp_best 2000 Selling best copy`\n• `op market list item Basic Potion 25`\n\n**Card Modifiers:**\n• Add `_worst` to sell your lowest level copy\n• Add `_best` to sell your highest level copy\n\n**To remove a listing:**\n1. Use `op market` and click "My Listings" to see your listing IDs\n2. Use `op market unlist <listing ID>` to remove it\n\nExample: `op market unlist MKT12345` removes your listing with ID MKT12345',
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
                listingText += `**ID: ${listing.listingId}** - ${listing.itemName} - ${listing.price} Beli (${timeLeft}h left)\n`;
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
    
    const listingId = args[0];

    if (!listingId) {
        return message.reply('Please provide a listing ID. Use the ID shown in the market listing.');
    }

    // Find the listing by ID instead of array index
    const listing = await MarketListing.findOne({ 
        listingId: listingId, 
        active: true, 
        expiresAt: { $gt: new Date() } 
    });

    if (!listing) {
        return message.reply('Invalid listing ID or listing has expired/been sold.');
    }

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

    // Transfer item with evolution transformation
    if (listing.type === 'card') {
        const cardToAdd = {
            name: listing.itemName,
            rank: listing.itemRank,
            level: listing.itemLevel || 1,
            experience: 0,
            timesUpgraded: 0,
            locked: false
        };
        addCardWithTransformation(user, cardToAdd);
    } else {
        if (!user.inventory) user.inventory = [];
        user.inventory.push(normalize(listing.itemName));
    }

    // Delete announcement message if it exists
    if (listing.announcementMessageId) {
        try {
            const configPath = path.resolve('config.json');
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            
            if (config.marketChannelId) {
                const marketChannel = message.client.channels.cache.get(config.marketChannelId);
                if (marketChannel) {
                    const announcementMessage = await marketChannel.messages.fetch(listing.announcementMessageId);
                    if (announcementMessage) {
                        await announcementMessage.delete();
                    }
                }
            }
        } catch (error) {
            console.error('Error deleting announcement message:', error);
            // Don't fail the purchase if message deletion fails
        }
    }

    // Remove listing
    await MarketListing.findByIdAndUpdate(listing._id, { active: false });
    
    // Mark modified and save
    user.markModified('cards');
    user.markModified('inventory');
    await user.save();
    await seller.save();

    return message.reply(`Successfully purchased **${listing.itemName}** for ${listing.price} Beli! (Listing ID: ${listingId})`);
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
        // Check for _worst or _best modifiers
        let actualCardName = itemName;
        let selectWorst = false;
        let selectBest = false;
        
        if (itemName.toLowerCase().endsWith('_worst')) {
            actualCardName = itemName.slice(0, -6); // Remove '_worst'
            selectWorst = true;
        } else if (itemName.toLowerCase().endsWith('_best')) {
            actualCardName = itemName.slice(0, -5); // Remove '_best'
            selectBest = true;
        }
        
        // Find all matching cards
        const matchingCards = user.cards?.filter(c => normalize(c.name) === normalize(actualCardName)) || [];
        
        if (matchingCards.length > 0) {
            let selectedCard;
            let selectedIndex;
            
            if (selectWorst) {
                // Find worst card (lowest level, then lowest experience)
                selectedCard = matchingCards.reduce((worst, current, index) => {
                    const currentLevel = current.level || 1;
                    const currentExp = current.experience || 0;
                    const worstLevel = worst.card.level || 1;
                    const worstExp = worst.card.experience || 0;
                    
                    if (currentLevel < worstLevel || (currentLevel === worstLevel && currentExp < worstExp)) {
                        return { card: current, index: user.cards.findIndex(c => c === current) };
                    }
                    return worst;
                }, { card: matchingCards[0], index: user.cards.findIndex(c => c === matchingCards[0]) });
                
                selectedIndex = selectedCard.index;
                selectedCard = selectedCard.card;
            } else if (selectBest) {
                // Find best card (highest level, then highest experience)
                selectedCard = matchingCards.reduce((best, current, index) => {
                    const currentLevel = current.level || 1;
                    const currentExp = current.experience || 0;
                    const bestLevel = best.card.level || 1;
                    const bestExp = best.card.experience || 0;
                    
                    if (currentLevel > bestLevel || (currentLevel === bestLevel && currentExp > bestExp)) {
                        return { card: current, index: user.cards.findIndex(c => c === current) };
                    }
                    return best;
                }, { card: matchingCards[0], index: user.cards.findIndex(c => c === matchingCards[0]) });
                
                selectedIndex = selectedCard.index;
                selectedCard = selectedCard.card;
            } else {
                // Default behavior - first match
                selectedCard = matchingCards[0];
                selectedIndex = user.cards.findIndex(c => normalize(c.name) === normalize(actualCardName));
            }
            
            hasItem = true;
            itemRank = selectedCard.rank;
            itemLevel = selectedCard.level || 1;
            
            // Remove the selected card from user's collection
            user.cards.splice(selectedIndex, 1);
            
            // Update the item name to the actual card name for the listing
            itemName = selectedCard.name;
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

    // Generate unique listing ID
    const listingId = generateListingId();

    // Create listing
    const listing = new MarketListing({
        listingId: listingId,
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
                const marketEmbed = new EmbedBuilder()
                    .setTitle('New Market Listing')
                    .setDescription(`${itemRank ? `**[${itemRank}]** ` : ''}**${itemName}**${itemLevel ? ` (Lv.${itemLevel})` : ''}\n\n\`\`\`${price} Beli\`\`\``)
                    .addFields(
                        { name: 'Seller', value: message.author.username, inline: true },
                        { name: 'Listing ID', value: listingId, inline: true }
                    )
                    .setColor(0x2f3136)
                    .setFooter({ text: `Use 'op market buy ${listingId}' to purchase` });

                if (description) {
                    marketEmbed.addFields({ name: 'Description', value: description, inline: false });
                }

                const announcementMessage = await marketChannel.send({ embeds: [marketEmbed] });
                
                // Store the message ID in the listing for later deletion
                listing.announcementMessageId = announcementMessage.id;
                await listing.save();
            }
        }
    } catch (error) {
        console.error('Error announcing market listing:', error);
    }

    return message.reply(`Listed **${itemName}** for ${price} Beli! Listing ID: **${listingId}** (expires in 7 days)`);
}

module.exports = { data, execute };


async function handleMarketUnlist(message, user, args) {
    // Ensure username is set if missing
    if (!user.username) {
        user.username = message.author.username;
        await user.save();
    }

    const listingId = args[0];

    if (!listingId) {
        return message.reply('Usage: `op market unlist <listing ID>`\n\nUse `op market` and check "My Listings" to see your listing IDs.');
    }

    // Find the specific listing by ID
    const listing = await MarketListing.findOne({ 
        listingId: listingId,
        sellerId: user.userId, 
        active: true,
        expiresAt: { $gt: new Date() }
    });

    if (!listing) {
        return message.reply('Invalid listing ID or you don\'t own this listing. Use `op market` and check "My Listings" to see your listing IDs.');
    }

    // Return item to user with evolution transformation
    if (listing.type === 'card') {
        const cardToAdd = {
            name: listing.itemName,
            rank: listing.itemRank,
            level: listing.itemLevel || 1,
            experience: 0,
            timesUpgraded: 0,
            locked: false
        };
        addCardWithTransformation(user, cardToAdd);
    } else {
        if (!user.inventory) user.inventory = [];
        user.inventory.push(normalize(listing.itemName));
    }

    // Delete announcement message if it exists
    if (listing.announcementMessageId) {
        try {
            const configPath = path.resolve('config.json');
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            
            if (config.marketChannelId) {
                const marketChannel = message.client.channels.cache.get(config.marketChannelId);
                if (marketChannel) {
                    const announcementMessage = await marketChannel.messages.fetch(listing.announcementMessageId);
                    if (announcementMessage) {
                        await announcementMessage.delete();
                    }
                }
            }
        } catch (error) {
            console.error('Error deleting announcement message:', error);
            // Don't fail the unlisting if message deletion fails
        }
    }

    // Remove listing
    await MarketListing.findByIdAndUpdate(listing._id, { active: false });
    
    // Mark modified and save
    user.markModified('cards');
    user.markModified('inventory');
    await user.save();

    return message.reply(`Successfully removed listing for **${listing.itemName}** and returned it to your ${listing.type === 'card' ? 'collection' : 'inventory'}.`);
}