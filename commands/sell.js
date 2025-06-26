export const data = { name: 'sell', description: 'Sell a card to the public market.' };

import CardInstance from '../db/models/CardInstance.js';
import MarketListing from '../db/models/MarketListing.js';

export async function execute(message, args) {
  const cardName = args[0];
  const price = parseInt(args[1]);
  const userId = message.author.id;

  const card = await CardInstance.findOne({ userId, cardName, locked: { $ne: true } });
  if (!card) return message.reply('You do not own this card or it is locked.');
  if (isNaN(price) || price <= 0) return message.reply('Invalid price.');

  await MarketListing.create({ sellerId: userId, cardName, price, isActive: true });
  await card.deleteOne();

  message.reply(`💸 Listed ${cardName} for sale at ${price} Beli!`);
}