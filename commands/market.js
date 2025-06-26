export const data = { name: 'market', description: 'View the card market.' };

import MarketListing from '../db/models/MarketListing.js';

export async function execute(message) {
  const listings = await MarketListing.find({ isActive: true }).limit(10);
  if (!listings.length) return message.reply('Market is empty!');

  let reply = '🏪 **Market Listings:**\n';
  listings.forEach(l => {
    reply += `ID: \`${l._id}\` – **${l.cardName}** for ${l.price} Beli (Seller: <@${l.sellerId}>)\n`;
  });
  message.reply(reply);
}