
const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const data = new SlashCommandBuilder()
  .setName('unsetresets')
  .setDescription('[MOD ONLY] Remove the resets channel.');

async function execute(message) {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
        return message.reply('You need Administrator permissions to use this command.');
    }

    try {
        const configPath = path.resolve('config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        if (!config.resetsChannelId) {
            return message.reply('No resets channel is currently set.');
        }

        delete config.resetsChannelId;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        return message.reply('Resets channel has been removed.');
    } catch (error) {
        console.error('Error unsetting resets channel:', error);
        return message.reply('Failed to remove resets channel setting.');
    }
}

module.exports = { data, execute };
