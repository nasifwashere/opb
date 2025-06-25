export const data = { name: 'sell', description: 'Sell a card to the market.' };

import CardInstance from '../db/models/CardInstance.js';
import MarketListing from '../db/models/MarketListing.js';

export async function execute(message, args, client) {
  const [cardName, price] = args;
  const userId = message.author.id;
  const cardInst = await CardInstance.findOne({ where: { userId, cardName, locked: false } });
  if (!cardInst) return message.reply('Card not found or locked.');
  await MarketListing.create({ sellerId: userId, cardName, price: parseInt(price) });
  await cardInst.destroy();
  message.reply(`💸 Listed ${cardName} for ${price} Beli on the market!`);
}