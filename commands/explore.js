export const data = { name: 'explore', description: 'Explore and unlock new sagas.' };

import User from '../db/models/User.js';
import { getNextSaga } from '../utils/sagas.js';

export async function execute(message, args, client) {
  const user = await User.findOne({ where: { userId: message.author.id } });
  if (!user) return message.reply('Do `op start` first!');
  const next = getNextSaga(user.saga);
  if (!next) return message.reply('You have reached the last saga!');
  user.saga = next;
  await user.save();
  message.reply(`🌍 You have advanced to the **${next}** saga!`);
}