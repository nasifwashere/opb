
const { EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const OWNER_ID = '1257718161298690119';
const CONFIG_PATH = path.join(__dirname, '../../config.json');

const data = { 
    name: 'setresets', 
    description: 'Set the reset notification channel (Owner only)' 
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
        config.resetChannelId = channel.id;
        
        // Save config
        await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
        
        const embed = new EmbedBuilder()
            .setTitle('✅ Reset Channel Set')
            .setDescription(`Reset notifications will now be sent to ${channel}`)
            .setColor(0x00ff00);
            
        await message.reply({ embeds: [embed] });
        
        // Start the reset timer if not already running
        if (!client.resetTimer) {
            startResetTimer(client);
        }
        
    } catch (error) {
        console.error('Error setting reset channel:', error);
        await message.reply('❌ Failed to set reset channel.');
    }
}

function startResetTimer(client) {
    // Calculate time until next 5-hour mark from midnight UTC
    const now = new Date();
    const utcMidnight = new Date(now);
    utcMidnight.setUTCHours(0, 0, 0, 0);
    
    const hoursSinceMidnight = (now - utcMidnight) / (1000 * 60 * 60);
    const nextResetHour = Math.ceil(hoursSinceMidnight / 5) * 5;
    
    const nextReset = new Date(utcMidnight);
    nextReset.setUTCHours(nextResetHour);
    
    // If next reset is in the past, add 24 hours
    if (nextReset <= now) {
        nextReset.setUTCDate(nextReset.getUTCDate() + 1);
    }
    
    const timeUntilReset = nextReset - now;
    
    console.log(`Next pull reset in ${timeUntilReset / 1000 / 60} minutes`);
    
    client.resetTimer = setTimeout(async () => {
        await sendResetNotification(client);
        // Set up next reset (5 hours later)
        client.resetTimer = setInterval(() => {
            sendResetNotification(client);
        }, 5 * 60 * 60 * 1000); // 5 hours
    }, timeUntilReset);
}

async function sendResetNotification(client) {
    try {
        const configData = await fs.readFile(CONFIG_PATH, 'utf8');
        const config = JSON.parse(configData);
        
        if (!config.resetChannelId) return;
        
        const channel = client.channels.cache.get(config.resetChannelId);
        if (!channel) return;
        
        const embed = new EmbedBuilder()
            .setTitle('🔄 Pull Reset!')
            .setDescription('Your daily pulls have been reset! Use `op pull` to get new cards!')
            .setColor(0x00ff00)
            .setTimestamp();
            
        await channel.send({ 
            content: '<@&resetping>', 
            embeds: [embed] 
        });
        
        console.log('Reset notification sent');
        
    } catch (error) {
        console.error('Error sending reset notification:', error);
    }
}

module.exports = { data, execute, startResetTimer };
