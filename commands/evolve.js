export const data = { name: 'level', description: 'Level up a card with duplicates.' };

import CardInstance from '../db/models/CardInstance.js';

export async function execute(message, args) {
  const cardName = args[0];
  const amount = parseInt(args[1]) || 1;
  const userId = message.author.id;

  // Count duplicates
  const cards = await CardInstance.find({ userId, cardName });
  if (cards.length < 2) return message.reply('Not enough duplicates!');

  // Only keep one at new level, delete the rest
  const card = cards[0];
  card.level += amount;
  await card.save();
  for (let i = 1; i < Math.min(cards.length, amount + 1); i++) {
    await cards[i].deleteOne();
  }
  message.reply(`🔼 ${cardName} leveled up!`);
}