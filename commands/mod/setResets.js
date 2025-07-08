const { SlashCommandBuilder, EmbedBuilder  } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const OWNER_ID = '1257718161298690119';
const CONFIG_PATH = path.join(__dirname, '../../config.json');

const data = new SlashCommandBuilder()
  .setName('setresets')
  .setDescription('Set the reset notification channel (Owner only)')
  .addStringOption(option =>
    option.setName('category')
      .setDescription('Type of reset to configure')
      .setRequired(true)
      .addChoices(
        { name: 'Pull Resets', value: 'pulls' },
        { name: 'Daily Quests', value: 'daily' },
        { name: 'Weekly Quests', value: 'weekly' }
      )
  )
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('Channel to send reset notifications')
      .setRequired(false)
  );

// Text command data for legacy support
const textData = {
  name: 'setresets',
  description: 'Set the reset notification channel (Owner only)',
  usage: 'setresets <pulls/daily/weekly> [#channel]'
};

async function execute(message, args, client) {
    // Handle both slash commands and text commands
    const userId = message.author?.id || message.user?.id;
    const isInteraction = !!message.user;

    if (userId !== OWNER_ID) {
        const response = '❌ This command is restricted to the bot owner.';
        return isInteraction ? message.reply({ content: response, ephemeral: true }) : message.reply(response);
    }

    let category, channel;

    if (isInteraction) {
        // Slash command
        category = message.options.getString('category');
        channel = message.options.getChannel('channel') || message.channel;
    } else {
        // Text command - fix argument parsing
        if (!args || args.length === 0) {
            return message.reply('Usage: `op setresets <pulls/daily/weekly> [#channel]`');
        }

        category = args[0].toLowerCase();
        if (!['pulls', 'daily', 'weekly'].includes(category)) {
            return message.reply('Category must be: pulls, daily, or weekly');
        }

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

        // Update config based on category
        const configKey = category === 'pulls' ? 'pullResetChannelId' : 
                         category === 'daily' ? 'dailyQuestResetChannelId' : 
                         'weeklyQuestResetChannelId';

        config[configKey] = channel.id;

        // Save config
        await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));

        const embed = new EmbedBuilder()
            .setTitle('✅ Reset Channel Set')
            .setDescription(`${category.charAt(0).toUpperCase() + category.slice(1)} reset notifications will now be sent to ${channel}`)
            .setColor(0x00ff00);

        const response = { embeds: [embed] };
        if (isInteraction) {
            await message.reply(response);
        } else {
            await message.reply(response);
        }

        // Reload config and timers in resetSystem if available
        if (client.resetSystem && typeof client.resetSystem.loadConfig === 'function') {
            await client.resetSystem.loadConfig();
            if (typeof client.resetSystem.startResetTimers === 'function') {
                client.resetSystem.startResetTimers();
            }
        }

    } catch (error) {
        console.error('Error setting reset channel:', error);
        await message.reply('Failed to set reset channel.');
    }
}

module.exports = { data, textData, execute };