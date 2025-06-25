export const data = { name: 'level', description: 'Level up a card using duplicates.' };

import CardInstance from '../db/models/CardInstance.js';
import { levelUp } from '../utils/levelSystem.js';

export async function execute(message, args, client) {
  const [cardName, rawAmount] = args;
  const amount = parseInt(rawAmount) || 1;
  const userId = message.author.id;

  // Find all duplicates
  const cards = await CardInstance.findAll({ where: { userId, cardName } });
  if (!cards.length) return message.reply('No such card.');
  const mainCard = cards[0];

  // Level up main card using other duplicates
  const leveled = levelUp(mainCard, cards.length - 1, amount);
  mainCard.level += leveled;
  await mainCard.save();

  // Remove used duplicates
  for (let i = 0; i < leveled; i++) {
    await cards[i + 1].destroy();
  }

  message.reply(`🔺 ${mainCard.cardName} is now level ${mainCard.level}!`);
}