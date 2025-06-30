require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Load all commands from the commands directory

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

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
                if (command.data && command.data.name) {
                    commands.push({
                        name: command.data.name,
                        description: command.data.description || 'No description provided',
                        options: command.data.options || []
                    });
                }
            } catch (error) {
                console.log(`Could not load command ${file}: ${error.message}`);
            }
        }
    }
}

loadCommands(commandsPath);

// Validate environment variables
if (!process.env.DISCORD_TOKEN) {
    console.error('DISCORD_TOKEN is not set in environment variables');
    process.exit(1);
}

if (!process.env.CLIENT_ID) {
    console.error('CLIENT_ID is not set in environment variables');
    process.exit(1);
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // Use guild-specific registration for instant updates during development
    const guildId = process.env.DEV_GUILD_ID || '1322627413234155520';
    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
      { body: commands },
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands for guild ${guildId}.`);
  } catch (error) {
    console.error(error);
  }
})();