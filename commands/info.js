const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder  } = require('discord.js');
const fs = require('fs');
const path = require('path');
const User = require('../db/models/User.js');

// Load card data
const cardsPath = path.resolve('data', 'cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

// Rank settings for border/rarity visuals
const rankSettings = {
  C: { color: 0x2b2d31, rankName: "C" },
  B: { color: 0x2b2d31, rankName: "B" },
  A: { color: 0x2b2d31, rankName: "A" },
  S: { color: 0x2b2d31, rankName: "S" },
  UR: { color: 0x2b2d31, rankName: "UR" }
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
  
  return `**Attack** ${attackLow} - ${attackHigh} (Power: ${power})`;
}

// Compute evolution requirements from matrix and data
function getEvolutionRequirements(card) {
  let next = allCards.find(c => c.evolvesFrom === card.name);
  if (!next) return "No further evolutions available.";
  
  const rule = evoMatrix.find(row =>
      row.from === card.rank && row.to === next.rank
  );
  
  let reqs = [];
  if (rule) {
    reqs.push(`**Level Required** ${rule.level}`);
    reqs.push(`**Cost** ${rule.cost} Beli`);
  }
  if (next.rank) reqs.push(`**Next Rank** ${next.rank}`);
  if (next.saga) reqs.push(`**Saga** ${next.saga}`);
  
  return [
    `**Upgrade to [${next.rank}] ${next.name}**`,
    '',
    ...reqs
  ].join("\n");
}

// Build info embed
function infoEmbed(card, ownedCount, userCard) {
  let level = userCard?.level || userCard?.timesUpgraded + 1 || 1;
  if (!level) level = 1;
  const lockStatus = userCard?.locked ? ' 🔒' : '';
  
  const embed = new EmbedBuilder()
    .setTitle(`[${card.rank}] ${card.name}${lockStatus}`)
    .setDescription(card.shortDesc)
    .setColor(0x2b2d31)
    .addFields(
      { name: 'Level', value: `${level}`, inline: true },
      { name: 'Owned', value: ownedCount === 0 ? 'Not owned' : `${ownedCount}`, inline: true },
      { name: 'Stats', value: attackRange(card.phs, card.rank), inline: false }
    )
    .setFooter({ text: `Card Information • ${card.rank} Rank` });

  if (card.image && card.image !== "placeholder") {
    embed.setImage(card.image);
  }

  return embed;
}

// Evolution nav buttons
function buildRow(prev, canEvolve, next) {
  const buttons = [
    new ButtonBuilder()
      .setCustomId('evo_prev')
      .setLabel('Previous Evolution')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!prev),
    new ButtonBuilder()
      .setCustomId('evo_req')
      .setLabel('Upgrade Requirements')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!canEvolve),
    new ButtonBuilder()
      .setCustomId('evo_next')
      .setLabel('Next Evolution')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!next)
  ];
  return new ActionRowBuilder().addComponents(buttons);
}

const data = new SlashCommandBuilder()
  .setName('info')
  .setDescription('View a card');

async function execute(message, args) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });

  if (!user) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription('Start your journey with `op start` first!')
      .setFooter({ text: 'Use op start to begin your adventure' });
    
    return message.reply({ embeds: [embed] });
  }

  // Ensure username is set if missing
  if (!user.username) {
    user.username = username;
    await user.save();
  }

  const query = args.join(' ').trim();
  if (!query) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle('Card Information')
      .setDescription('View detailed information about any card.')
      .addFields({
        name: 'Usage',
        value: '`op info <card name>`',
        inline: false
      })
      .setFooter({ text: 'Search for any card by name' });
    
    return message.reply({ embeds: [embed] });
  }

  let card = fuzzyFindCard(query);
  if (!card) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription('Card not found! Check the name or spelling.')
      .setFooter({ text: 'Make sure the card name is correct' });
    
    return message.reply({ embeds: [embed] });
  }

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
      const reqEmbed = new EmbedBuilder()
        .setTitle('Evolution Requirements')
        .setDescription(getEvolutionRequirements(card))
        .setColor(0x2b2d31)
        .setFooter({ text: 'Requirements for next evolution' });
      
      await interaction.followUp({
        embeds: [reqEmbed],
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