const { SlashCommandBuilder } = require('discord.js');
const ownerModule = require('./owner.js');

const data = new SlashCommandBuilder()
  .setName('cheats')
  .setDescription('cheats command');

module.exports = {
  data: {
    name: 'cheats',
    description: 'Show owner commands UI',
  },

  async execute(message, args, client) {
    // Call owner.js execute with empty args to display the embed and buttons for owner commands
    return ownerModule.execute(message, [], client);
  }
};
