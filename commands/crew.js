
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { calculateBattleStats } = require('../utils/battleSystem.js');

const data = new SlashCommandBuilder()
    .setName('crew')
    .setDescription('Manage your pirate crew')
    .addSubcommand(subcommand =>
        subcommand
            .setName('create')
            .setDescription('Create a new pirate crew')
            .addStringOption(option =>
                option
                    .setName('name')
                    .setDescription('Name of your crew')
                    .setRequired(true)
                    .setMaxLength(50)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('invite')
            .setDescription('Invite a user to your crew')
            .addUserOption(option =>
                option
                    .setName('user')
                    .setDescription('User to invite')
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('leave')
            .setDescription('Leave your current crew')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('view')
            .setDescription('View your crew information')
    );

const CREW_INVITE_COOLDOWN = 5 * 60 * 1000; // 5 minutes between invites to same user
const MAX_CREW_SIZE = 10;

async function execute(message, args) {
    const userId = message.author.id;
    let user = await User.findOne({ userId });

    if (!user) {
        return message.reply('Start your journey with `op start` first!');
    }

    const subcommand = args[0];

    if (!subcommand) {
        return await showCrewInfo(message, user);
    }

    switch (subcommand.toLowerCase()) {
        case 'create':
            return await handleCreateCrew(message, user, args.slice(1));
        case 'invite':
            return await handleInviteUser(message, user, args.slice(1));
        case 'leave':
            return await handleLeaveCrew(message, user);
        case 'view':
            return await showCrewInfo(message, user);
        default:
            return await showCrewInfo(message, user);
    }
}

async function handleCreateCrew(message, user, args) {
    if (user.crewId) {
        return message.reply('❌ You are already in a crew! Use `op crew leave` to leave your current crew first.');
    }

    const crewName = args.join(' ').trim();
    if (!crewName) {
        return message.reply('❌ Please provide a name for your crew: `op crew create <name>`');
    }

    if (crewName.length > 50) {
        return message.reply('❌ Crew name must be 50 characters or less.');
    }

    // Generate unique crew ID
    const crewId = `crew_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initialize crew data
    user.crewId = crewId;
    user.crewData = {
        name: crewName,
        captain: user.userId,
        members: [user.userId],
        treasury: 0,
        level: 1,
        createdAt: new Date(),
        inviteCooldowns: new Map()
    };

    await user.save();

    const embed = new EmbedBuilder()
        .setTitle('🏴‍☠️ Crew Created!')
        .setDescription([
            `**${crewName}** has been established!`,
            '',
            `👑 **Captain:** ${user.username || message.author.username}`,
            `👥 **Members:** 1/${MAX_CREW_SIZE}`,
            `💰 **Treasury:** 0 Beli`,
            `⭐ **Level:** 1`,
            '',
            'Use `op crew invite <user>` to recruit more pirates!'
        ].join('\n'))
        .setColor(0x2C2F33)
        .setFooter({ text: 'Crew Management' });

    return message.reply({ embeds: [embed] });
}

async function handleInviteUser(message, user, args) {
    if (!user.crewId) {
        return message.reply('❌ You are not in a crew! Use `op crew create <name>` to start one.');
    }

    if (user.crewData.captain !== user.userId) {
        return message.reply('❌ Only the crew captain can invite new members.');
    }

    const mentionedUser = message.mentions.users.first();
    if (!mentionedUser) {
        return message.reply('❌ Please mention a user to invite: `op crew invite @user`');
    }

    if (mentionedUser.id === user.userId) {
        return message.reply('❌ You cannot invite yourself!');
    }

    if (mentionedUser.bot) {
        return message.reply('❌ You cannot invite bots to your crew!');
    }

    // Check crew size
    if (user.crewData.members.length >= MAX_CREW_SIZE) {
        return message.reply(`❌ Your crew is full! Maximum crew size is ${MAX_CREW_SIZE} members.`);
    }

    // Check if user is already in crew
    if (user.crewData.members.includes(mentionedUser.id)) {
        return message.reply('❌ This user is already in your crew!');
    }

    // Check target user exists in database
    const targetUser = await User.findOne({ userId: mentionedUser.id });
    if (!targetUser) {
        return message.reply('❌ This user hasn\'t started their pirate journey yet! They need to use `op start` first.');
    }

    if (targetUser.crewId) {
        return message.reply('❌ This user is already in another crew!');
    }

    // Check invite cooldown
    const cooldownKey = `${user.userId}_${mentionedUser.id}`;
    const lastInvite = user.crewData.inviteCooldowns?.get?.(cooldownKey);
    if (lastInvite && Date.now() - lastInvite < CREW_INVITE_COOLDOWN) {
        const timeLeft = CREW_INVITE_COOLDOWN - (Date.now() - lastInvite);
        const minutes = Math.ceil(timeLeft / 60000);
        return message.reply(`❌ You must wait ${minutes} more minute(s) before inviting this user again.`);
    }

    // Send DM invitation
    try {
        const inviteEmbed = new EmbedBuilder()
            .setTitle('🏴‍☠️ Crew Invitation!')
            .setDescription([
                `**${user.username || message.author.username}** has invited you to join their crew:`,
                '',
                `**Crew Name:** ${user.crewData.name}`,
                `**Members:** ${user.crewData.members.length}/${MAX_CREW_SIZE}`,
                `**Captain:** ${user.username || message.author.username}`,
                '',
                'React with ✅ to accept or ❌ to decline',
                '',
                '*This invitation will expire in 24 hours*'
            ].join('\n'))
            .setColor(0x2C2F33)
            .setFooter({ text: 'Crew Invitation System' });

        const dmMessage = await mentionedUser.send({ embeds: [inviteEmbed] });
        await dmMessage.react('✅');
        await dmMessage.react('❌');

        // Store invite cooldown
        if (!user.crewData.inviteCooldowns) user.crewData.inviteCooldowns = new Map();
        user.crewData.inviteCooldowns.set(cooldownKey, Date.now());
        await user.save();

        // Handle reactions
        const filter = (reaction, reactUser) => {
            return ['✅', '❌'].includes(reaction.emoji.name) && reactUser.id === mentionedUser.id;
        };

        const collector = dmMessage.createReactionCollector({ filter, time: 24 * 60 * 60 * 1000, max: 1 });

        collector.on('collect', async (reaction) => {
            if (reaction.emoji.name === '✅') {
                await handleAcceptInvite(message, user, targetUser, mentionedUser);
            } else {
                await mentionedUser.send('You declined the crew invitation.');
                await message.reply(`${mentionedUser.username} declined the crew invitation.`);
            }
        });

        collector.on('end', (collected) => {
            if (collected.size === 0) {
                mentionedUser.send('The crew invitation has expired.').catch(() => {});
            }
        });

        return message.reply(`✅ Crew invitation sent to ${mentionedUser.username}!`);

    } catch (error) {
        console.error('Error sending crew invite:', error);
        return message.reply('❌ Failed to send crew invitation. The user may have DMs disabled.');
    }
}

async function handleAcceptInvite(originalMessage, captainUser, targetUser, mentionedUser) {
    try {
        // Refresh captain data
        const refreshedCaptain = await User.findOne({ userId: captainUser.userId });
        if (!refreshedCaptain || !refreshedCaptain.crewId) {
            return mentionedUser.send('❌ The crew no longer exists.');
        }

        // Check if crew is still not full
        if (refreshedCaptain.crewData.members.length >= MAX_CREW_SIZE) {
            return mentionedUser.send('❌ The crew is now full.');
        }

        // Check if target user is still available
        const refreshedTarget = await User.findOne({ userId: targetUser.userId });
        if (refreshedTarget.crewId) {
            return mentionedUser.send('❌ You are already in another crew.');
        }

        // Add user to crew
        refreshedCaptain.crewData.members.push(targetUser.userId);
        refreshedTarget.crewId = refreshedCaptain.crewId;
        refreshedTarget.crewData = {
            name: refreshedCaptain.crewData.name,
            captain: refreshedCaptain.crewData.captain,
            members: refreshedCaptain.crewData.members,
            treasury: refreshedCaptain.crewData.treasury,
            level: refreshedCaptain.crewData.level,
            createdAt: refreshedCaptain.crewData.createdAt
        };

        await refreshedCaptain.save();
        await refreshedTarget.save();

        // Update all crew members
        await User.updateMany(
            { crewId: refreshedCaptain.crewId },
            { $set: { 'crewData.members': refreshedCaptain.crewData.members } }
        );

        await mentionedUser.send(`✅ You joined **${refreshedCaptain.crewData.name}**! Welcome aboard, pirate!`);
        
        try {
            await originalMessage.reply(`🎉 ${mentionedUser.username} joined the crew **${refreshedCaptain.crewData.name}**!`);
        } catch (error) {
            console.log('Could not reply to original message');
        }

    } catch (error) {
        console.error('Error accepting crew invite:', error);
        await mentionedUser.send('❌ An error occurred while joining the crew.');
    }
}

async function handleLeaveCrew(message, user) {
    if (!user.crewId) {
        return message.reply('❌ You are not in a crew!');
    }

    const crewName = user.crewData.name;
    const isCaptain = user.crewData.captain === user.userId;

    if (isCaptain && user.crewData.members.length > 1) {
        return message.reply('❌ As captain, you cannot leave while there are other crew members. Promote someone else to captain first, or kick all members.');
    }

    // If captain leaves and they're the only member, disband crew
    if (isCaptain) {
        await User.updateMany(
            { crewId: user.crewId },
            { $unset: { crewId: "", crewData: "" } }
        );
        
        const embed = new EmbedBuilder()
            .setTitle('🏴‍☠️ Crew Disbanded')
            .setDescription(`**${crewName}** has been disbanded.`)
            .setColor(0x95a5a6);

        return message.reply({ embeds: [embed] });
    }

    // Remove user from crew
    const captain = await User.findOne({ userId: user.crewData.captain });
    if (captain) {
        captain.crewData.members = captain.crewData.members.filter(id => id !== user.userId);
        await captain.save();

        // Update all remaining crew members
        await User.updateMany(
            { crewId: user.crewId },
            { $set: { 'crewData.members': captain.crewData.members } }
        );
    }

    // Clear user's crew data
    user.crewId = null;
    user.crewData = {};
    await user.save();

    const embed = new EmbedBuilder()
        .setTitle('🚪 Left Crew')
        .setDescription(`You left **${crewName}**.`)
        .setColor(0x95a5a6);

    return message.reply({ embeds: [embed] });
}

async function showCrewInfo(message, user) {
    if (!user.crewId) {
        const embed = new EmbedBuilder()
            .setTitle('🏴‍☠️ No Crew')
            .setDescription([
                'You are not part of any crew.',
                '',
                '**Available Commands:**',
                '`op crew create <name>` - Create a new crew',
                '',
                'Join a crew to adventure together with other pirates!'
            ].join('\n'))
            .setColor(0x95a5a6)
            .setFooter({ text: 'Crew System' });

        return message.reply({ embeds: [embed] });
    }

    // Get all crew members
    const crewMembers = await User.find({ crewId: user.crewId });
    const captain = crewMembers.find(member => member.userId === user.crewData.captain);

    let totalPower = 0;
    let membersList = '';

    for (const member of crewMembers) {
        const memberTeam = calculateBattleStats(member);
        const memberPower = memberTeam.reduce((total, card) => total + (card.hp + card.attack + card.speed), 0);
        totalPower += memberPower;

        const isCaptain = member.userId === user.crewData.captain;
        const isYou = member.userId === user.userId;
        
        let status = isCaptain ? '👑' : '👤';
        if (isYou) status += ' (You)';
        
        membersList += `${status} ${member.username || 'Unknown'} - Power: ${memberPower}\n`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`🏴‍☠️ ${user.crewData.name}`)
        .setDescription([
            `**Captain:** ${captain?.username || 'Unknown'}`,
            `**Members:** ${crewMembers.length}/${MAX_CREW_SIZE}`,
            `**Total Power:** ${totalPower}`,
            `**Treasury:** ${user.crewData.treasury || 0} Beli`,
            `**Level:** ${user.crewData.level || 1}`,
            ''
        ].join('\n'))
        .addFields({
            name: '👥 Crew Members',
            value: membersList || 'No members found',
            inline: false
        })
        .setColor(0x2C2F33)
        .setFooter({ text: `Created ${user.crewData.createdAt ? new Date(user.crewData.createdAt).toLocaleDateString() : 'Unknown'}` });

    const components = [];
    
    if (user.crewData.captain === user.userId) {
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('crew_manage')
                    .setLabel('Manage Crew')
                    .setStyle(ButtonStyle.Primary)
            );
        components.push(actionRow);
    }

    const leaveRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('crew_leave_confirm')
                .setLabel('Leave Crew')
                .setStyle(ButtonStyle.Danger)
        );
    components.push(leaveRow);

    const crewMessage = await message.reply({ embeds: [embed], components });

    // Handle button interactions
    const filter = i => i.user.id === user.userId;
    const collector = crewMessage.createMessageComponentCollector({ filter, time: 300000 });

    collector.on('collect', async interaction => {
        await interaction.deferUpdate();

        if (interaction.customId === 'crew_leave_confirm') {
            const confirmEmbed = new EmbedBuilder()
                .setTitle('⚠️ Confirm Leave Crew')
                .setDescription('Are you sure you want to leave this crew?')
                .setColor(0xe74c3c);

            const confirmRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('crew_leave_yes')
                        .setLabel('Yes, Leave')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('crew_leave_no')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.editReply({ embeds: [confirmEmbed], components: [confirmRow] });
        } else if (interaction.customId === 'crew_leave_yes') {
            await handleLeaveCrew(message, user);
            collector.stop();
        } else if (interaction.customId === 'crew_leave_no') {
            await interaction.editReply({ embeds: [embed], components });
        }
    });

    collector.on('end', () => {
        crewMessage.edit({ components: [] }).catch(() => {});
    });
}

module.exports = { data, execute };
