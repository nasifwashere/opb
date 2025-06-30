
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const User = require('../../db/models/User.js');

const OWNER_ID = '1257718161298690119';
const CONFIG_PATH = path.join(__dirname, '../../config.json');
const CARDS_PATH = path.join(__dirname, '../../data/cards.json');

const data = { 
    name: 'setdrops', 
    description: 'Set the card drop channel (Owner only)' 
};

async function execute(message, args, client) {
    if (message.author.id !== OWNER_ID) {
        return message.reply('❌ This command is restricted to the bot owner.');
    }

    const channel = message.mentions.channels.first() || message.channel;
    
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
            .setDescription(`Card drops will now appear in ${channel} every 10 minutes`)
            .setColor(0x00ff00);
            
        await message.reply({ embeds: [embed] });
        
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
    client.dropTimer = setInterval(async () => {
        await dropRandomCard(client);
    }, 10 * 60 * 1000); // 10 minutes
    
    console.log('Card drop timer started - drops every 10 minutes');
}

async function dropRandomCard(client) {
    try {
        const configData = await fs.readFile(CONFIG_PATH, 'utf8');
        const config = JSON.parse(configData);
        
        if (!config.dropChannelId) return;
        
        const channel = client.channels.cache.get(config.dropChannelId);
        if (!channel) return;
        
        // Load cards and select random one
        const cardsData = await fs.readFile(CARDS_PATH, 'utf8');
        const allCards = JSON.parse(cardsData);
        const randomCard = allCards[Math.floor(Math.random() * allCards.length)];
        
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
            time: 5 * 60 * 1000, // 5 minutes to claim
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
                content: '❌ You need to start your journey first with `op start`!', 
                ephemeral: true 
            });
        }
        
        // Add card to user's collection
        if (!user.cards) user.cards = [];
        user.cards.push({
            name: card.name,
            rank: card.rank,
            level: 1,
            experience: 0,
            timesUpgraded: 0
        });
        
        await user.save();
        
        // Update the drop message
        const claimedEmbed = new EmbedBuilder()
            .setTitle('🎉 Card Claimed!')
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

module.exports = { data, execute, startDropTimer };
