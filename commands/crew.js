const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');

const data = new SlashCommandBuilder()
    .setName('crew')
    .setDescription('Manage your pirate crew');

const MAX_CREW_SIZE = 10;

// Store for crew data (in a real implementation, this would be in the database)
const crews = new Map();

async function execute(message, args) {
    const userId = message.author.id;
    let user = await User.findOne({ userId });

    if (!user) {
        return message.reply('Start your journey with `op start` first!');
    }

    const subcommand = args[0]?.toLowerCase();

    switch (subcommand) {
        case 'create':
            return await handleCreateCrew(message, user, args.slice(1));
        case 'invite':
            return await handleInviteUser(message, user, args.slice(1));
        case 'accept':
            return await handleCrewResponse(message, user, true);
        case 'decline':
            return await handleCrewResponse(message, user, false);
        case 'leave':
            return await handleLeaveCrew(message, user);
        case 'kick':
            return await handleKickMember(message, user, args.slice(1));
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
        return message.reply('❌ Please provide a name for your crew: `op crew create <crew name>`');
    }

    if (crewName.length > 50) {
        return message.reply('❌ Crew name must be 50 characters or less.');
    }

    // Generate unique crew ID
    const crewId = `crew_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create crew data
    const crewData = {
        id: crewId,
        name: crewName,
        captain: user.userId,
        members: [user.userId],
        createdAt: new Date(),
        invites: new Map() // pending invites
    };

    crews.set(crewId, crewData);

    // Update user
    user.crewId = crewId;
    user.crewRole = 'captain';
    await user.save();

    const embed = new EmbedBuilder()
        .setTitle('🏴‍☠️ Crew Created!')
        .setDescription([
            `**${crewName}** has been established!`,
            '',
            `👑 **Captain:** ${user.username || message.author.username}`,
            `👥 **Members:** 1/${MAX_CREW_SIZE}`,
            `💰 **Total Bounty:** ${user.bounty || 0} Beli`,
            `📊 **Average Bounty:** ${user.bounty || 0} Beli`,
            '',
            'Use `op crew invite @user` to recruit more pirates!'
        ].join('\n'))
        .setColor(0x2C2F33)
        .setFooter({ text: 'Crew Management' });

    return message.reply({ embeds: [embed] });
}

async function handleInviteUser(message, user, args) {
    if (!user.crewId) {
        return message.reply('❌ You are not in a crew! Use `op crew create <crew name>` to start one.');
    }

    if (user.crewRole !== 'captain') {
        return message.reply('❌ Only the crew captain can invite new members.');
    }

    const crew = crews.get(user.crewId);
    if (!crew) {
        // Try to rebuild crew data from database
        await rebuildCrewData(user.crewId);
        return message.reply('❌ Crew data not found. Please try again.');
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
    if (crew.members.length >= MAX_CREW_SIZE) {
        return message.reply(`❌ Your crew is full! Maximum crew size is ${MAX_CREW_SIZE} members.`);
    }

    // Check if user is already in crew
    if (crew.members.includes(mentionedUser.id)) {
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

    // Check if already invited
    if (crew.invites.has(mentionedUser.id)) {
        return message.reply('❌ This user already has a pending invite to your crew!');
    }

    // Store invite
    crew.invites.set(mentionedUser.id, {
        invitedBy: user.userId,
        invitedAt: Date.now(),
        crewId: crew.id,
        crewName: crew.name
    });

    // Send invite embed
    const inviteEmbed = new EmbedBuilder()
        .setTitle('🏴‍☠️ Crew Invitation!')
        .setDescription([
            `**${user.username || message.author.username}** has invited you to join their crew:`,
            '',
            `**Crew:** ${crew.name}`,
            `**Captain:** ${user.username || message.author.username}`,
            `**Members:** ${crew.members.length}/${MAX_CREW_SIZE}`,
            '',
            'Use `op crew accept` to join or `op crew decline` to refuse.',
            '',
            '*This invitation will expire in 24 hours*'
        ].join('\n'))
        .setColor(0x2C2F33)
        .setFooter({ text: 'Crew Invitation System' });

    try {
        await mentionedUser.send({ embeds: [inviteEmbed] });
        
        // Set expiry
        setTimeout(() => {
            crew.invites.delete(mentionedUser.id);
        }, 24 * 60 * 60 * 1000);

        return message.reply(`✅ Crew invitation sent to ${mentionedUser.username}!`);
    } catch (error) {
        crew.invites.delete(mentionedUser.id);
        return message.reply('❌ Failed to send crew invitation. The user may have DMs disabled.');
    }
}

async function handleLeaveCrew(message, user) {
    if (!user.crewId) {
        return message.reply('❌ You are not in a crew!');
    }

    const crew = crews.get(user.crewId);
    if (!crew) {
        // Clean up corrupted crew data
        user.crewId = null;
        user.crewRole = null;
        await user.save();
        return message.reply('❌ Crew data not found. Your crew status has been reset.');
    }

    const crewName = crew.name;
    const isCaptain = user.crewRole === 'captain';

    if (isCaptain && crew.members.length > 1) {
        return message.reply('❌ As captain, you cannot leave while there are other crew members. Use `op crew kick @member` to remove members first.');
    }

    // Remove from crew
    crew.members = crew.members.filter(id => id !== user.userId);
    
    // If captain leaves and they're the only member, disband crew
    if (isCaptain && crew.members.length === 0) {
        crews.delete(crew.id);
        
        // Update user
        user.crewId = null;
        user.crewRole = null;
        await user.save();
        
        const embed = new EmbedBuilder()
            .setTitle('🏴‍☠️ Crew Disbanded')
            .setDescription(`**${crewName}** has been disbanded.`)
            .setColor(0x95a5a6);

        return message.reply({ embeds: [embed] });
    }

    // Update all remaining crew members in database
    await User.updateMany(
        { crewId: user.crewId },
        { $unset: { crewId: "", crewRole: "" } }
    );

    // Clear user's crew data
    user.crewId = null;
    user.crewRole = null;
    await user.save();

    const embed = new EmbedBuilder()
        .setTitle('🚪 Left Crew')
        .setDescription(`You left **${crewName}**.`)
        .setColor(0x95a5a6);

    return message.reply({ embeds: [embed] });
}

async function handleKickMember(message, user, args) {
    if (!user.crewId || user.crewRole !== 'captain') {
        return message.reply('❌ Only crew captains can kick members!');
    }

    const mentionedUser = message.mentions.users.first();
    if (!mentionedUser) {
        return message.reply('❌ Please mention a user to kick: `op crew kick @user`');
    }

    if (mentionedUser.id === user.userId) {
        return message.reply('❌ You cannot kick yourself! Use `op crew leave` instead.');
    }

    const crew = crews.get(user.crewId);
    if (!crew || !crew.members.includes(mentionedUser.id)) {
        return message.reply('❌ This user is not in your crew!');
    }

    // Remove from crew
    crew.members = crew.members.filter(id => id !== mentionedUser.id);

    // Update kicked user
    const kickedUser = await User.findOne({ userId: mentionedUser.id });
    if (kickedUser) {
        kickedUser.crewId = null;
        kickedUser.crewRole = null;
        await kickedUser.save();
    }

    return message.reply(`✅ ${mentionedUser.username} has been kicked from the crew.`);
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
                '`op crew accept` - Accept a crew invitation',
                '`op crew decline` - Decline a crew invitation',
                '',
                'Join a crew to adventure together with other pirates!'
            ].join('\n'))
            .setColor(0x95a5a6)
            .setFooter({ text: 'Crew System' });

        return message.reply({ embeds: [embed] });
    }

    const crew = crews.get(user.crewId);
    if (!crew) {
        // Try to rebuild crew data
        await rebuildCrewData(user.crewId);
        return message.reply('❌ Crew data not found. Please contact an administrator.');
    }

    // Get all crew members with their bounties
    const crewMembers = await User.find({ crewId: user.crewId });
    
    let totalBounty = 0;
    let membersList = '';
    
    for (const member of crewMembers) {
        const bounty = member.bounty || 0;
        totalBounty += bounty;
        
        const isCaptain = member.crewRole === 'captain';
        const isYou = member.userId === user.userId;
        
        let status = isCaptain ? '👑' : '👤';
        if (isYou) status += ' (You)';
        
        membersList += `${status} ${member.username || 'Unknown'} - ${bounty.toLocaleString()} Bounty\n`;
    }
    
    const averageBounty = crewMembers.length > 0 ? Math.floor(totalBounty / crewMembers.length) : 0;

    const embed = new EmbedBuilder()
        .setTitle(`🏴‍☠️ ${crew.name}`)
        .setDescription([
            `**Captain:** ${crewMembers.find(m => m.crewRole === 'captain')?.username || 'Unknown'}`,
            `**Members:** ${crewMembers.length}/${MAX_CREW_SIZE}`,
            `💰 **Total Bounty:** ${totalBounty.toLocaleString()} Beli`,
            `📊 **Average Bounty:** ${averageBounty.toLocaleString()} Beli`,
            ''
        ].join('\n'))
        .addFields({
            name: '👥 Crew Members',
            value: membersList || 'No members found',
            inline: false
        })
        .setColor(0x2C2F33)
        .setFooter({ text: `Created ${crew.createdAt.toLocaleDateString()}` });

    return message.reply({ embeds: [embed] });
}

async function rebuildCrewData(crewId) {
    const members = await User.find({ crewId });
    if (members.length === 0) return false;
    
    const captain = members.find(m => m.crewRole === 'captain');
    if (!captain) return false;
    
    const crewData = {
        id: crewId,
        name: `Crew_${crewId.slice(-8)}`, // Fallback name
        captain: captain.userId,
        members: members.map(m => m.userId),
        createdAt: new Date(),
        invites: new Map()
    };
    
    crews.set(crewId, crewData);
    return true;
}

// Handle accept/decline commands
async function handleCrewResponse(message, user, accept) {
    // Find pending invite
    let pendingInvite = null;
    let inviteCrew = null;
    
    for (const [crewId, crew] of crews) {
        if (crew.invites.has(user.userId)) {
            pendingInvite = crew.invites.get(user.userId);
            inviteCrew = crew;
            break;
        }
    }
    
    if (!pendingInvite) {
        return message.reply('❌ You have no pending crew invitations.');
    }
    
    if (user.crewId) {
        return message.reply('❌ You are already in a crew!');
    }
    
    // Remove invite
    inviteCrew.invites.delete(user.userId);
    
    if (!accept) {
        return message.reply('❌ You declined the crew invitation.');
    }
    
    // Check if crew is still not full
    if (inviteCrew.members.length >= MAX_CREW_SIZE) {
        return message.reply('❌ The crew is now full.');
    }
    
    // Add to crew
    inviteCrew.members.push(user.userId);
    user.crewId = inviteCrew.id;
    user.crewRole = 'member';
    await user.save();
    
    return message.reply(`✅ You joined **${inviteCrew.name}**! Welcome aboard, pirate!`);
}

// Export the crews map so raids can access it
module.exports = { data, execute, crews, handleCrewResponse, MAX_CREW_SIZE };
