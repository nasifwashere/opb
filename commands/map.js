export const data = { name: 'map', description: 'Show saga map and your position.' };

import { sagas } from '../utils/sagas.js';
import User from '../db/models/User.js';

export async function execute(message) {
  const user = await User.findOne({ userId: message.author.id });
  if (!user) return message.reply('Do `op start` first!');
  const idx = sagas.indexOf(user.saga);
  let reply = sagas.map((s, i) => i === idx ? `**${s}**` : s).join(' → ');
  message.reply('🗺️ ' + reply);
}