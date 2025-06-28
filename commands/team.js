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
    user.team = user.team.filter(n => n.toLowerCase() !== cardName.toLowerCase());
    await user.save();
    return message.reply(`Removed **${cardName}** from your crew.`);
  }

  // more code for your command handling continues...

  return message.reply("Invalid subcommand. Use `op team`, `op team add <card>`, or `op team remove <card>`.");
}

module.exports = { data, execute };