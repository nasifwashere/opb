const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');

const leaderboardTypes = {
    beli: { name: 'Richest Pirates', field: 'beli', emoji: '💰' },
    wins: { name: 'Battle Champions', field: 'wins', emoji: '⚔️' },
    xp: { name: 'Most Experienced', field: 'xp', emoji: '✨' },
    cards: { name: 'Biggest Collections', field: 'cardCount', emoji: '🃏' },
    level: { name: 'Highest Level Cards', field: 'maxLevel', emoji: '⭐' }
};

async function getLeaderboardData(type, page = 0, limit = 10) {
    const skip = page * limit;
    let aggregation = [];

    if (type === 'cards') {
        // Count total cards per user
        aggregation = [
            { $addFields: { cardCount: { $size: { $ifNull: ['$cards', []] } } } },
            { $sort: { cardCount: -1 } },
            { $skip: skip },
            { $limit: limit }
        ];
    } else if (type === 'level') {
        // Find user with highest level card
        aggregation = [
            { $addFields: {
                maxLevel: {
                    $max: {
                        $map: {
                            input: { $ifNull: ['$cards', []] },
                            as: 'card',
                            in: { $ifNull: ['$$card.level', 1] }
                        }
                    }
                }
            }},
            { $sort: { maxLevel: -1 } },
            { $skip: skip },
            { $limit: limit }
        ];
    } else {
        // Standard numeric field sorting
        const sortField = leaderboardTypes[type].field;
        aggregation = [
            { $sort: { [sortField]: -1 } },
            { $skip: skip },
            { $limit: limit }
        ];
    }

    return await User.aggregate(aggregation);
}

function formatLeaderboardValue(type, user) {
    switch (type) {
        case 'beli':
            return `${user.beli || 0} Beli`;
        case 'wins':
            return `${user.wins || 0} wins`;
        case 'xp':
            return `${user.xp || 0} XP`;
        case 'cards':
            return `${user.cardCount || 0} cards`;
        case 'level':
            return `Level ${user.maxLevel || 1}`;
        default:
            return 'N/A';
    }
}

async function createLeaderboardEmbed(type, users, page, client) {
    const typeData = leaderboardTypes[type];
    const embed = new EmbedBuilder()
        .setTitle(`${typeData.emoji} ${typeData.name}`)
        .setDescription(`Top players ranked by ${typeData.name.toLowerCase()}`)
        .setColor(0xf39c12)
        .setFooter({ text: `Page ${page + 1} • Use buttons to navigate` });

    if (users.length === 0) {
        embed.addFields({ name: 'No Data', value: 'No users found for this category.', inline: false });
        return embed;
    }

    let description = '';
    
    // Process users in parallel to improve performance
    const userPromises = users.map(async (user, index) => {
        const rank = (page * 10) + index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        
        // Try to fetch user from cache first, then from API
        let discordUser;
        try {
            discordUser = client.users.cache.get(user.userId);
            if (!discordUser) {
                // Attempt to fetch from Discord API
                discordUser = await client.users.fetch(user.userId).catch(() => null);
            }
        } catch (error) {
            console.error(`Error fetching user ${user.userId}:`, error);
            discordUser = null;
        }
        
        const username = discordUser ? discordUser.username : user.username || `Player ${user.userId.slice(-4)}`;
        const value = formatLeaderboardValue(type, user);
        
        return `${medal} **${username}** - ${value}`;
    });
    
    const userStrings = await Promise.all(userPromises);
    description = userStrings.join('\n');

    embed.setDescription(description);
    return embed;
}

function createLeaderboardButtons(currentType, page, hasNext) {
    const typeButtons = Object.keys(leaderboardTypes).map(type =>
        new ButtonBuilder()
            .setCustomId(`lb_${type}`)
            .setLabel(leaderboardTypes[type].emoji)
            .setStyle(type === currentType ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    const navButtons = [
        new ButtonBuilder()
            .setCustomId('lb_prev')
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId('lb_next')
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!hasNext)
    ];

    return [
        new ActionRowBuilder().addComponents(typeButtons),
        new ActionRowBuilder().addComponents(navButtons)
    ];
}

const data = { name: 'leaderboard', description: 'View top players in various categories.' };

async function execute(message, args, client) {
    const userId = message.author.id;
    const username = message.author.username;
    let user = await User.findOne({ userId });

    // Ensure user exists and has username set
    if (user && !user.username) {
        user.username = username;
        await user.save();
    }
    let currentType = 'beli';
    let currentPage = 0;

    // Check if user specified a type
    const typeArg = args[0]?.toLowerCase();
    if (typeArg && leaderboardTypes[typeArg]) {
        currentType = typeArg;
    }

    // Load initial data
    let users = await getLeaderboardData(currentType, currentPage);
    let hasNext = users.length === 10;

    const embed = await createLeaderboardEmbed(currentType, users, currentPage, client);
    const components = createLeaderboardButtons(currentType, currentPage, hasNext);

    const leaderboardMessage = await message.reply({ embeds: [embed], components });

    // Button interaction collector
    const filter = i => i.user.id === message.author.id;
    const collector = leaderboardMessage.createMessageComponentCollector({ filter, time: 300000 });

    collector.on('collect', async interaction => {
        await interaction.deferUpdate();

        if (interaction.customId.startsWith('lb_')) {
            const action = interaction.customId.split('_')[1];

            if (action === 'prev' && currentPage > 0) {
                currentPage--;
            } else if (action === 'next' && hasNext) {
                currentPage++;
            } else if (leaderboardTypes[action]) {
                currentType = action;
                currentPage = 0; // Reset page when changing type
            }

            // Reload data
            users = await getLeaderboardData(currentType, currentPage);
            hasNext = users.length === 10;

            const newEmbed = await createLeaderboardEmbed(currentType, users, currentPage, client);
            const newComponents = createLeaderboardButtons(currentType, currentPage, hasNext);

            await leaderboardMessage.edit({ embeds: [newEmbed], components: newComponents });
        }
    });

    collector.on('end', () => {
        leaderboardMessage.edit({ components: [] }).catch(() => {});
    });
}

module.exports = { data, execute };
