const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle  } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const User = require('../../db/models/User.js');

const OWNER_ID = '1257718161298690119';
const CONFIG_PATH = path.join(__dirname, '../../config.json');
const CARDS_PATH = path.join(__dirname, '../../data/cards.json');

const data = new SlashCommandBuilder()
  .setName('setdrops')
  .setDescription('Set the card drop channel (Owner only)')
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('Channel for card drops')
      .setRequired(false)
  );

// Text command data for legacy support
const textData = {
  name: 'setdrops',
  description: 'Set the card drop channel (Owner only)',
  usage: 'setdrops [#channel]'
};

async function execute(message, args, client) {
    // Handle both slash commands and text commands
    const userId = message.author?.id || message.user?.id;
    const isInteraction = !!message.user;

    if (userId !== OWNER_ID) {
        const response = '❌ This command is restricted to the bot owner.';
        return isInteraction ? message.reply({ content: response, ephemeral: true }) : message.reply(response);
    }

    let channel;

    if (isInteraction) {
        // Slash command
        channel = message.options.getChannel('channel') || message.channel;
    } else {
        // Text command
        channel = message.mentions.channels.first() || message.channel;
    }

    try {
        // Load existing config
        let config = {};
        try {
            const configData = await fs.readFile(CONFIG_PATH, 'utf8');
            config = JSON.parse(configData);
        } catch (error) {
            console.log('Creating new config file');
        }

        // Update config
        config.dropChannelId = channel.id;

        // Save config
        await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));

        const embed = new EmbedBuilder()
            .setTitle('✅ Drop Channel Set')
            .setDescription(`Card drops will now appear in ${channel} every 5 minutes`)
            .setColor(0x00ff00);

        const response = { embeds: [embed] };
        if (isInteraction) {
            await message.reply(response);
        } else {
            await message.reply(response);
        }

        // Start the drop timer if not already running
        if (!client.dropTimer) {
            startDropTimer(client);
        }

    } catch (error) {
        console.error('Error setting drop channel:', error);
        await message.reply('❌ Failed to set drop channel.');
    }
}

function startDropTimer(client) {
    // Clear any existing timer
    if (client.dropTimer) {
        clearInterval(client.dropTimer);
    }

    // Set global next drop time
    global.nextCardDrop = new Date(Date.now() + 5 * 60 * 1000);

    // Start with immediate drop after 10 seconds, then regular intervals
    setTimeout(async () => {
        await dropRandomCard(client);
        global.nextCardDrop = new Date(Date.now() + 5 * 60 * 1000);
    }, 10 * 1000);

    client.dropTimer = setInterval(async () => {
        await dropRandomCard(client);
        // Update global next drop time
        global.nextCardDrop = new Date(Date.now() + 5 * 60 * 1000);
    }, 5 * 60 * 1000); // 5 minutes

    console.log('Card drop timer started - drops every 5 minutes');
}

async function dropRandomCard(client) {
    try {
        const configData = await fs.readFile(CONFIG_PATH, 'utf8');
        const config = JSON.parse(configData);

        if (!config.dropChannelId) return;

        const channel = client.channels.cache.get(config.dropChannelId);
        if (!channel) return;

        // Load cards and select random one using weighted rarity (exclude evolution cards)
        const cardsData = await fs.readFile(CARDS_PATH, 'utf8');
        const allCards = JSON.parse(cardsData);
        const baseCards = allCards.filter(card => !card.evolvesFrom);

        // Get weighted random rank
        const selectedRank = weightedRandomRank();

        // Find cards of the selected rank, fallback to any base card if none found
        const rankCards = baseCards.filter(card => card.rank === selectedRank);
        const randomCard = rankCards.length > 0 
            ? rankCards[Math.floor(Math.random() * rankCards.length)]
            : baseCards[Math.floor(Math.random() * baseCards.length)];

        const embed = new EmbedBuilder()
            .setTitle('💫 Wild Card Appeared!')
            .setDescription(`A **[${randomCard.rank}] ${randomCard.name}** has appeared!\n\n${randomCard.shortDesc}\n\nClick the button below to claim it!`)
            .setColor(getRankColor(randomCard.rank))
            .setTimestamp();

        if (randomCard.image && randomCard.image !== "placeholder") {
            embed.setImage(randomCard.image);
        }

        const button = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`claim_drop_${randomCard.name}`)
                    .setLabel('🎯 Claim Card!')
                    .setStyle(ButtonStyle.Primary)
            );

        const dropMessage = await channel.send({ 
            embeds: [embed], 
            components: [button] 
        });

        // Set up collector for the drop
        const filter = i => i.customId.startsWith('claim_drop_');
        const collector = dropMessage.createMessageComponentCollector({ 
            filter, 
            time: 60 * 60 * 1000, // 1 hour to claim
            max: 1 
        });

        collector.on('collect', async interaction => {
            await claimDrop(interaction, randomCard, client);
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                // No one claimed it
                const expiredEmbed = new EmbedBuilder()
                    .setTitle('💨 Card Escaped!')
                    .setDescription('The card disappeared into the wind...')
                    .setColor(0x95a5a6);

                dropMessage.edit({ embeds: [expiredEmbed], components: [] });
            }
        });

    } catch (error) {
        console.error('Error dropping card:', error);
    }
}

async function claimDrop(interaction, card, client) {
    try {
        await interaction.deferUpdate();

        let user = await User.findOne({ userId: interaction.user.id });

        if (!user) {
            return interaction.followUp({ 
                content: '\u274c You need to start your journey first with `op start`!', 
                ephemeral: true 
            });
        }

        // Add card to user's collection using transformation system
        if (!user.cards) user.cards = [];
        const { addCardWithTransformation } = require('../../utils/cardTransformationSystem.js');
        addCardWithTransformation(user, {
            name: card.name,
            rank: card.rank,
            level: 1,
            experience: 0,
            timesUpgraded: 0
        });

        await user.save();

        // Update the drop message
        const claimedEmbed = new EmbedBuilder()
            .setTitle('\ud83c\udf89 Card Claimed!')
            .setDescription(`**${interaction.user.username}** claimed **[${card.rank}] ${card.name}**!`)
            .setColor(0x2ecc71);

        await interaction.message.edit({ embeds: [claimedEmbed], components: [] });

        // Send DM to the user
        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle('🎁 You Got a Drop!')
                .setDescription(`You successfully claimed **[${card.rank}] ${card.name}** from the drop!\n\n${card.shortDesc}`)
                .setColor(getRankColor(card.rank));

            if (card.image && card.image !== "placeholder") {
                dmEmbed.setImage(card.image);
            }

            await interaction.user.send({ embeds: [dmEmbed] });
        } catch (dmError) {
            console.log('Could not send DM to user');
        }

    } catch (error) {
        console.error('Error claiming drop:', error);
        await interaction.followUp({ 
            content: '❌ An error occurred while claiming the card.', 
            ephemeral: true 
        });
    }
}

function getRankColor(rank) {
    const colors = {
        'C': 0x2ecc40,
        'B': 0x3498db,
        'A': 0x9b59b6,
        'S': 0xe67e22,
        'UR': 0xe74c3c
    };
    return colors[rank] || 0x95a5a6;
}

function weightedRandomRank() {
    const weights = {
        'C': 0.70,
        'B': 0.20,
        'A': 0.07,
        'S': 0.02,
        'UR': 0.01
    };

    let rand = Math.random();
    let cumulativeWeight = 0;

    for (const rank in weights) {
        cumulativeWeight += weights[rank];
        if (rand < cumulativeWeight) {
            return rank;
        }
    }

    return 'C'; // Default to C if something goes wrong
}

function stopDropTimer(client) {
    if (client.dropTimer) {
        clearInterval(client.dropTimer);
        client.dropTimer = null;
        console.log('Card drop timer stopped');
    }
}

module.exports = { data, textData, execute, startDropTimer, stopDropTimer };