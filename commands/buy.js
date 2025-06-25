export const data = { name: 'buy', description: 'Buy a card from the market.' };

import MarketListing from '../db/models/MarketListing.js';
import CardInstance from '../db/models/CardInstance.js';
import User from '../db/models/User.js';

export async function execute(message, args, client) {
  const [cardName, id] = args;
  const listing = await MarketListing.findOne({ where: { id, isActive: true } });
  if (!listing || listing.cardName !== cardName) return message.reply('Listing not found.');

  const buyer = await User.findOne({ where: { userId: message.author.id } });
  if (buyer.beli < listing.price) return message.reply('Not enough Beli.');

  // Transfer card
  await CardInstance.create({ userId: message.author.id, cardName: listing.cardName });
  buyer.beli -= listing.price;
  await buyer.save();

  listing.isActive = false;
  await listing.save();

  message.reply(`✅ Bought ${listing.cardName} for ${listing.price} Beli!`);
}