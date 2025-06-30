
const { SlashCommandBuilder, EmbedBuilder  } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const OWNER_ID = '1257718161298690119';
const CONFIG_PATH = path.join(__dirname, '../../config.json');

const data = new SlashCommandBuilder()
  .setName('setmarket')
  .setDescription('Set the market notification channel (Owner only)')
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('Channel for market notifications')
      .setRequired(false)
  );

// Text command data for legacy support
const textData = {
  name: 'setmarket',
  description: 'Set the market notification channel (Owner only)',
  usage: 'setmarket [#channel]'
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
        config.marketChannelId = channel.id;
        
        // Save config
        await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Market Channel Set')
            .setDescription(`New market listings will now be announced in ${channel}`)
            .setColor(0x00ff00);
        
        const response = { embeds: [embed] };
        if (isInteraction) {
            await message.reply(response);
        } else {
            await message.reply(response);
        }
        
    } catch (error) {
        console.error('Error setting market channel:', error);
        await message.reply('❌ Failed to set market channel.');
    }
}

async function announceMarketListing(client, listing) {
    try {
        const configData = await fs.readFile(CONFIG_PATH, 'utf8');
        const config = JSON.parse(configData);
        
        if (!config.marketChannelId) return;
        
        const channel = client.channels.cache.get(config.marketChannelId);
        if (!channel) return;
        
        const embed = new EmbedBuilder()
            .setTitle('🏪 New Market Listing!')
            .setDescription(`**${listing.cardName}** has been listed for **${listing.price} Beli**`)
            .addFields(
                { name: 'Seller', value: listing.sellerName, inline: true },
                { name: 'Rank', value: listing.rank, inline: true }
            )
            .setColor(0x3498db)
            .setTimestamp();
            
        await channel.send({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error announcing market listing:', error);
    }
}

module.exports = { data, textData, execute, announceMarketListing };
