

const User = require('../db/models/User.js');

// Commands that don't require starting journey
const NO_START_REQUIRED = ['start', 'help', 'info'];

async function handleCommand(message, args, client) {
  const commandName = args[0]?.toLowerCase();
  
  if (!commandName) return;

  // Check if user needs to start their journey first
  if (!NO_START_REQUIRED.includes(commandName)) {
    const userId = message.author.id;
    const user = await User.findOne({ userId });
    
    if (!user) {
      return message.reply('🏴‍☠️ **Start your adventure first!**\n\nUse `op start` to begin your One Piece journey!');
    }
  }

  const command = client.commands.get(commandName);
  
  if (!command) {
    return message.reply(`Unknown command: ${commandName}`);
  }

  try {
    await command.execute(message, args.slice(1), client);
  } catch (error) {
    console.error('Error executing command:', error);
    await message.reply('There was an error executing that command.');
  }
}

module.exports = { handleCommand };

