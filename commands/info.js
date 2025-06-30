const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const User = require('../db/models/User.js');

// Load card data
const cardsPath = path.resolve('data', 'cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

// Rank settings for border/rarity visuals
const rankSettings = {
  C: { color: 0x2ecc40, rankName: "C", rankImage: "https://files.catbox.moe/80exn1.png" },
  B: { color: 0x3498db, rankName: "B", rankImage: "https://files.catbox.moe/ta2g9o.png" },
  A: { color: 0x9b59b6, rankName: "A", rankImage: "https://files.catbox.moe/hcyso9.png" },
  S: { color: 0xe67e22, rankName: "S", rankImage: "https://files.catbox.moe/niidag.png" },
  UR: { color: 0xe74c3c, rankName: "UR", rankImage: "https://via.placeholder.com/32x32/e74c3c/ffffff?text=UR" }
};

// Evolution requirements matrix
const evoMatrix = [
  { from: "C", to: "B", cost: 250, level: 5 },
  { from: "B", to: "A", cost: 1000, level: 25 },
  { from: "A", to: "S", cost: 2500, level: 30 },
  { from: "S", to: "UR", cost: 30000, level: 90 },
  { from: "C", to: "A", cost: 1000, level: 50 },
  { from: "B", to: "S", cost: 2500, level: 60 }
];

// Fuzzy search for card by name (case-insensitive, partial)
function fuzzyFindCard(query) {
  let card = allCards.find(c => c.name.toLowerCase() === query.toLowerCase());
  if (card) return card;
  card = allCards.find(c => c.name.toLowerCase().includes(query.toLowerCase()));
  if (card) return card;
  card = allCards.find(c => c.name.replace(/\s+/g, '').toLowerCase().includes(query.replace(/\s+/g, '').toLowerCase()));
  return card;
}

// Evolution navigation helpers
function getEvolutionChain(card) {
  let prev = null;
  if (card.evolvesFrom) {
    prev = allCards.find(c => c.name === card.evolvesFrom);
  }
  let next = allCards.find(c => c.evolvesFrom === card.name) || null;
  return { prev, next };
}

// Compute attack range from power stat using battle system
function attackRange(phs, rank) {
  let power = parseInt((phs || "0").split('/')[0].trim(), 10);
  if (isNaN(power)) power = 0;
  
  const damageMultipliers = {
    C: 0.08,
    B: 0.10,
    A: 0.14,
    S: 0.17,
    UR: 0.20
  };
  
  const damageMultiplier = damageMultipliers[rank] || 0.10;
  const baseDamage = power * damageMultiplier;
  const attackLow = Math.floor(baseDamage * 1.0);
  const attackHigh = Math.floor(baseDamage * 1.5);
  
  return `🗡️ Attack: ${attackLow} ~ ${attackHigh} (Power: ${power})`;
}

// Compute evolution requirements from matrix and data
function getEvolutionRequirements(card) {
  let next = allCards.find(c => c.evolvesFrom === card.name);
  if (!next) return "No further evolutions.";
  // Check matrix for cost/level, fallback to unknown if not found
  const rule = evoMatrix.find(row =>
      row.from === card.rank && row.to === next.rank
  );
  let reqs = [];
  if (next.saga) reqs.push(`📍 Saga: ${next.saga}`);
  if (next.rank) reqs.push(`<:snoopy_sparkles:1388585338821152978> Next Rank: ${next.rank}`);
  if (rule) {
    reqs.unshift(`<:Money:1375579299565928499> Cost: ${rule.cost} Beli`);
    reqs.unshift(`<:snoopy_sparkles:1388585338821152978> Level Required: ${rule.level}`);
  }
  return [
    `<:snoopy_sparkles:1388585338821152978> Upgrade to [${next.rank}] ${next.name}`,
    ...reqs
  ].join("\n");
}

// Build info embed
function infoEmbed(card, ownedCount, userCard) {
  const rankSet = rankSettings[card.rank] || {};
  let level = userCard?.level || userCard?.timesUpgraded + 1 || 1;
  if (!level) level = 1;
  const lockStatus = userCard?.locked ? ' <:Padlock_Crown:1388587874084982956>' : '';
  let title = `**[${card.rank}] ${card.name}${lockStatus} - Lv. ${level}**`;
  let desc = `${card.shortDesc}\n${attackRange(card.phs, card.rank)}`;
  if (ownedCount === 0) desc += "\n\n*You do not own this card. Use `op pull` or trade to obtain it.*";

  const embed = new EmbedBuilder()
    .setColor(rankSet.color)
    .setTitle(title)
    .setDescription(desc)
    .setFooter({ text: `Card: ${card.name} • Owned x${ownedCount || 0}` });

  if (card.image && card.image !== "placeholder") embed.setImage(card.image);
  if (rankSet.rankImage) embed.setThumbnail(rankSet.rankImage);

  return embed;
}

// Evolution nav buttons
function buildRow(prev, canEvolve, next) {
  const buttons = [
    new ButtonBuilder()
      .setCustomId('evo_prev')
      .setLabel('⬅ Previous Evolution')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!prev),
    new ButtonBuilder()
      .setCustomId('evo_req')
      .setLabel('View Upgrade Requirements')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!canEvolve),
    new ButtonBuilder()
      .setCustomId('evo_next')
      .setLabel('Next Evolution ')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!next)
  ];
  return new ActionRowBuilder().addComponents(buttons);
}

const data = { name: "info", description: "View a card's detailed profile." };

async function execute(message, args) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });

  if (!user) {
    return message.reply('Start your journey with `op start` first!');
  }

  // Ensure username is set if missing
  if (!user.username) {
    user.username = username;
    await user.save();
  }

  const query = args.join(' ').trim();
  if (!query) return message.reply('Usage: `op info <card name or ID>`');

  let card = fuzzyFindCard(query);
  if (!card) return message.reply("Card not found! Check the name or spelling.");

  // Get evolution navigation
  let { prev, next } = getEvolutionChain(card);

  // Check user ownership
  const ownedCards = user?.cards?.filter(c => c.name === card.name) ?? [];
  const ownCard = ownedCards[0];
  const ownerCount = ownedCards.length;

  let embed = infoEmbed(card, ownerCount, ownCard);
  let msg = await message.reply({
    embeds: [embed],
    components: [buildRow(prev, !!next, next)]
  });

  const filter = i => i.user.id === userId;
  const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

  collector.on('collect', async interaction => {
    await interaction.deferUpdate();

    if (interaction.customId === 'evo_prev' && prev) {
      card = prev;
      ({ prev, next } = getEvolutionChain(card));
    } else if (interaction.customId === 'evo_next' && next) {
      card = next;
      ({ prev, next } = getEvolutionChain(card));
    }

    // Evolution button (requirements)
    if (interaction.customId === 'evo_req') {
      await interaction.followUp({
        content: "```yaml\n" + getEvolutionRequirements(card) + "\n```",
        ephemeral: true
      });
      return;
    }

    // Re-check ownership for new card in chain
    const ownedCards = user?.cards?.filter(c => c.name === card.name) ?? [];
    const ownCard = ownedCards[0];
    const ownerCount = ownedCards.length;

    const newEmbed = infoEmbed(card, ownerCount, ownCard);
    await msg.edit({
      embeds: [newEmbed],
      components: [buildRow(prev, !!next, next)]
    });
  });

  collector.on('end', () => {
    msg.edit({ components: [] }).catch(() => {});
  });
}


module.exports = { data, execute };