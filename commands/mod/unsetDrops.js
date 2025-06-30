
const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const data = new SlashCommandBuilder()
  .setName('unsetdrops')
  .setDescription('[MOD ONLY] Remove the drops channel.');

async function execute(message) {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
        return message.reply('You need Administrator permissions to use this command.');
    }

    try {
        const configPath = path.resolve('config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        if (!config.dropsChannelId) {
            return message.reply('No drops channel is currently set.');
        }

        delete config.dropsChannelId;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        return message.reply('Drops channel has been removed.');
    } catch (error) {
        console.error('Error unsetting drops channel:', error);
        return message.reply('Failed to remove drops channel setting.');
    }
}

module.exports = { data, execute };
