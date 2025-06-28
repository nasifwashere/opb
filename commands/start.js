const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');

const data = { name: 'start', description: 'Begin your pirate adventure!' };

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json')));
// Load cards.json and find Monkey D. Luffy
const cards = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/cards.json')));
const luffyCard = cards.find(c => c.name === "Monkey D. Luffy");

async function execute(message) {
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
    inventory: ['healingpotion', 'healingpotion', 'healingpotion', 'statbuffer', 'statbuffer', 'statbuffer'],
    cards: [
      {
        name: luffyCard.name,
        rank: luffyCard.rank,
        timesUpgraded: 0
      }
    ]
  });
  await user.save();

  message.reply(' Your journey begins! You received:\n 1 Monkey D. Luffy\n<:Money:1375579299565928499> 500 Beli\n<:icon7:1375881261133856930> 3 Healing Potions\n<:icon5:1375880705078460436> 3 Stat Buffers\n\nGood luck on your adventure!');
}

module.exports = { data, execute };
