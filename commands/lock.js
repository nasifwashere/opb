export const data = { name: 'lock', description: 'Lock a card.' };

import CardInstance from '../db/models/CardInstance.js';

export async function execute(message, args, client) {
  const cardName = args.join(' ');
  const userId = message.author.id;
  const cardInst = await CardInstance.findOne({ where: { userId, cardName } });
  if (!cardInst) return message.reply('Card not found.');
  cardInst.locked = true;
  await cardInst.save();
  message.reply(`🔒 Locked ${cardName}.`);
}