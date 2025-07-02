const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

const ADMIN_USER_ID = '1257718161298690119'; // Replace with actual admin user ID

const data = new SlashCommandBuilder()
    .setName('clearstuck')
    .setDescription('[ADMIN] Force clear a stuck user\'s exploration state')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to unstuck')
            .setRequired(true)
    )
    .addStringOption(option =>
        option.setName('type')
            .setDescription('Type of stuck state to clear')
            .setRequired(false)
            .addChoices(
                { name: 'Battle State', value: 'battle' },
                { name: 'Defeat Cooldown', value: 'cooldown' },
                { name: 'All Exploration Data', value: 'all' },
                { name: 'Reset Stage', value: 'stage' }
            )
    );

async function execute(message, args, client) {
    // Admin permission check
    if (message.author.id !== ADMIN_USER_ID) {
        return message.reply('❌ This command is restricted to administrators.');
    }

    // Parse arguments - handle both slash commands and text commands
    let targetUser, clearType = 'all';
    
    if (message.options) {
        // Slash command
        targetUser = message.options.getUser('user');
        clearType = message.options.getString('type') || 'all';
    } else {
        // Text command - expect format: clearstuck @user [type]
        if (!args || args.length === 0) {
            return message.reply('Usage: `op clearstuck @user [battle|cooldown|all|stage]`');
        }
        
        // Extract user mention or ID
        const userMention = args[0];
        if (userMention.startsWith('<@') && userMention.endsWith('>')) {
            const userId = userMention.slice(2, -1).replace('!', '');
            targetUser = await client.users.fetch(userId).catch(() => null);
        } else {
            targetUser = await client.users.fetch(userMention).catch(() => null);
        }
        
        if (!targetUser) {
            return message.reply('❌ Could not find that user.');
        }
        
        clearType = args[1] || 'all';
    }

    const user = await User.findOne({ userId: targetUser.id });
    if (!user) {
        return message.reply(`❌ ${targetUser.username} has not started their journey yet.`);
    }

    let clearedItems = [];

    // Initialize exploreStates if it doesn't exist
    if (!user.exploreStates) {
        user.exploreStates = {};
    }

    switch (clearType) {
        case 'battle':
            if (user.exploreStates.inBossFight) {
                user.exploreStates.inBossFight = false;
                user.exploreStates.battleState = null;
                user.exploreStates.currentStage = null;
                user.exploreStates.currentLocation = null;
                clearedItems.push('Battle state');
            }
            break;

        case 'cooldown':
            if (user.exploreStates.defeatCooldown) {
                user.exploreStates.defeatCooldown = null;
                clearedItems.push('Defeat cooldown');
            }
            break;

        case 'stage':
            const originalStage = user.stage;
            user.stage = Math.max(0, user.stage || 0);
            
            // Also clear any active battle states when resetting stage
            user.exploreStates.inBossFight = false;
            user.exploreStates.battleState = null;
            user.exploreStates.currentStage = null;
            user.exploreStates.currentLocation = null;
            
            clearedItems.push(`Stage reset (was ${originalStage}, now ${user.stage})`);
            break;

        case 'all':
        default:
            if (user.exploreStates.inBossFight) {
                user.exploreStates.inBossFight = false;
                clearedItems.push('Battle state');
            }
            if (user.exploreStates.battleState) {
                user.exploreStates.battleState = null;
                clearedItems.push('Battle data');
            }
            if (user.exploreStates.currentStage) {
                user.exploreStates.currentStage = null;
                clearedItems.push('Current stage data');
            }
            if (user.exploreStates.currentLocation) {
                user.exploreStates.currentLocation = null;
                clearedItems.push('Current location');
            }
            if (user.exploreStates.defeatCooldown) {
                user.exploreStates.defeatCooldown = null;
                clearedItems.push('Defeat cooldown');
            }
            break;
    }

    await user.save();

    const embed = new EmbedBuilder()
        .setTitle('🔧 User Unstuck')
        .setDescription([
            `**Target:** ${targetUser.username}`,
            `**Clear Type:** ${clearType}`,
            '',
            clearedItems.length > 0 
                ? `**Cleared:**\n${clearedItems.map(item => `✅ ${item}`).join('\n')}`
                : '⚠️ No stuck states found to clear',
            '',
            'The user can now use `op explore` normally.'
        ].join('\n'))
        .setColor(clearedItems.length > 0 ? 0x2ecc71 : 0xf39c12)
        .setFooter({ text: `Admin: ${message.author.username}` });

    await message.reply({ embeds: [embed] });

    // Optionally notify the target user
    try {
        const notifyEmbed = new EmbedBuilder()
            .setTitle('🔧 Exploration State Reset')
            .setDescription([
                'An administrator has cleared your stuck exploration state.',
                'You can now continue exploring normally with `op explore`!'
            ].join('\n'))
            .setColor(0x2ecc71);

        await targetUser.send({ embeds: [notifyEmbed] });
    } catch (error) {
        // User might have DMs disabled, that's okay
        console.log(`Could not notify ${targetUser.username} of unstuck: ${error.message}`);
    }
}

module.exports = { data, execute };