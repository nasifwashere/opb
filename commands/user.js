const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

const data = new SlashCommandBuilder()
  .setName('user')
  .setDescription('View your profile or another user\'s stats and rankings.');

async function execute(message, args, client) {
  const userId = message.author.id;
  const username = message.author.username;
  
  // Check if user mentioned someone else
  const mentionedUser = message.mentions.users.first();
  const targetUserId = mentionedUser ? mentionedUser.id : userId;
  const targetUsername = mentionedUser ? mentionedUser.username : username;

  let user = await User.findOne({ userId: targetUserId });

  if (!user) {
    const embed = new EmbedBuilder()
      .setColor('#1a1a1a')
      .setTitle('Profile Not Found')
      .setDescription(mentionedUser ? 
        `**${mentionedUser.username}** hasn't started their journey yet.` : 
        'Start your journey with `op start` first.')
      .setFooter({ text: 'Use op start to begin your adventure' });
    
    return message.reply({ embeds: [embed] });
  }

  // Initialize missing fields with defaults
  if (typeof user.bounty !== 'number') user.bounty = 0;
  if (typeof user.beli !== 'number') user.beli = 0;
  if (typeof user.wins !== 'number') user.wins = 0;

  // Calculate global rankings
  const beliRank = await User.countDocuments({ beli: { $gt: user.beli } }) + 1;
  const winsRank = await User.countDocuments({ wins: { $gt: user.wins } }) + 1;
  const bountyRank = await User.countDocuments({ bounty: { $gt: user.bounty } }) + 1;

  // Find most used card (main card)
  let mostUsedCard = 'None';
  if (user.team && user.team.length > 0) {
    // The first card in team is considered the main card
    mostUsedCard = user.team[0];
  } else if (user.cards && user.cards.length > 0) {
    // If no team set, find highest level card
    const highestLevelCard = user.cards.reduce((max, card) => 
      (card.level || 1) > (max.level || 1) ? card : max
    );
    mostUsedCard = highestLevelCard.name;
  }

  // Get crew information
  let crewInfo = 'Independent Pirate';
  if (user.crew) {
    crewInfo = user.crew;
  }

  // Fix user level if needed and get progress
  const { getUserLevelProgress, fixUserLevel } = require('../utils/userLevelSystem.js');
  const levelFixed = fixUserLevel(user);
  if (levelFixed) {
    await user.save(); // Save corrected level
  }
  const levelProgress = getUserLevelProgress(user);
  
  // Create level progress bar
  const progressBarLength = 10;
  const filledBars = Math.floor((levelProgress.progress / 100) * progressBarLength);
  const emptyBars = progressBarLength - filledBars;
  const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);
  
  // Create profile embed with modern design
  const embed = new EmbedBuilder()
    .setTitle(`${user.username || targetUsername}`)
    .setColor('#2f3136')
    .setDescription(`Pirate Profile • Level ${levelProgress.level}\n${progressBar} ${levelProgress.progress}% (${levelProgress.currentXP}/${1000} XP)`)
    .addFields(
      {
        name: 'Wealth',
        value: `**${user.beli.toLocaleString()}** Beli\nRank: **#${beliRank}**`,
        inline: true
      },
      {
        name: 'Combat Record',
        value: `**${user.wins}** Victories\nRank: **#${winsRank}**`,
        inline: true
      },
      {
        name: 'Bounty',
        value: `**${user.bounty.toLocaleString()}**\nRank: **#${bountyRank}**`,
        inline: true
      },
      {
        name: 'Crew Status',
        value: crewInfo,
        inline: true
      },
      {
        name: 'Main Character',
        value: mostUsedCard,
        inline: true
      },
      {
        name: 'Statistics',
        value: `Cards: **${user.cards ? user.cards.length : 0}**\nDefeats: **${user.losses || 0}**`,
        inline: true
      }
    )
    .setFooter({ 
      text: mentionedUser ? 
        `Profile for ${targetUsername}` : 
        'Use op user @player to view someone else\'s profile'
    })
    .setTimestamp();

  // Set profile picture if available
  try {
    let discordUser;
    if (mentionedUser) {
      discordUser = mentionedUser;
    } else {
      discordUser = client.users.cache.get(targetUserId);
      if (!discordUser) {
        discordUser = await client.users.fetch(targetUserId).catch(() => null);
      }
    }
    
    if (discordUser && discordUser.displayAvatarURL) {
      embed.setThumbnail(discordUser.displayAvatarURL({ dynamic: true, size: 256 }));
    }
  } catch (error) {
    console.log('Could not fetch user avatar:', error.message);
  }

  return message.reply({ embeds: [embed] });
}

module.exports = { data, execute };