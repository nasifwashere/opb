export const data = { name: 'start', description: 'Start your pirate adventure!' };

import User from '../db/models/User.js';

export async function execute(message, args, client) {
  let user = await User.findOne({ where: { userId: message.author.id } });
  if (user) return message.reply('You already have an account!');
  await User.create({ userId: message.author.id });
  message.reply('🏴‍☠️ Your pirate adventure begins! Use `op pull` to get your first card.');
}