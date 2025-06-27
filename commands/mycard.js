const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const User = require('../db/models/User.js');
const Fuse = require('fuse.js');

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

function cardEmbed(cardInstance, cardDef, ownerName, index = 0, total = 1, user) {
  if (!cardDef) {
    return new EmbedBuilder()
      .setTitle('Card not found')
      .setDescription('This card is missing from the database.');
  }
  let [power, health, speed] = cardDef.phs.split('/').map(x => Number(x.trim()));
  let level = cardInstance.level || cardInstance.timesUpgraded + 1 || 1;

  // Stat boost from equipped items
  let boostText = '';
  let normCard = normalize(cardDef.name);
  let equippedItem = user && user.equipped && user.equipped[normCard];

  if (equippedItem === 'strawhat') {
    power = Math.round(power * 1.3);
    health = Math.round(health * 1.3);
    speed = Math.round(speed * 1.3);
    boostText = "\n**Strawhat equipped! Stats boosted by 30%.**";
  }

  const attackLow = Math.floor(power / 5);
  const attackHigh = Math.floor(power / 3);
  const rankSet = rankSettings[cardDef.rank] || {};
  const lockStatus = cardInstance.locked ? ' 🔒' : '';
  let desc = `**${cardDef.name}**${lockStatus}\n${cardDef.shortDesc}\n\nOwner: ${ownerName}\nLevel: ${level}\nPower: ${power}\nHealth: ${health}\nSpeed: ${speed}\nAttack: ${attackLow}–${attackHigh}\nType: Combat${boostText}`;

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

const data = { name: "mycard", description: "View detailed info about a specific card you own." };

async function execute(message, args) {
  if (args.length === 0) {
    return message.reply('Please specify the card name. Example: `op mycard Monkey D. Luffy`');
  }

  const userId = message.author.id;
  const user = await User.findOne({ userId });

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

  // Find the card instance the user owns (exact match normalized)
  const cardInstance = user.cards.find(c => normalize(c.name) === normalize(cardDef.name));
  if (!cardInstance) {
    return message.reply(`You do not own the card **${cardDef.name}**.`);
  }

  // Show the card embed with buttons
  const embed = cardEmbed(cardInstance, cardDef, message.author.username, 0, 1, user);
  const msg = await message.reply({ embeds: [embed], components: [buildRow()] });

  const filter = i => i.user.id === userId;
  const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

  collector.on('collect', async interaction => {
    await interaction.deferUpdate();

    if (interaction.customId === 'mycard_info') {
      const level = cardInstance.level || cardInstance.timesUpgraded + 1 || 1;
      let [power, health, speed] = cardDef.phs.split('/').map(x => Number(x.trim()));

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
        `Lock Status: ${cardInstance.locked ? '🔒 Locked' : '🔓 Unlocked'}${boostText}\n\n` +
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
