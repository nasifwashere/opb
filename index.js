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

// Load commands recursively with proper error handling
function loadCommands(dir) {
    // Check if directory exists before trying to read it
    if (!fs.existsSync(dir)) {
        console.log(`Commands directory '${dir}' does not exist. Creating it...`);
        try {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created commands directory: ${dir}`);
            return; // No commands to load yet
        } catch (error) {
            console.error(`Error creating commands directory:`, error);
            return;
        }
    }
    
    let files;
    try {
        files = fs.readdirSync(dir);
    } catch (error) {
        console.error(`Error reading commands directory '${dir}':`, error);
        return;
    }
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        let stat;
        
        try {
            stat = fs.statSync(filePath);
        } catch (error) {
            console.error(`Error accessing file '${filePath}':`, error);
            continue;
        }
        
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

// Migration tracking to prevent infinite runs
let migrationCompleted = false;
let migrationInProgress = false;

// Connect to MongoDB with proper error handling
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
});

// Handle prefix commands (op command)
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    
    const prefix = 'op ';
    if (!message.content.startsWith(prefix)) return;
    
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    const command = client.commands.get(commandName);
    if (!command) return;
    
    try {
        await command.execute(message, args, client);
    } catch (error) {
        console.error(`Error executing command ${commandName}:`, error);
        message.reply('There was an error executing that command!');
    }
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error executing slash command ${interaction.commandName}:`, error);
        const errorMessage = 'There was an error while executing this command!';
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    }
});

// Fixed auto-migration with proper tracking and persistence to prevent infinite loops
(async () => {
    try {
        // Prevent multiple migration runs
        if (migrationInProgress || migrationCompleted) {
            console.log('[STARTUP] Migration already completed or in progress, skipping...');
            return;
        }
        
        migrationInProgress = true;
        
        // Wait for MongoDB connection with proper timeout and cleanup
        await new Promise((resolve, reject) => {
            if (mongoose.connection.readyState === 1) {
                resolve();
                return;
            }
            
            const timeout = setTimeout(() => {
                reject(new Error('MongoDB connection timeout after 15 seconds'));
            }, 15000); // 15 second timeout
            
            const cleanup = () => {
                clearTimeout(timeout);
                mongoose.connection.removeListener('open', onOpen);
                mongoose.connection.removeListener('error', onError);
            };
            
            const onOpen = () => {
                cleanup();
                resolve();
            };
            
            const onError = (err) => {
                cleanup();
                reject(err);
            };
            
            mongoose.connection.once('open', onOpen);
            mongoose.connection.once('error', onError);
        });
        
        // Check if quest migration utility exists before trying to use it
        let migrateQuestData;
        try {
            const questMigrationModule = require('./utils/questMigration.js');
            migrateQuestData = questMigrationModule.migrateQuestData;
        } catch (error) {
            console.log('[STARTUP] Quest migration utility not found, skipping migration...');
            migrationCompleted = true;
            migrationInProgress = false;
            return;
        }
        
        // Check if User model exists before trying to use it
        let User;
        try {
            User = require('./db/models/User.js');
        } catch (error) {
            console.log('[STARTUP] User model not found, skipping migration...');
            migrationCompleted = true;
            migrationInProgress = false;
            return;
        }
        
        // Create a persistent migration flag collection to prevent re-running
        const MigrationFlag = mongoose.model('MigrationFlag', new mongoose.Schema({
            name: { type: String, unique: true },
            completed: { type: Boolean, default: false },
            completedAt: { type: Date, default: Date.now }
        }));
        
        // Check if quest migration has been completed before
        const questMigrationFlag = await MigrationFlag.findOne({ name: 'questData_v1' });
        
        if (questMigrationFlag && questMigrationFlag.completed) {
            console.log('[STARTUP] Quest migration already completed previously, skipping...');
            migrationCompleted = true;
            migrationInProgress = false;
            return;
        }
        
        // Quick check to see if any migration is needed at all
        const sampleUsers = await User.find({
            $or: [
                { questData: { $exists: false } },
                { 'questData.migrationVersion': { $exists: false } },
                { 'questData.migrationVersion': { $lt: 1 } }
            ]
        }).limit(1);
        
        if (sampleUsers.length === 0) {
            console.log('[STARTUP] No migration needed - all users already migrated');
            
            // Mark migration as completed in database
            await MigrationFlag.findOneAndUpdate(
                { name: 'questData_v1' },
                { completed: true, completedAt: new Date() },
                { upsert: true }
            );
            
            migrationCompleted = true;
            migrationInProgress = false;
            return;
        }
        
        console.log('[STARTUP] Migration needed, starting quest data migration...');
        
        const migrationResult = await migrateQuestData();
        
        if (migrationResult.success) {
            console.log(`[STARTUP] Quest migration completed successfully. Migrated ${migrationResult.migratedCount} users.`);
            
            // Mark migration as completed in database to prevent future runs
            await MigrationFlag.findOneAndUpdate(
                { name: 'questData_v1' },
                { completed: true, completedAt: new Date() },
                { upsert: true }
            );
            
            migrationCompleted = true;
        } else {
            console.error('[STARTUP] Quest migration failed:', migrationResult.error);
        }
        
    } catch (error) {
        console.error('[STARTUP] Error during quest migration:', error);
        
        // On timeout or other critical errors, mark as completed to prevent infinite loops
        if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
            console.log('[STARTUP] Marking migration as completed due to connection issues to prevent loops');
            migrationCompleted = true;
        }
    } finally {
        migrationInProgress = false;
    }
})();

// Login to Discord
client.login(process.env.DISCORD_TOKEN);