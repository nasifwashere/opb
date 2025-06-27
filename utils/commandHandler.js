const fs = require('fs');
const path = require('path');
const User = require('../db/models/User.js');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json')));

async function handleCommand(message, client) {
  if (!message.content.startsWith(config.prefix)) return;
  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);
  if (!command) return;

  // Check if user needs to run start command first (except for help and start commands)
  if (commandName !== 'start' && commandName !== 'help') {
    const userId = message.author.id;
    const user = await User.findOne({ userId });
    
    if (!user) {
      return message.reply('❌ You need to start your pirate adventure first! Use `op start` to begin.');
    }
  }

  try {
    await command.execute(message, args, client);
  } catch (error) {
    console.error(error);
    message.reply('❌ There was an error executing that command.');
  }
}

module.exports = { handleCommand };
