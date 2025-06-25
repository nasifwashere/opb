export const data = { name: 'market', description: 'View market listings.' };

import MarketListing from '../db/models/MarketListing.js';

export async function execute(message, args, client) {
  const listings = await MarketListing.findAll({ where: { isActive: true } });
  if (!listings.length) return message.reply('No cards in the market.');
  let reply = '**Market Listings:**\n';
  listings.forEach(l => {
    reply += `• ${l.cardName} — ${l.price} Beli (ID: ${l.id})\n`;
  });
  message.reply(reply);
}