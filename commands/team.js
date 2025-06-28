const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');

function buildTeamEmbed(teamCards, username, totalPower) {
  let fields = [];
  for (let i = 0; i < teamCards.length; i++) {
    const card = teamCards[i];
    const lockStatus = card.locked ? ' 🔒' : '';
    fields.push({
      name: `Lv. ${card.level} ${card.displayName}${lockStatus}`,
      value: `Card Power: ${card.calcPower}`, // Changed to show power instead of image
      inline: true,
    });
  }
  // Fill empty slots if less than 3
  while (fields.length < 3) {
    fields.push({
      name: "\u200b",
      value: "*(empty)*",
      inline: true,
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(`_${username}'s crew_`)
    .addFields(fields)
    .addFields([
      { name: "Total Power", value: `**${totalPower}**`, inline: false }
    ])
    .setColor(0xe67e22)
    .setFooter({ text: "Use op team add <card> to add crew members." });

  return embed;
}

const data = { name: 'team', description: 'Manage and view your crew.' };

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

async function execute(message, args) {
  const userId = message.author.id;
  const username = message.author.username;
  let [sub, ...rest] = args;
  sub = sub ? sub.toLowerCase() : "";

  let user = await User.findOne({ userId });
  if (!user) return message.reply("You need to start first! Use `op start`.");

  if (sub === "remove") {
    const cardName = rest.join(' ').trim();
    if (!cardName) return message.reply("Please specify a card to remove. Usage: `op team remove <card name>`");
    
    const normalizedInput = normalize(cardName);
    const originalTeam = [...(user.team || [])];
    user.team = user.team.filter(cardName => normalize(cardName) !== normalizedInput);
    
    if (user.team.length === originalTeam.length) {
      return message.reply(`Card not found in your team. Use \`op team\` to see your current team.`);
    }
    
    await user.save();
    return message.reply(`Removed **${cardName}** from your crew.`);
  }

  if (sub === "add") {
    const cardName = rest.join(' ').trim();
    if (!cardName) return message.reply("Please specify a card to add. Usage: `op team add <card name>`");
    
    if (!user.team) user.team = [];
    if (user.team.length >= 3) {
      return message.reply("Your crew is full! Remove a card first using `op team remove <card>`.");
    }

    const normalizedInput = normalize(cardName);
    const userCard = user.cards?.find(card => normalize(card.name) === normalizedInput);
    
    if (!userCard) {
      return message.reply(`You don't own **${cardName}**. Use \`op collection\` to see your cards.`);
    }

    if (user.team.some(teamCard => normalize(teamCard) === normalizedInput)) {
      return message.reply(`**${userCard.name}** is already in your crew.`);
    }

    user.team.push(userCard.name);
    await user.save();
    return message.reply(`Added **${userCard.name}** to your crew!`);
  }

  // Display team (default behavior)
  if (!user.team) user.team = [];
  
  const { calculateCardStats } = require('../utils/levelSystem.js');
  const teamCards = [];
  let totalPower = 0;

  for (const cardName of user.team) {
    const userCard = user.cards?.find(card => normalize(card.name) === normalize(cardName));
    if (userCard) {
      const stats = calculateCardStats(userCard);
      const cardData = {
        ...userCard,
        displayName: userCard.name,
        calcPower: stats.power,
        locked: userCard.locked || false,
        level: userCard.level || 1
      };
      teamCards.push(cardData);
      totalPower += stats.power;
    }
  }

  const embed = buildTeamEmbed(teamCards, username, totalPower);
  return message.reply({ embeds: [embed] });
}

module.exports = { data, execute };