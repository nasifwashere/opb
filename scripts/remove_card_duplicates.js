require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');

const cardsPath = path.resolve(__dirname, '../data/cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function getEvolutionChain(cardName) {
  const chain = [];
  const cardDef = allCards.find(c => normalize(c.name) === normalize(cardName));
  if (!cardDef) return [cardName];
  let baseForm = cardDef;
  while (baseForm.evolvesFrom) {
    baseForm = allCards.find(c => c.name === baseForm.evolvesFrom);
    if (!baseForm) break;
  }
  if (!baseForm) return [cardName];
  let current = baseForm;
  while (current) {
    chain.push(current.name);
    current = allCards.find(c => c.evolvesFrom === current.name);
  }
  return chain;
}

function getCardKey(card) {
  // Use the base form name as the key for grouping
  const chain = getEvolutionChain(card.name);
  return normalize(chain[0]);
}

function compareCards(a, b) {
  // Prefer higher level, then higher experience, then higher rank
  if ((a.level || 1) !== (b.level || 1)) return (b.level || 1) - (a.level || 1);
  if ((a.experience || 0) !== (b.experience || 0)) return (b.experience || 0) - (a.experience || 0);
  // Optionally compare by rank if needed
  return 0;
}

async function removeDuplicatesForAllUsers() {
  const users = await User.find({});
  let changed = 0;
  for (const user of users) {
    if (!user.cards || user.cards.length === 0) continue;
    const cardGroups = {};
    for (const card of user.cards) {
      const key = getCardKey(card);
      if (!cardGroups[key]) cardGroups[key] = [];
      cardGroups[key].push(card);
    }
    let newCards = [];
    for (const group of Object.values(cardGroups)) {
      if (group.length === 1) {
        newCards.push(group[0]);
      } else {
        // Keep the best card only
        group.sort(compareCards);
        newCards.push(group[0]);
      }
    }
    if (newCards.length !== user.cards.length) {
      user.cards = newCards;
      user.markModified('cards');
      await user.save();
      changed++;
      console.log(`Updated user ${user.userId}: removed duplicates.`);
    }
  }
  console.log(`Done. Updated ${changed} users.`);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await removeDuplicatesForAllUsers();
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
