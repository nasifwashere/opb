const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');

// Add crew schema to User model
const crewInvites = new Map();

const data = new SlashCommandBuilder()
  .setName('crew')
  .setDescription('Manage your pirate crew')
  .addSubcommand(subcommand =>
    subcommand
      .setName('create')
      .setDescription('Create a new pirate crew')
      .addStringOption(option =>
        option.setName('name')
          .setDescription('Name of your crew')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('invite')
      .setDescription('Invite a user to your crew')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to invite')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('join')
      .setDescription('Join a crew (if you have an invite)'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('leave')
      .setDescription('Leave your current crew'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('info')
      .setDescription('View crew information'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('kick')
      .setDescription('Kick a member from your crew')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to kick')
          .setRequired(true)));

async function execute(message, args, client) {
  const userId = message.author.id;
  let user = await User.findOne({ userId });

  if (!user) {
    return message.reply('Start your journey with `op start` first!');
  }

  const subcommand = args[0];

  switch (subcommand) {
    case 'create':
      await handleCreate(message, user, args.slice(1));
      break;
    case 'invite':
      await handleInvite(message, user, client);
      break;
    case 'join':
      await handleJoin(message, user);
      break;
    case 'leave':
      await handleLeave(message, user);
      break;
    case 'info':
      await handleInfo(message, user);
      break;
    case 'kick':
      await handleKick(message, user, client);
      break;
    default:
      await handleInfo(message, user);
  }
}

async function handleCreate(message, user, args) {
  if (user.crewId) {
    return message.reply('You are already in a crew! Leave your current crew first.');
  }

  const crewName = args.join(' ');
  if (!crewName || crewName.length < 3 || crewName.length > 30) {
    return message.reply('Crew name must be between 3 and 30 characters!');
  }

  // Check if crew name is taken
  const existingCrew = await User.findOne({ 'crewData.name': crewName });
  if (existingCrew) {
    return message.reply('That crew name is already taken!');
  }

  // Create crew
  user.crewId = user.userId; // Captain's ID becomes crew ID
  user.crewData = {
    name: crewName,
    captain: user.userId,
    members: [user.userId],
    treasury: 0,
    level: 1,
    createdAt: new Date()
  };

  await user.save();

  const embed = new EmbedBuilder()
    .setTitle('🏴‍☠️ Crew Created!')
    .setDescription(`**${crewName}** has been established!`)
    .addFields(
      { name: 'Captain', value: message.author.username, inline: true },
      { name: 'Members', value: '1', inline: true },
      { name: 'Treasury', value: '0 Beli', inline: true }
    )
    .setColor(0x1e90ff);

  await message.reply({ embeds: [embed] });
}

async function handleInvite(message, user) {
  if (!user.crewId || !user.crewData) {
    return message.reply('You need to be in a crew to invite others!');
  }

  if (user.crewData.captain !== user.userId) {
    return message.reply('Only the captain can invite new members!');
  }

  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return message.reply('Please mention a user to invite!');
  }

  if (targetUser.id === user.userId) {
    return message.reply('You cannot invite yourself!');
  }

  const target = await User.findOne({ userId: targetUser.id });
  if (!target) {
    return message.reply('That user needs to start their journey first!');
  }

  if (target.crewId) {
    return message.reply('That user is already in a crew!');
  }

  if (user.crewData.members.length >= 10) {
    return message.reply('Your crew is full! (Max 10 members)');
  }

  // Create invite
  const inviteId = `${user.crewId}_${targetUser.id}_${Date.now()}`;
  crewInvites.set(inviteId, {
    crewId: user.crewId,
    crewName: user.crewData.name,
    captain: user.username,
    targetId: targetUser.id,
    expiresAt: Date.now() + 300000 // 5 minutes
  });

  const embed = new EmbedBuilder()
    .setTitle('🏴‍☠️ Crew Invitation')
    .setDescription(`**${user.username}** has invited you to join **${user.crewData.name}**!`)
    .addFields(
      { name: 'Captain', value: user.username, inline: true },
      { name: 'Members', value: user.crewData.members.length.toString(), inline: true }
    )
    .setColor(0xffa500)
    .setFooter({ text: 'Invitation expires in 5 minutes' });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`crew_accept_${inviteId}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`crew_decline_${inviteId}`)
        .setLabel('Decline')
        .setStyle(ButtonStyle.Danger)
    );

  const inviteMessage = await message.reply({
    content: `${targetUser}, you have a crew invitation!`,
    embeds: [embed],
    components: [row]
  });

  // Handle responses
  const filter = i => i.user.id === targetUser.id;
  const collector = inviteMessage.createMessageComponentCollector({ filter, time: 300000 });

  collector.on('collect', async interaction => {
    await interaction.deferUpdate();

    const invite = crewInvites.get(inviteId);
    if (!invite || invite.expiresAt < Date.now()) {
      return await interaction.followUp({ content: 'This invitation has expired.', ephemeral: true });
    }

    if (interaction.customId.includes('accept')) {
      // Add to crew
      const captain = await User.findOne({ userId: invite.crewId });
      const newMember = await User.findOne({ userId: targetUser.id });

      if (newMember.crewId) {
        return await interaction.followUp({ content: 'You are already in a crew!', ephemeral: true });
      }

      newMember.crewId = invite.crewId;
      captain.crewData.members.push(targetUser.id);

      await Promise.all([captain.save(), newMember.save()]);

      const successEmbed = new EmbedBuilder()
        .setTitle('🎉 Welcome to the Crew!')
        .setDescription(`${targetUser.username} has joined **${invite.crewName}**!`)
        .setColor(0x00ff00);

      await inviteMessage.edit({ embeds: [successEmbed], components: [] });
    } else {
      const declineEmbed = new EmbedBuilder()
        .setTitle('❌ Invitation Declined')
        .setDescription(`${targetUser.username} declined the crew invitation.`)
        .setColor(0xff0000);

      await inviteMessage.edit({ embeds: [declineEmbed], components: [] });
    }

    crewInvites.delete(inviteId);
    collector.stop();
  });
}

async function handleInfo(message, user) {
  if (!user.crewId) {
    return message.reply('You are not in a crew! Use `op crew create <name>` to start one.');
  }

  const captain = await User.findOne({ userId: user.crewId });
  if (!captain || !captain.crewData) {
    return message.reply('Crew data not found!');
  }

  // Get all crew members
  const memberIds = captain.crewData.members;
  const members = await User.find({ userId: { $in: memberIds } });

  const embed = new EmbedBuilder()
    .setTitle(`🏴‍☠️ ${captain.crewData.name}`)
    .addFields(
      { name: 'Captain', value: captain.username, inline: true },
      { name: 'Members', value: members.length.toString(), inline: true },
      { name: 'Treasury', value: `${captain.crewData.treasury || 0} Beli`, inline: true },
      { name: 'Crew Level', value: captain.crewData.level.toString(), inline: true },
      {
        name: 'Member List',
        value: members.map(m => `• ${m.username}${m.userId === captain.userId ? ' (Captain)' : ''}`).join('\n') || 'No members',
        inline: false
      }
    )
    .setColor(0x1e90ff)
    .setFooter({ text: `Created ${captain.crewData.createdAt.toDateString()}` });

  await message.reply({ embeds: [embed] });
}

async function handleLeave(message, user) {
  if (!user.crewId) {
    return message.reply('You are not in a crew!');
  }

  const captain = await User.findOne({ userId: user.crewId });

  if (user.userId === captain.userId) {
    return message.reply('Captains cannot leave their crew! Transfer leadership or disband the crew first.');
  }

  // Remove from crew
  captain.crewData.members = captain.crewData.members.filter(id => id !== user.userId);
  user.crewId = null;

  await Promise.all([captain.save(), user.save()]);

  await message.reply(`You have left **${captain.crewData.name}**. Fair winds!`);
}

async function handleKick(message, user) {
  if (!user.crewId || !user.crewData) {
    return message.reply('You need to be in a crew to kick members!');
  }

  if (user.crewData.captain !== user.userId) {
    return message.reply('Only the captain can kick members!');
  }

  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return message.reply('Please mention a user to kick!');
  }

  if (targetUser.id === user.userId) {
    return message.reply('You cannot kick yourself!');
  }

  if (!user.crewData.members.includes(targetUser.id)) {
    return message.reply('That user is not in your crew!');
  }

  // Remove from crew
  user.crewData.members = user.crewData.members.filter(id => id !== targetUser.id);

  const kickedUser = await User.findOne({ userId: targetUser.id });
  if (kickedUser) {
    kickedUser.crewId = null;
    await kickedUser.save();
  }

  await user.save();

  await message.reply(`${targetUser.username} has been removed from the crew.`);
}

module.exports = { data, execute };