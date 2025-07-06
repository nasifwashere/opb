require('dotenv').config();

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Import keep-alive server for Render deployment
const { keepAlive } = require('./keepAlive');

// Start keep-alive server immediately for Render
keepAlive();

// Optimize for Render free tier
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    // Optimize connection options for Render
    shardCount: 1,
    presence: {
        status: 'online'
    }
});

client.commands = new Collection();

// Bulletproof deduplication system - single message ID tracking
const processedInteractions = new Map(); // Store with timestamps
const processedMessages = new Map(); // Store message IDs with timestamps
const MESSAGE_TIMEOUT = 5 * 60 * 1000; // 5 minutes for messages (longer since they're just message IDs)
const INTERACTION_TIMEOUT = 60 * 1000; // 1 minute for interactions

// Clean up old IDs every 60 seconds to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    let cleanedMessages = 0;
    let cleanedInteractions = 0;
    
    // Remove old message IDs (Discord snowflakes)
    for (const [messageId, timestamp] of processedMessages.entries()) {
        if (now - timestamp > MESSAGE_TIMEOUT) {
            processedMessages.delete(messageId);
            cleanedMessages++;
        }
    }
    
    // Remove old interactions
    for (const [key, timestamp] of processedInteractions.entries()) {
        if (now - timestamp > INTERACTION_TIMEOUT) {
            processedInteractions.delete(key);
            cleanedInteractions++;
        }
    }
    
    // Log cleanup if significant
    if (cleanedMessages > 20 || cleanedInteractions > 20) {
        console.log(`🧹 Cleaned up ${cleanedMessages} messages, ${cleanedInteractions} interactions`);
    }
    
    // Force garbage collection if available (helps on Render free tier)
    if (global.gc && (cleanedMessages > 100 || cleanedInteractions > 100)) {
        global.gc();
    }
}, 60 * 1000);

// Improved command loading with memory optimization
function loadCommands(dir) {
    if (!fs.existsSync(dir)) {
        console.log(`Commands directory '${dir}' does not exist. Creating it...`);
        try {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created commands directory: ${dir}`);
            return;
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
    
    let loadedCount = 0;
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
                // Clear require cache to prevent memory leaks during development
                delete require.cache[require.resolve(filePath)];
                
                const command = require(filePath);
                const commandName = command.data?.name || file.replace('.js', '');
                client.commands.set(commandName, command);
                
                if (command.textData?.name && command.textData.name !== commandName) {
                    client.commands.set(command.textData.name, command);
                }
                
                loadedCount++;
            } catch (error) {
                console.error(`Error loading command ${file}:`, error);
            }
        }
    }
    console.log(`Loaded ${loadedCount} commands from ${dir}`);
}

const commandsPath = path.join(__dirname, 'commands');
loadCommands(commandsPath);

// Migration tracking with better error handling
let migrationCompleted = false;
let migrationInProgress = false;

// Optimized MongoDB connection with better error handling for Render
const connectDB = async () => {
    try {
        const options = {
            // Optimize for Render free tier
            maxPoolSize: 5, // Limit connection pool size
            serverSelectionTimeoutMS: 10000, // 10 second timeout
            socketTimeoutMS: 30000, // 30 second socket timeout
            maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
        };

        // Configure mongoose settings before connecting
        mongoose.set('bufferCommands', false);
        
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/onepiece_bot', options);
        console.log('✅ Connected to MongoDB');

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('⚠️ MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconnected');
        });

    } catch (err) {
        console.error('❌ MongoDB connection failed:', err);
        // Don't exit process, let it retry
        setTimeout(connectDB, 5000); // Retry after 5 seconds
    }
};

// Initialize database connection
connectDB();

client.once('ready', async () => {
    console.log(`🚀 Ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} guilds`);
    
    // Set streaming status
    client.user.setPresence({
        activities: [{
            name: 'One Piece',
            type: 1, // STREAMING
            url: 'https://discord.gg/a8jhaWfS'
        }],
        status: 'online'
    });
    
    // Initialize battles Map for duel system with size limit
    if (!client.battles) {
        client.battles = new Map();
    }
    
    // Clean up old battles every 10 minutes to prevent memory leaks
    setInterval(() => {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [messageId, battleData] of client.battles.entries()) {
            // Remove battles older than 30 minutes
            if (now - battleData.startTime > 30 * 60 * 1000) {
                client.battles.delete(messageId);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} old battles`);
        }
    }, 10 * 60 * 1000);
    
    // Initialize reset system with error handling
    try {
        const resetSystem = require('./utils/resetSystem.js');
        await resetSystem.initialize(client);
        console.log('✅ Reset system initialized');
    } catch (error) {
        console.error('❌ Error initializing reset system:', error);
    }
    
    // Auto-start drop timer with error handling
    try {
        const configPath = path.join(__dirname, 'config.json');
        if (fs.existsSync(configPath)) {
            const configData = await fs.promises.readFile(configPath, 'utf8');
            const config = JSON.parse(configData);
            
            if (config.dropChannelId) {
                const { startDropTimer } = require('./commands/mod/setDrops.js');
                startDropTimer(client);
                console.log('✅ Auto-started card drop timer');
            }
        }
    } catch (error) {
        console.log('⚠️ No config found or drops not configured:', error.message);
    }
});

// Bulletproof message handler with single-point deduplication
client.on('messageCreate', async message => {
    // Prevent bot responses and duplicate processing
    if (message.author.bot) return;
    
    // BULLETPROOF: Single check - if this exact message ID has been processed, block immediately
    const messageId = message.id;
    if (processedMessages.has(messageId)) {
        // Don't even log this - it's a duplicate at the Discord level
        return;
    }
    
    // Add message ID to processed list IMMEDIATELY to prevent ANY duplicates
    processedMessages.set(messageId, Date.now());
    
    // Case-insensitive prefix check (normalize to lowercase)
    const messageContent = message.content.trim();
    const lowerContent = messageContent.toLowerCase();
    
    // Check for prefix (case-insensitive)
    if (!lowerContent.startsWith('op ')) {
        return;
    }
    
    // Parse command (always use lowercase for consistency)
    const args = messageContent.slice(3).trim().split(/ +/); // Remove "op " (3 characters)
    const commandName = args.shift().toLowerCase();
    
    const command = client.commands.get(commandName);
    if (!command) return;
    
    try {
        // Check database connection before executing commands that need it
        if (mongoose.connection.readyState !== 1 && ['explore', 'pull', 'team', 'inventory', 'duel', 'start'].includes(commandName)) {
            return message.reply({
                content: '⚠️ Database connection is unavailable. Please try again in a few moments.',
                allowedMentions: { repliedUser: false }
            });
        }
        
        // Execute command ONCE - no logging to prevent confusion
        await command.execute(message, args, client);
    } catch (error) {
        console.error(`❌ Error executing ${commandName}:`, error);
        
        // Enhanced error response - only send if not already replied
        try {
            await message.reply({
                content: 'There was an error executing that command! Please try again.',
                allowedMentions: { repliedUser: false }
            });
        } catch (replyError) {
            console.error('Failed to send error message:', replyError);
        }
    }
});

// Optimized interaction handler with comprehensive deduplication
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() && !interaction.isButton() && !interaction.isSelectMenu()) return;
    
    // Enhanced deduplication for interactions with shorter timing window
    const now = Date.now();
    const actionName = interaction.customId || interaction.commandName;
    const uniqueId = `${interaction.id}-${interaction.user.id}-${actionName}`;
    
    // Check for duplicates with timing verification (2 second window for interactions)
    if (processedInteractions.has(uniqueId)) {
        const processedTime = processedInteractions.get(uniqueId);
        if (now - processedTime < 2000) { // 2 second window for interactions
            console.log(`[BLOCKED] Duplicate interaction: ${actionName} by ${interaction.user.tag} (${now - processedTime}ms ago)`);
            return;
        }
    }
    
    // Add to processed interactions with current timestamp
    processedInteractions.set(uniqueId, now);
    
    // Handle different interaction types
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        
        try {
            // Check database connection before executing commands that need it
            if (mongoose.connection.readyState !== 1 && ['explore', 'pull', 'team', 'inventory', 'duel', 'start'].includes(interaction.commandName)) {
                return interaction.reply({
                    content: '⚠️ Database connection is unavailable. Please try again in a few moments.',
                    ephemeral: true
                });
            }
            
            console.log(`Executing slash command: ${interaction.commandName} by ${interaction.user.tag}`);
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing slash command ${interaction.commandName}:`, error);
            
            const errorMessage = 'There was an error while executing this command!';
            
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMessage, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            } catch (replyError) {
                console.error('Failed to send error response:', replyError);
            }
        }
    }
    
    // Handle button interactions (for battles, etc.)
    if (interaction.isButton()) {
        try {
            // Handle duel buttons
            if (['duel_attack', 'duel_defend', 'duel_inventory', 'duel_forfeit'].includes(interaction.customId)) {
                const battleData = client.battles?.get(interaction.message.id);
                if (battleData) {
                    const { handleDuelAction } = require('./utils/duelHandler');
                    if (handleDuelAction) {
                        await handleDuelAction(interaction, client);
                    }
                }
            }
            
            // Handle other button interactions as needed
            // Reduce excessive logging for performance
            // console.log(`🔘 Button interaction: ${interaction.customId} by ${interaction.user.tag}`);
            
        } catch (error) {
            console.error(`Error handling button interaction ${interaction.customId}:`, error);
        }
    }
});

// Optimized migration with better error handling and timeout protection
(async () => {
    try {
        if (migrationInProgress || migrationCompleted) {
            console.log('Migration already completed or in progress, skipping...');
            return;
        }
        
        migrationInProgress = true;
        
        // Wait for MongoDB connection with timeout
        const connectTimeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('MongoDB connection timeout')), 15000);
        });
        
        const connectPromise = new Promise((resolve) => {
            if (mongoose.connection.readyState === 1) {
                resolve();
                return;
            }
            mongoose.connection.once('open', resolve);
        });
        
        await Promise.race([connectPromise, connectTimeout]);
        
        // Quick migration check
        try {
            const User = require('./db/models/User.js');
            const { migrateQuestData } = require('./utils/questMigration.js');
            
            // Check if migration is needed
            const needsMigration = await User.findOne({
                $or: [
                    { questData: { $exists: false } },
                    { 'questData.migrationVersion': { $exists: false } },
                    { 'questData.migrationVersion': { $lt: 1 } }
                ]
            });
            
            if (!needsMigration) {
                // Reduce excessive logging for performance
                // console.log('✅ No migration needed');
                migrationCompleted = true;
                return;
            }
            
            console.log('🔄 Starting quest data migration...');
            const result = await migrateQuestData();
            
            if (result.success) {
                console.log(`✅ Migration completed: ${result.migratedCount} users migrated`);
                migrationCompleted = true;
            } else {
                console.error('❌ Migration failed:', result.error);
            }
            
        } catch (error) {
            // Reduce excessive logging for performance
            // console.log('⚠️ Migration utilities not found, skipping migration');
            migrationCompleted = true;
        }
        
    } catch (error) {
        console.error('❌ Migration error:', error);
        migrationCompleted = true; // Prevent infinite loops
    } finally {
        migrationInProgress = false;
    }
})();

// Graceful shutdown handling for Render
process.on('SIGTERM', async () => {
    console.log('📋 SIGTERM received, shutting down gracefully...');
    
    try {
        // Close Discord client
        if (client) {
            await client.destroy();
            console.log('✅ Discord client closed');
        }
        
        // Close MongoDB connection
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('✅ MongoDB connection closed');
        }
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGINT', async () => {
    console.log('📋 SIGINT received, shutting down gracefully...');
    process.exit(0);
});

// Handle uncaught exceptions and unhandled rejections for Render stability
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    // Don't exit immediately on Render, try to continue
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit immediately on Render, try to continue
});

// Memory monitoring for Render free tier
setInterval(() => {
    const used = process.memoryUsage();
    const memoryMB = Math.round(used.rss / 1024 / 1024);
    
    // Log memory usage if it's getting high (Render free tier has 512MB)
    if (memoryMB > 400) {
        console.log(`⚠️ High memory usage: ${memoryMB}MB`);
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
            console.log('🧹 Forced garbage collection');
        }
    }
}, 60000); // Check every minute

// Login to Discord with retry logic for Render
const loginWithRetry = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            await client.login(process.env.DISCORD_TOKEN);
            console.log('✅ Successfully logged in to Discord');
            return;
        } catch (error) {
            console.error(`❌ Login attempt ${i + 1} failed:`, error);
            if (i === retries - 1) {
                console.error('❌ All login attempts failed');
                process.exit(1);
            }
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
};

// Only start the bot after MongoDB is connected
connectDB().then(() => {
    loginWithRetry();
});