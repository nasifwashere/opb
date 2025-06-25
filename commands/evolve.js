export const data = { name: 'evolve', description: 'Evolve a card.' };

import CardInstance from '../db/models/CardInstance.js';
import User from '../db/models/User.js';
import { getEvolution } from '../utils/evolutionSystem.js';

export async function execute(message, args, client) {
  const cardName = args.join(' ');
  const userId = message.author.id;
  const cardInst = await CardInstance.findOne({ where: { userId, cardName } });
  if (!cardInst) return message.reply('Card not found.');
  const user = await User.findOne({ where: { userId } });

  const evo = getEvolution(cardName, cardInst.level, user.saga);
  if (!evo) return message.reply('You do not meet the evolution requirements.');
  if (user.beli < evo.cost) return message.reply('Not enough Beli.');

  // Evolve
  cardInst.cardName = evo.nextId;
  cardInst.level = 1;
  await cardInst.save();
  user.beli -= evo.cost;
  await user.save();
  message.reply(`✨ Evolved to **${evo.nextId}**!`);
}