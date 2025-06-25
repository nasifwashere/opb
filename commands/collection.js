export const data = { name: 'collection', description: 'View your card collection.' };

import CardInstance from '../db/models/CardInstance.js';

export async function execute(message, args, client) {
  const userId = message.author.id;
  const cards = await CardInstance.findAll({ where: { userId } });
  if (!cards.length) return message.reply('You have no cards! Use `op pull`.');
  let reply = 'Your Collection:\n';
  for (const c of cards) {
    reply += `• ${c.cardName} (Lv. ${c.level})\n`;
  }
  message.reply(reply);
}