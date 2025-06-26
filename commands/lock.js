export const data = { name: 'lock', description: 'Lock a card to prevent accidental sell/evolve.' };

import CardInstance from '../db/models/CardInstance.js';

export async function execute(message, args) {
  const cardName = args.join(' ').trim();
  const userId = message.author.id;
  const card = await CardInstance.findOne({ userId, cardName });
  if (!card) return message.reply('You do not own this card.');

  card.locked = true;
  await card.save();
  message.reply(`🔒 Locked ${cardName}!`);
}