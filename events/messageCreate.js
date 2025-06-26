const { handleCommand } = require('../utils/commandHandler.js');

const name = 'messageCreate';
const once = false;

async function execute(message, client) {
  if (message.author.bot) return;
  await handleCommand(message, client);
}

module.exports = { name, once, execute };
