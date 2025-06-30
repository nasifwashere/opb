const { SlashCommandBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');

const configPath = path.resolve('config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const data = new SlashCommandBuilder()
  .setName('disallow')
  .setDescription('Disable a card from being used in battles (Admin only).');

async function execute(message, args) {
  // Check if user has admin permissions
  const hasAdminRole = message.member.roles.cache.some(role => 
    config.adminRoles.includes(role.name)
  );

  if (!hasAdminRole && message.author.id !== message.guild.ownerId) {
    return message.reply(' You need admin permissions to use this command.');
  }

  const cardName = args.join(' ').trim();
  if (!cardName) {
    return message.reply('Usage: `op disallow <card name>`');
  }

  // Load cards to verify the card exists
  const cardsPath = path.resolve('data', 'cards.json');
  const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
  
  const card = allCards.find(c => 
    c.name.toLowerCase() === cardName.toLowerCase() ||
    c.name.toLowerCase().includes(cardName.toLowerCase())
  );

  if (!card) {
    return message.reply(` Card "${cardName}" not found in the database.`);
  }

  // Add card to global disallowed list (stored in admin user document)
  const adminUserId = message.author.id;
  let adminUser = await User.findOne({ userId: adminUserId });
  
  if (!adminUser) {
    adminUser = new User({
      userId: adminUserId,
      disallowedCards: []
    });
  }

  if (!adminUser.disallowedCards) {
    adminUser.disallowedCards = [];
  }

  if (adminUser.disallowedCards.includes(card.name)) {
    return message.reply(` "${card.name}" is already disallowed.`);
  }

  adminUser.disallowedCards.push(card.name);
  await adminUser.save();

  // Also remove this card from all users' teams if it's currently in use
  await User.updateMany(
    { team: card.name },
    { $pull: { team: card.name } }
  );

  await message.reply(`<:sucess:1375872950321811547> "${card.name}" has been disallowed and removed from all teams. Players cannot use this card in battles until it's re-allowed.`);
}


module.exports = { data, execute };