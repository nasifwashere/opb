export const data = { name: 'info', description: 'Show card info.' };

import fs from 'fs';
const cards = JSON.parse(fs.readFileSync(new URL('../data/cards.json', import.meta.url)));

export async function execute(message, args, client) {
  const cardName = args.join(' ');
  const card = cards.find(c => c.name === cardName);
  if (!card) return message.reply('Card not found.');
  let reply = `**${card.name}**\n${card.shortDesc}\nRank: ${card.rank}\nStats: ${card.phs}\nSaga: ${card.saga}`;
  if (card.evolution) {
    reply += `\nEvolves to: ${card.evolution.nextId} (Lv. ${card.evolution.requiredLevel}, ${card.evolution.cost} Beli, ${card.evolution.requiredSaga})`;
  }
  message.reply(reply);
}