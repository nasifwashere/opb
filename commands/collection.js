const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const User = require('../db/models/User.js');

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

function getCardByUserInstance(instance) {
  return allCards.find(c => c.name === instance.cardName || c.name === instance.name);
}

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function cardEmbed(cardInstance, cardDef, ownerName, index, total, user) {
  if (!cardDef) {
    return new EmbedBuilder()
      .setTitle('Card not found')
      .setDescription('This card is missing from the database.');
  }
  let [power, health, speed] = cardDef.phs.split('/').map(x => Number(x.trim()));
  let level = cardInstance.level || cardInstance.timesUpgraded + 1 || 1;

  // Stat boost: If this card has strawhat equipped, boost stats regardless of the card
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
    .setFooter({ text: `#- _${ownerName}'s Collection | ${index + 1}/${total} (max is ${MAX_STORAGE} storage)` });

  if (cardDef.image && cardDef.image !== "placeholder" && /^https?:\/\//.test(cardDef.image)) {
    embed.setImage(cardDef.image);
  }
  if (rankSet.rankImage && /^https?:\/\//.test(rankSet.rankImage)) {
    embed.setThumbnail(rankSet.rankImage);
  }
  return embed;
}

function buildRow(cardIndex, totalCards) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('collection_prev')
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(cardIndex === 0),
    new ButtonBuilder()
      .setCustomId('collection_next')
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(cardIndex === totalCards - 1),
    new ButtonBuilder()
      .setCustomId('collection_info')
      .setLabel('Info')
      .setStyle(ButtonStyle.Primary)
  );
}

const data = { name: "collection", description: "View your card collection." };

async function execute(message, args) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });

  if (!user || !Array.isArray(user.cards)) {
    return message.reply("You have no cards!");
  }

  let cardInstances = user.cards.filter(ci => ci && typeof ci === 'object');
  if (cardInstances.length === 0) {
    return message.reply("You have no cards!");
  }

  const arg = (args[0] || "").toUpperCase();
  if (["S", "A", "B", "C", "UR"].includes(arg)) {
    cardInstances = cardInstances.filter(ci => {
      const card = getCardByUserInstance(ci);
      return card && card.rank && card.rank.toUpperCase() === arg;
    });
    if (cardInstances.length === 0) {
      return message.reply(`You have no cards of rank ${arg}!`);
    }
  }

  if (arg === "DOWN") {
    cardInstances.sort((a, b) => {
      const ca = getCardByUserInstance(a), cb = getCardByUserInstance(b);
      if (!ca || !cb) return 0;
      const [pa] = ca.phs.split('/').map(x => Number(x.trim()));
      const [pb] = cb.phs.split('/').map(x => Number(x.trim()));
      return pa - pb;
    });
  }

  let cardIndex = 0;
  const ownerName = message.author.username;
  const total = cardInstances.length;

  // Show first card
  const cardInstance = cardInstances[cardIndex];
  const cardDef = getCardByUserInstance(cardInstance);
  const embed = cardEmbed(cardInstance, cardDef, ownerName, cardIndex, total, user);
  const msg = await message.reply({ embeds: [embed], components: [buildRow(cardIndex, total)] });

  const filter = i => i.user.id === userId;
  const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

  collector.on('collect', async interaction => {
    await interaction.deferUpdate();
    if (interaction.customId === 'collection_prev' && cardIndex > 0) {
      cardIndex--;
    } else if (interaction.customId === 'collection_next' && cardIndex < total - 1) {
      cardIndex++;
    } else if (interaction.customId === 'collection_info') {
      await interaction.followUp({ content: 'Info command coming soon!', ephemeral: true });
      return;
    }
    const updatedCardInstance = cardInstances[cardIndex];
    const updatedCardDef = getCardByUserInstance(updatedCardInstance);
    const updatedEmbed = cardEmbed(updatedCardInstance, updatedCardDef, ownerName, cardIndex, total, user);
    await msg.edit({ embeds: [updatedEmbed], components: [buildRow(cardIndex, total)] });
  });

  collector.on('end', () => {
    msg.edit({ components: [] });
  });
}


module.exports = { data, execute };