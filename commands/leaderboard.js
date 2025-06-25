export const data = { name: 'leaderboard', description: 'Show leaderboards.' };

import User from '../db/models/User.js';

export async function execute(message, args, client) {
  const type = args[0];
  let users;
  if (type === 'beli') {
    users = await User.findAll({ order: [['beli', 'DESC']], limit: 10 });
    return message.reply(
      users.map((u, i) => `${i + 1}. <@${u.userId}> — ${u.beli} Beli`).join('\n')
    );
  } else if (type === 'wins') {
    users = await User.findAll({ order: [['wins', 'DESC']], limit: 10 });
    return message.reply(
      users.map((u, i) => `${i + 1}. <@${u.userId}> — ${u.wins} PvP Wins`).join('\n')
    );
  }
  message.reply('Specify `beli` or `wins`!');
}