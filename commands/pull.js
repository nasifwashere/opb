export const data = { name: 'pull', description: 'Pull a random card!' };

import fs from 'fs';
import User from '../db/models/User.js';
import CardInstance from '../db/models/CardInstance.js';
import { sagas } from '../utils/sagas.js';

// Properly reading JSON files in ESM
const cards = JSON.parse(fs.readFileSync(new URL('../data/cards.json', import.meta.url)));
const config = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));

const cooldowns = new Map();

export async function execute(message, args, client) {
  const userId = message.author.id;
  const now = Date.now();
  if (cooldowns.has(userId) && now - cooldowns.get(userId) < config.cooldowns.pull * 1000) {
    const left = Math.ceil((config.cooldowns.pull * 1000 - (now - cooldowns.get(userId))) / 1000 / 60);
    return message.reply(`⏳ You can pull again in ${left} minutes.`);
  }

  // Find user or create
  let user = await User.findOne({ userId });
  if (!user) return message.reply('Do `op start` first!');

  // Filter cards unlocked by saga
  const availableCards = cards.filter(c => sagas.indexOf(c.saga) <= sagas.indexOf(user.saga));
  const card = availableCards[Math.floor(Math.random() * availableCards.length)];

  // Add to collection
  await CardInstance.create({ userId, cardName: card.name });
  cooldowns.set(userId, now);

  message.reply(`🃏 You pulled **${card.name}**!`);
}