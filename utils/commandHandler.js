import fs from 'fs';

const config = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));

export async function handleCommand(message, client) {
  if (!message.content.startsWith(config.prefix)) return;
  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(message, args, client);
  } catch (error) {
    console.error(error);
    message.reply('❌ There was an error executing that command.');
  }
}