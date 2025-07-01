require('dotenv').config();
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();

// Load commands recursively
function loadCommands(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            loadCommands(filePath);
        } else if (file.endsWith('.js')) {
            try {
                const command = require(filePath);

                // Use the slash command name if available, otherwise filename
                const commandName = command.data?.name || file.replace('.js', '');
                client.commands.set(commandName, command);

                // Also register text command name if different
                if (command.textData?.name && command.textData.name !== commandName) {
                    client.commands.set(command.textData.name, command);
                }

                console.log(`Loaded command: ${commandName}`);
            } catch (error) {
                console.error(`Error loading command ${file}:`, error);
            }
        }
    }
}

const commandsPath = path.join(__dirname, 'commands');
loadCommands(commandsPath);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/onepiece_bot').then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

client.once('ready', () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);

    // Initialize battles Map for duel system
    if (!client.battles) {
        client.battles = new Map();
    }

    // Load pull reset system - synchronized for all users
    const { startResetTimer } = require('./commands/mod/setResets.js');

    // Calculate synchronized reset times (every 5 hours from UTC midnight)
    function getNextResetTime() {
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

        return nextReset;
    }

    // Set global reset time
    global.nextPullReset = getNextResetTime();
    startResetTimer(client);

    // Start drop timers
    try {
        const { startDropTimer } = require('./commands/mod/setDrops.js');
        startDropTimer(client);
    } catch (error) {
        console.log('Timers will start when channels are set');
    }
});

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
    const interactionHandler = require('./events/interactionCreate.js');
    await interactionHandler.execute(interaction, client);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const config = require('./config.json');
    const prefix = config.prefix;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);

    try {
        const { handleCommand } = require('./utils/commandHandler.js');
        await handleCommand(message, args, client);
    } catch (error) {
        console.error('Error executing command:', error);
        await message.reply('There was an error executing that command.');
    }
});

client.on('error', error => {
    console.error('Discord.js error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

client.login(process.env.DISCORD_TOKEN);