const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder  } = require('discord.js');
const fs = require('fs');
const path = require('path');
const User = require('../db/models/User.js');
const Fuse = require('fuse.js');
const { calculateCardStats, XP_PER_LEVEL } = require('../utils/levelSystem.js');

const MAX_STORAGE = 250;

const rankSettings = {
  C: { color: 0x2ecc40, rankName: "C", rankImage: "https://files.catbox.moe/80exn1.png" },
  B: { color: 0x3498db, rankName: "B", rankImage: "https://files.catbox.moe/ta2g9o.png" },
  A: { color: 0x9b59b6, rankName: "A", rankImage: "https://files.catbox.moe/hcyso9.png" },
  S: { color: 0xe67e22, rankName: "S", rankImage: "https://files.catbox.moe/niidag.png" },
  UR: { color: 0xe74c3c, rankName: "UR", rankImage: "https://via.placeholder.com/32x32/e74c3c/ffffff?text=UR" }
};

const cardsPath = path.resolve('data', 'cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

// Setup Fuse.js for fuzzy searching
const fuse = new Fuse(allCards, {
  keys: ['name'],
  threshold: 0.3,
  ignoreLocation: true,
  findAllMatches: true,
  minMatchCharLength: 2,
});

function getCardByUserInstance(instance) {
  return allCards.find(c => c.name === instance.cardName || c.name === instance.name);
}

function cardEmbed(cardInstance, cardDef, ownerName, index = 0, total = 1, user, duplicateCount = 1) {
  if (!cardDef) {
    return new EmbedBuilder()
      .setTitle('Card not found')
      .setDescription('This card is missing from the database.');
  }

  const level = Math.max(1, cardInstance.level || (cardInstance.timesUpgraded ? cardInstance.timesUpgraded + 1 : 1));
  const experience = cardInstance.experience || 0;

  // Get stats with level bonuses applied
  let { power, health, speed } = calculateCardStats(cardDef, level);

  // Ensure stats are valid numbers
  power = (isNaN(power) || power === null || power === undefined) ? 10 : Math.floor(Number(power));
  health = (isNaN(health) || health === null || health === undefined) ? 50 : Math.floor(Number(health));
  speed = (isNaN(speed) || speed === null || speed === undefined) ? 30 : Math.floor(Number(speed));

  // Stat boost from equipped items
  let boostText = '';
  let normCard = normalize(cardDef.name);
  let equippedItem = user && user.equipped && user.equipped[normCard];

  if (equippedItem === 'strawhat') {
    power = Math.ceil(power * 1.3);
    health = Math.ceil(health * 1.3);
    speed = Math.ceil(speed * 1.3);
    boostText = "\n**Strawhat equipped! Stats boosted by 30%.**";
  }

  // Calculate attack range using damage multiplier system from battle
  const damageMultipliers = {
    C: 0.08,
    B: 0.10,
    A: 0.14,
    S: 0.17,
    UR: 0.20
  };

  const damageMultiplier = damageMultipliers[cardDef.rank] || 0.10;
  const baseDamage = power * damageMultiplier;
  const attackLow = Math.floor(baseDamage * 1.0);
  const attackHigh = Math.floor(baseDamage * 1.5);
  const rankSet = rankSettings[cardDef.rank] || {};
  const lockStatus = cardInstance.locked ? ' <:Padlock_Crown:1388587874084982956>' : '';
  const duplicateText = duplicateCount > 1 ? ` (x${duplicateCount})` : '';

  // Calculate XP progress to next level
  const xpForCurrentLevel = (level - 1) * XP_PER_LEVEL;
  const xpForNextLevel = level * XP_PER_LEVEL;
  const xpProgress = experience - xpForCurrentLevel;
  const xpNeeded = xpForNextLevel - xpForCurrentLevel;

  let desc = `**${cardDef.name}**${lockStatus}${duplicateText}\n${cardDef.shortDesc}\n\nOwner: ${ownerName}\nLevel: ${level} (${xpProgress}/${xpNeeded} XP)\nPower: ${power}\nHealth: ${health}\nSpeed: ${speed}\nAttack: ${attackLow}–${attackHigh}\nType: Combat${boostText}`;

  const embed = new EmbedBuilder()
    .setDescription(desc)
    .setFooter({ text: `#- _${ownerName}'s Card | ${index + 1}/${total} (max is ${MAX_STORAGE} storage)` })
    .setColor(rankSet.color || 0x5865f2);

  if (cardDef.image && cardDef.image !== "placeholder" && /^https?:\/\//.test(cardDef.image)) {
    embed.setImage(cardDef.image);
  }
  if (rankSet.rankImage && /^https?:\/\//.test(rankSet.rankImage)) {
    embed.setThumbnail(rankSet.rankImage);
  }
  return embed;
}

function buildRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('mycard_info')
      .setLabel('Info')
      .setStyle(ButtonStyle.Primary)
  );
}

const data = new SlashCommandBuilder()
  .setName('mycard')
  .setDescription('View detailed info about a specific card you own.');

async function execute(message, args) {
  if (args.length === 0) {
    return message.reply('Please specify the card name. Example: `op mycard Monkey D. Luffy`');
  }

  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });

  if (!user || !Array.isArray(user.cards) || user.cards.length === 0) {
    return message.reply("You don't own any cards yet.");
  }

  const cardNameInput = args.join(' ');

  // Fuzzy find the card definition in all cards
  const results = fuse.search(cardNameInput);
  if (results.length === 0) {
    return message.reply(`No card found matching "${cardNameInput}".`);
  }

  const cardDef = results[0].item;

  // Find all instances of this card the user owns
  const cardInstances = user.cards.filter(c => normalize(c.name) === normalize(cardDef.name));
  if (cardInstances.length === 0) {
    return message.reply(`You do not own the card **${cardDef.name}**.`);
  }

  // Use the highest level instance for display
  const cardInstance = cardInstances.reduce((highest, current) => {
    const currentLevel = current.level || 1;
    const highestLevel = highest.level || 1;
    return currentLevel > highestLevel ? current : highest;
  });

  // Show the card embed with buttons and duplicate count
  const embed = cardEmbed(cardInstance, cardDef, message.author.username, 0, 1, user, cardInstances.length);
  const msg = await message.reply({ embeds: [embed], components: [buildRow()] });

  const filter = i => i.user.id === userId;
  const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

  collector.on('collect', async interaction => {
    await interaction.deferUpdate();

    if (interaction.customId === 'mycard_info') {
      const level = Math.max(1, cardInstance.level || (cardInstance.timesUpgraded ? cardInstance.timesUpgraded + 1 : 1));
      
      // Parse stats safely
      let power, health, speed;
      try {
        [power, health, speed] = cardDef.phs.split('/').map(x => {
          const parsed = Number(x.trim());
          return isNaN(parsed) ? 10 : parsed;
        });
      } catch (error) {
        power = 10;
        health = 50;
        speed = 30;
      }

      let normCard = normalize(cardDef.name);
      let equippedItem = user && user.equipped && user.equipped[normCard];
      let boostText = '';

      if (equippedItem === 'strawhat') {
        power = Math.round(power * 1.3);
        health = Math.round(health * 1.3);
        speed = Math.round(speed * 1.3);
        boostText = '\n**Equipment**: Strawhat (+30% all stats)';
      }

      const rankMultipliers = {
        'C': 0.08,
        'B': 0.10,
        'A': 0.14,
        'S': 0.17,
        'UR': 0.20
      };

      const multiplier = rankMultipliers[cardDef.rank] || 0.10;
      const baseDamage = power * multiplier;
      const minDamage = Math.floor(baseDamage * 1.0);
      const maxDamage = Math.floor(baseDamage * 1.5);

      const infoText = `**${cardDef.name}** (${cardDef.rank})\n` +
        `${cardDef.shortDesc}\n\n` +
        `**Stats (Level ${level})**\n` +
        `Power: ${power}\n` +
        `Health: ${health}\n` +
        `Speed: ${speed}\n\n` +
        `**Combat**\n` +
        `Damage Range: ${minDamage} - ${maxDamage}\n` +
        `Damage Multiplier: ${multiplier}x\n` +
        `Lock Status: ${cardInstance.locked ? '<:Padlock_Crown:1388587874084982956> Locked' : '<:unlocked_IDS:1388596601064390656> Unlocked'}${boostText}\n\n` +
        `**Evolution**\n` +
        `${cardDef.evolution ? `Next: ${cardDef.evolution.nextId} (Level ${cardDef.evolution.requiredLevel})` : 'Max evolution reached'}`;

      await interaction.followUp({ content: infoText, ephemeral: true });
    }
  });

  collector.on('end', () => {
    msg.edit({ components: [] });
  });
}

module.exports = { data, execute };