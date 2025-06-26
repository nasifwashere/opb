const User = require('../db/models/User.js');
const { EmbedBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

// --- Rank settings and weights ---
const rankSettings = {
  C: { color: 0x2ecc40, rankName: "C", rankImage: "https://files.catbox.moe/80exn1.png" },
  B: { color: 0x3498db, rankName: "B", rankImage: "https://files.catbox.moe/ta2g9o.png" },
  A: { color: 0x9b59b6, rankName: "A", rankImage: "https://files.catbox.moe/hcyso9.png" },
  S: { color: 0xe67e22, rankName: "S", rankImage: "https://files.catbox.moe/niidag.png" },
  UR: { color: 0xe74c3c, rankName: "UR", rankImage: "https://via.placeholder.com/32x32/e74c3c/ffffff?text=UR" }
};

const rankWeights = [
  { rank: 'C', weight: 75 },
  { rank: 'B', weight: 22 },
  { rank: 'A', weight: 4.5 },
  { rank: 'S', weight: 0.5 }
];

const PULLS_PER_WINDOW = 3; // pulls allowed per window
const PULL_WINDOW = 8 * 60 * 60 * 1000; // 8 hours in ms
const TEST_USER_ID = "1257718161298690119";

// --- Helper Functions ---
function prettyTime(ms) {
  let seconds = Math.floor(ms / 1000);
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);

  minutes = minutes % 60;
  seconds = seconds % 60;

  let out = [];
  if (hours > 0) out.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (minutes > 0) out.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
  if (out.length === 0) out.push(`${seconds} seconds`);
  return out.join(", ");
}

function weightedRandomRank() {
  const total = rankWeights.reduce((t, r) => t + r.weight, 0);
  const rand = Math.random() * total;
  let sum = 0;
  for (const r of rankWeights) {
    sum += r.weight;
    if (rand < sum) return r.rank;
  }
  return rankWeights[rankWeights.length - 1].rank;
}

function loadCardsForSaga(saga = "East Blue") {
  const cardsPath = path.resolve('data', 'cards.json');
  if (!fs.existsSync(cardsPath)) {
    throw new Error("cards.json file not found!");
  }
  const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
  // Optional: filter by saga later
  return allCards;
}

// Only pick cards that are NOT evolved forms (i.e., only cards without evolvesFrom)
function pickCard(cards, rank) {
  const filtered = cards.filter(card => card.rank === rank && !card.evolvesFrom);
  if (filtered.length > 0) {
    return filtered[Math.floor(Math.random() * filtered.length)];
  }
  const baseCards = cards.filter(card => !card.evolvesFrom);
  if (baseCards.length > 0) {
    return baseCards[Math.floor(Math.random() * baseCards.length)];
  }
  return cards[Math.floor(Math.random() * cards.length)];
}

// --- Mongo/Mongoose User State ---
async function getUserPullState(userId) {
  let user = await User.findOne({ userId });
  if (!user) {
    user = new User({
      userId: userId,
      beli: 0,
      saga: "East Blue",
      team: [],
      wins: 0,
      pulls: [],
      lastPull: 0,
      cards: []
    });
    await user.save();
  }
  if (!user.pulls) user.pulls = [];
  if (!user.lastPull) user.lastPull = 0;
  if (!user.saga) user.saga = "East Blue";
  if (!user.cards) user.cards = [];
  return user;
}

// --- Command Export ---
const data = { name: "pull", description: "Pull a random card from the East Blue saga." };

async function execute(message) {
  const userId = message.author.id;
  const user = await getUserPullState(userId);

  if (user.saga !== "East Blue") {
    return message.reply("You haven't unlocked any saga beyond East Blue yet!");
  }

  const now = Date.now();
  const pulls = user.pulls || [];
  const validPulls = pulls.filter(ts => now - ts < PULL_WINDOW);
  const isImmune = userId === TEST_USER_ID;

  if (!isImmune && validPulls.length >= PULLS_PER_WINDOW) {
    const nextResetIn = PULL_WINDOW - (now - validPulls[0]);
    return message.reply(
      `**${message.author.username}!** You've run out of pulls!\n\nYou can pull more cards after reset!\nNext Reset: \`${prettyTime(nextResetIn)}\``
    );
  }

  // Load cards
  const cards = loadCardsForSaga(user.saga);

  // Choose rank and card
  const rank = weightedRandomRank();
  const card = pickCard(cards, rank);

  if (!isImmune) user.pulls.push(now);

  // Add card to user's collection
  user.cards.push({
    name: card.name,
    rank: card.rank,
    timesUpgraded: 0
  });

  // Update quest progress for pulling cards
  const { updateQuestProgress } = require('../utils/questSystem.js');
  await updateQuestProgress(user, 'pull', 1);

  await user.save();

  // Prepare evolution text
  let evolutionText = "";
  if (card.evolvesFrom) {
    evolutionText = `Evolves from **${card.evolvesFrom}**`;
  }

  // Prepare the embed
  const rankSet = rankSettings[card.rank];
  const embed = new EmbedBuilder()
    .setColor(rankSet.color)
    .setTitle(`**${card.name}**`)
    .setDescription(`${card.shortDesc}\nPHS: ${card.phs}${evolutionText ? `\n${evolutionText}` : ""}`)
    .setThumbnail(rankSet.rankImage);

  if (card.image && card.image !== "placeholder") {
    embed.setImage(card.image);
  }

  embed.setFooter({
    text: `This card was pulled by ${message.author.username}.`,
    iconURL: message.author.displayAvatarURL()
  });

  await message.reply({ embeds: [embed] });
}


module.exports = { data, execute };