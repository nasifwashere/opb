import { handleCommand } from '../utils/commandHandler.js';

export const name = 'messageCreate';
export const once = false;

export async function execute(message, client) {
  if (message.author.bot) return;
  await handleCommand(message, client);
}