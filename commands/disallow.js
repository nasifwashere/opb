const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription('You need admin permissions to use this command.')
      .setFooter({ text: 'Admin only command' });
    
    return message.reply({ embeds: [embed] });
  }

  const cardName = args.join(' ').trim();
  if (!cardName) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle('Disallow Card')
      .setDescription('Disable a card from being used in battles.')
      .addFields({
        name: 'Usage',
        value: '`op disallow <card name>`',
        inline: false
      })
      .setFooter({ text: 'Admin command to manage card availability' });
    
    return message.reply({ embeds: [embed] });
  }

  // Load cards to verify the card exists
  const cardsPath = path.resolve('data', 'cards.json');
  const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
  
  const card = allCards.find(c => 
    c.name.toLowerCase() === cardName.toLowerCase() ||
    c.name.toLowerCase().includes(cardName.toLowerCase())
  );

  if (!card) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`Card "${cardName}" not found in the database.`)
      .setFooter({ text: 'Card not found' });
    
    return message.reply({ embeds: [embed] });
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
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription(`"${card.name}" is already disallowed.`)
      .setFooter({ text: 'Card already disabled' });
    
    return message.reply({ embeds: [embed] });
  }

  adminUser.disallowedCards.push(card.name);
  await adminUser.save();

  // Also remove this card from all users' teams if it's currently in use
  await User.updateMany(
    { team: card.name },
    { $pull: { team: card.name } }
  );

  const embed = new EmbedBuilder()
    .setTitle('Card Disallowed')
    .setDescription(`"${card.name}" has been disallowed and removed from all teams.\n\nPlayers cannot use this card in battles until it's re-allowed.`)
    .setColor(0x2b2d31)
    .setFooter({ text: 'Card disabled globally' });

  await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };