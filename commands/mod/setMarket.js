export const data = { name: 'setMarket', description: 'Set market channel (mod only).' };

export async function execute(message, args, client) {
  if (message.author.id !== process.env.OWNER_ID) return;
  // Save channel to config/DB
  message.reply('Market channel set (stub).');
}