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

// Auto-run quest migration on startup
(async () => {
  try {
    // Wait for MongoDB connection
    await new Promise((resolve) => {
      if (mongoose.connection.readyState === 1) {
        resolve();
      } else {
        mongoose.connection.once('open', resolve);
      }
    });
    
    const { migrateQuestData } = require('./utils/questMigration.js');
    const migrationResult = await migrateQuestData();
    
    if (migrationResult.success) {
      console.log(`[STARTUP] Quest migration completed successfully. Migrated ${migrationResult.migratedCount} users.`);
    } else {
      console.error('[STARTUP] Quest migration failed:', migrationResult.error);
    }
  } catch (error) {
    console.error('[STARTUP] Error during quest migration:', error);
  }
})();

// Login to Discord
client.login(process.env.DISCORD_TOKEN);