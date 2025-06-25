export const data = { name: 'setDrops', description: 'Set drops channel (mod only).' };

export async function execute(message, args, client) {
  if (message.author.id !== process.env.OWNER_ID) return;
  // Save channel to config/DB
  message.reply('Drops channel set (stub).');
}