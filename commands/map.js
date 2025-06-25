export const data = { name: 'map', description: 'Show saga map.' };

import { sagas } from '../utils/sagas.js';

export async function execute(message, args, client) {
  message.reply('Saga Map:\n' + sagas.map(s => `• ${s}`).join('\n'));
}