export const data = { name: 'team', description: 'Manage your team.' };

import User from '../db/models/User.js';

export async function execute(message, args, client) {
  const user = await User.findOne({ where: { userId: message.author.id } });
  if (!user) return message.reply('Do `op start` first!');

  if (args[0] === "add") {
    // Add card to team
    // TODO: Add logic
    return message.reply('Team add coming soon!');
  }
  if (args[0] === "remove") {
    // Remove card
    // TODO: Remove logic
    return message.reply('Team remove coming soon!');
  }
  // Show current team
  message.reply(`Your team: ${user.team.join(', ')}`);
}