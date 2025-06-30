
const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const data = new SlashCommandBuilder()
  .setName('unsetmarket')
  .setDescription('[MOD ONLY] Remove the market announcement channel.');

async function execute(message) {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
        return message.reply('You need Administrator permissions to use this command.');
    }

    try {
        const configPath = path.resolve('config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        if (!config.marketChannelId) {
            return message.reply('No market channel is currently set.');
        }

        delete config.marketChannelId;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        return message.reply('Market announcement channel has been removed.');
    } catch (error) {
        console.error('Error unsetting market channel:', error);
        return message.reply('Failed to remove market channel setting.');
    }
}

module.exports = { data, execute };
