export const data = { name: 'setResets', description: 'Set resets channel (mod only).' };

export async function execute(message, args, client) {
  if (message.author.id !== process.env.OWNER_ID) return;
  // Save channel to config/DB
  message.reply('Resets channel set (stub).');
}