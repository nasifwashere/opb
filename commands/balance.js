export const data = { name: 'balance', description: 'View your Beli.' };

import User from '../db/models/User.js';

export async function execute(message, args, client) {
  const user = await User.findOne({ where: { userId: message.author.id } });
  if (!user) return message.reply('Start with `op start`!');
  message.reply(`💰 You have ${user.beli} Beli.`);
}