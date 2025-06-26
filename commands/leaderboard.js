export const data = { name: 'leaderboard', description: 'Leaderboard for Beli or Wins.' };

import User from '../db/models/User.js';

export async function execute(message, args) {
  const type = (args[0] || 'beli').toLowerCase();
  const sortField = type === 'wins' ? 'wins' : 'beli';

  const top = await User.find().sort({ [sortField]: -1 }).limit(10);
  let reply = `🏆 **Top 10 by ${sortField}:**\n`;
  top.forEach((u, i) => {
    reply += `${i + 1}. <@${u.userId}> – ${u[sortField]}\n`;
  });
  message.reply(reply);
}