export const data = { name: 'progress', description: 'Show your current saga.' };

import User from '../db/models/User.js';

export async function execute(message, args, client) {
  const user = await User.findOne({ where: { userId: message.author.id } });
  if (!user) return message.reply('Do `op start` first!');
  message.reply(`You are currently in the **${user.saga}** saga!`);
}