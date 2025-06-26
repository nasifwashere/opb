export const data = { name: 'progress', description: 'View your current saga.' };

import User from '../db/models/User.js';

export async function execute(message) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) return message.reply('Do `op start` first!');
  message.reply(`Your current saga: **${user.saga}**`);
}