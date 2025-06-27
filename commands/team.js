const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');

// Load card definitions
const cardsPath = path.resolve('data', 'cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

// Rank multipliers
const rankMultiplier = { C: 1.0, B: 1.2, A: 1.4, S: 1.6, UR: 2.0 };

// Find card definition by name (case-insensitive)
function findCardDef(name) {
  return allCards.find(
    c => c.name.toLowerCase() === name.toLowerCase()
  );
}

// Find user's card instance by name (first match)
function findUserCardInstance(user, name) {
  return user.cards?.find(
    c => c.name.toLowerCase() === name.toLowerCase()
  );
}

// Calculate power
function calcCardPower(cardDef, level) {
  const base = parseInt((cardDef.phs || "0").split('/')[0].trim(), 10) || 0;
  const rankMul = rankMultiplier[cardDef.rank] || 1.0;
  return Math.floor((base + level * 2) * rankMul);
}

function getTeamCards(user) {
  if (!user.team?.length) return [];
  return user.team.map(cardName => {
    const userCard = findUserCardInstance(user, cardName);
    const cardDef = findCardDef(cardName);
    if (!userCard || !cardDef) return null;
    return {
      ...userCard,
      image: cardDef.image,
      rank: cardDef.rank,
      basePower: parseInt((cardDef.phs || "0").split('/')[0].trim(), 10) || 0,
      calcPower: calcCardPower(cardDef, userCard.level || 1),
      displayName: cardDef.name
    };
  }).filter(Boolean);
}

// "Crew" embed, formatted like your screenshot (as close as possible with embeds)
function buildTeamEmbed(teamCards, username, totalPower) {
  let fields = [];
  for (let i = 0; i < teamCards.length; i++) {
    const card = teamCards[i];
    const lockStatus = card.locked ? ' 🔒' : '';
    fields.push({
      name: `Lv. ${card.level} ${card.displayName}${lockStatus}`,
      value: `[Card Image](${card.image})`,
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

  // The first card is the "center" and gets the thumbnail image
  const embed = new EmbedBuilder()
    .setTitle(`_${username}'s crew_`)
    .addFields(fields)
    .addFields([
      { name: "Total Power", value: `**${totalPower}**`, inline: false }
    ])
    .setColor(0xe67e22)
    .setFooter({ text: "Use op team add <card> to add crew members." });

  // Show the center card image as the main image, if it exists
  if (teamCards[1]?.image) embed.setImage(teamCards[1].image);
  // Show the left card as thumbnail if it exists
  if (teamCards[0]?.image) embed.setThumbnail(teamCards[0].image);

  return embed;
}

const data = {
  name: 'team',
  description: 'Manage and view your crew.',
};

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function fuzzyMatch(query, target) {
  const normalizedQuery = normalize(query);
  const normalizedTarget = normalize(target);
  return normalizedTarget.includes(normalizedQuery) || normalizedQuery.includes(normalizedTarget);
}

async function execute(message, args) {
  const userId = message.author.id;
  const username = message.author.username;
  let [sub, ...rest] = args;
  sub = sub ? sub.toLowerCase() : "";

  // Load user
  let user = await User.findOne({ userId });
  if (!user) return message.reply("You need to start first! Use `op start`.");

  // --- View team (no subcommand) ---
  if (!sub) {
    const teamCards = getTeamCards(user);
    if (teamCards.length === 0) {
      return message.reply("You don't have any cards in your crew! Use `op team add <card>` to add.");
    }
    const totalPower = teamCards.reduce((sum, c) => sum + c.calcPower, 0);

    // Build embed
    const embed = buildTeamEmbed(teamCards, username, totalPower);

    // "View Boosts" button
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("View Boosts")
        .setCustomId("view_boosts")
        .setStyle(ButtonStyle.Primary)
    );
    const sentMsg = await message.reply({ embeds: [embed], components: [row] });

    // Button collector
    const filter = i => i.user.id === userId;
    const collector = sentMsg.createMessageComponentCollector({ filter, time: 60000 });
    collector.on('collect', async interaction => {
      if (interaction.customId === "view_boosts") {
        await interaction.reply({ content: "Coming Soon!", ephemeral: true });
      }
    });
    collector.on('end', () => sentMsg.edit({ components: [] }).catch(() => {}));
    return;
  }

  // --- Add card to team ---
  if (sub === "add") {
    const cardName = rest.join(' ').trim();
        const userCard = user.cards?.find(c => fuzzyMatch(cardName, c.name || c.cardName));
    if (!userCard) return message.reply("You do not own that card.");
    if (user.team?.some(n => n.toLowerCase() === userCard.name.toLowerCase()))
      return message.reply("That card is already in your crew!");
    if (user.team?.length >= 3) return message.reply("Your crew is already full!");

    user.team = user.team || [];
    user.team.push(userCard.name);
    await user.save();
    return message.reply(`Added **${userCard.name}** to your crew!`);
  }

  // --- Remove card from team ---
  if (sub === "remove") {
    const cardName = rest.join(' ').trim();
       const teamIndex = user.team.findIndex(t => fuzzyMatch(cardName, t.name || t.cardName));
    if (!teamIndex) return message.reply("That card isn't in your crew!");

    user.team = user.team.filter(n => n.toLowerCase() !== cardName.toLowerCase());
    await user.save();
    return message.reply(`Removed **${cardName}** from your crew.`);
  }

  // --- Invalid subcommand ---
  return message.reply("Invalid subcommand. Use `op team`, `op team add <card>`, or `op team remove <card>`.");
}


module.exports = { data, execute };