export const data = { name: 'start', description: 'Begin your pirate adventure!' };

import User from '../db/models/User.js';
import fs from 'fs';
const config = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));
// Load cards.json and find Monkey D. Luffy
const cards = JSON.parse(fs.readFileSync(new URL('../data/cards.json', import.meta.url)));
const luffyCard = cards.find(c => c.name === "Monkey D. Luffy");

export async function execute(message) {
  const userId = message.author.id;
  let user = await User.findOne({ userId });
  if (user) return message.reply('You already have a pirate adventure!');

  if (!luffyCard) return message.reply('Luffy is missing from the card database. Please contact an admin.');

  user = new User({
    userId,
    beli: 500,
    saga: config.defaultSaga,
    team: [],
    wins: 0,
    inventory: [],
    cards: [
      {
        name: luffyCard.name,
        rank: luffyCard.rank,
        timesUpgraded: 0
      }
    ]
  });
  await user.save();

  message.reply('🏴‍☠️ Your journey begins! You received 1 Monkey D. Luffy and 500 Beli to start your adventure!');
}