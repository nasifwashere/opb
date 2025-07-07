const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const { isCardInTraining } = require('../utils/trainingSystem.js');
const fs = require('fs');
const path = require('path');
const { saveUserWithRetry } = require('../utils/saveWithRetry.js');

// Load cards data with fallback
let allCards = [];
try {
  const cardsPath = path.resolve('data', 'cards.json');
  allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
} catch (error) {
  console.log('Cards data not found, team command will work with basic functionality');
  allCards = [];
}

// Load shop data for equipment info
let shopData = { items: [], devilFruits: [] };
try {
  const shopPath = path.resolve('data', 'shop.json');
  shopData = JSON.parse(fs.readFileSync(shopPath, 'utf8'));
} catch (error) {
  console.log('Shop data not found, team command will work without equipment bonuses');
}

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function findShopItem(itemName) {
  const allItems = [...shopData.items, ...(shopData.devilFruits || [])];
  return allItems.find(item => 
    normalize(item.name) === normalize(itemName) || 
    item.name.toLowerCase().includes(itemName.toLowerCase())
  );
}

function calculateCardStats(cardDef, level) {
  // Use the same calculation as other commands by importing from levelSystem
  try {
    const { calculateCardStats: systemCalculateCardStats } = require('../utils/levelSystem.js');
    return systemCalculateCardStats(cardDef, level);
  } catch (error) {
    // Fallback calculation if levelSystem is not available
    const baseStats = cardDef || { power: 100, health: 100, speed: 50 };
    return {
      power: Math.floor(baseStats.power * (1 + (level - 1) * 0.1)),
      health: Math.floor(baseStats.health * (1 + (level - 1) * 0.1)),
      speed: Math.floor(baseStats.speed * (1 + (level - 1) * 0.05))
    };
  }
}

function buildTeamEmbed(teamCards, username, totalPower) {
  const embed = new EmbedBuilder()
    .setTitle(`${username}'s Team`)
    .setColor(0x2b2d31)
    .setFooter({ text: "op team add <card> • op team remove <card>" });

  // Add team slots as individual fields for a cleaner layout
  for (let i = 0; i < 3; i++) {
    const slotNumber = i + 1;
    const card = teamCards[i];

    if (card) {
      const lockStatus = card.locked ? ' 🔒' : '';
      // Use the actual card rank from the user's card instance, not a fallback
      const rank = card.rank;
      
      const cardValue = `**${card.displayName}** ${lockStatus}\n` +
        `Level ${card.level} • Rank ${rank}\n` +
        `**${card.power}** PWR • **${card.health}** HP • **${card.speed}** SPD`;
      
      embed.addFields({
        name: `Slot ${slotNumber}`,
        value: cardValue,
        inline: true
      });
    } else {
      embed.addFields({
        name: `Slot ${slotNumber}`,
        value: `*Empty*\nUse \`op team add <card>\``,
        inline: true
      });
    }
  }

  // Add total power as a separate field
  if (totalPower > 0) {
    embed.addFields({
      name: 'Team Stats',
      value: `**Total Power:** ${totalPower}`,
      inline: false
    });
  }

  return embed;
}

function fuzzyFindCard(cards, input) {
  const normInput = normalize(input);
  let bestMatch = null;
  let bestScore = 0;

  for (const card of cards) {
    const normName = normalize(card.name);
    let score = 0;

    if (normName === normInput) score = 3;
    else if (normName.includes(normInput)) score = 2;
    else if (normName.startsWith(normInput)) score = 1;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = card;
    }
  }

  return bestMatch;
}

const data = new SlashCommandBuilder()
  .setName('team')
  .setDescription('Manage and view your crew.');

async function execute(message, args) {
  const userId = message.author.id;
  const username = message.author.username;
  let [sub, ...rest] = args;
  sub = sub ? sub.toLowerCase() : "";

  let user = await User.findOne({ userId });
  if (!user) {
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setDescription('Start your journey with `op start` first!')
      .setFooter({ text: 'Use op start to begin your adventure' });
    
    return message.reply({ embeds: [embed] });
  }

  // Ensure username is set if missing
  if (!user.username) {
    user.username = username;
    await saveUserWithRetry(user);
  }

  if (sub === "remove") {
    const cardName = rest.join(' ').trim();
    if (!cardName) {
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('Remove from Team')
        .setDescription('Remove a card from your team.')
        .addFields({
          name: 'Usage',
          value: '`op team remove <card name>`',
          inline: false
        })
        .setFooter({ text: 'Specify a card to remove' });
      
      return message.reply({ embeds: [embed] });
    }

    const userCard = fuzzyFindCard(user.cards || [], cardName);
    if (!userCard) {
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setDescription('Card not found in your collection.')
        .setFooter({ text: 'Use op collection to see your cards' });
      
      return message.reply({ embeds: [embed] });
    }

    // Check if card is in case (locked away)
    if (user.case && user.case.find(c => normalize(c.name) === normalize(userCard.name))) {
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setDescription(`**${userCard.name}** is locked in your case and can't be added to your team.`)
        .setFooter({ text: 'Use op unlock to return it to your collection first' });
      
      return message.reply({ embeds: [embed] });
    }

    const originalTeam = [...(user.team || [])];
    user.team = user.team.filter(teamCardName => normalize(teamCardName) !== normalize(userCard.name));

    if (user.team.length === originalTeam.length) {
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setDescription('Card not found in your team.')
        .setFooter({ text: 'Use op team to see your current team' });
      
      return message.reply({ embeds: [embed] });
    }

    await saveUserWithRetry(user);
    
    const embed = new EmbedBuilder()
      .setTitle('Card Removed')
      .setDescription(`Removed **${userCard.name}** from your crew.`)
      .setColor(0x2b2d31)
      .setFooter({ text: 'Team updated' });
    
    return message.reply({ embeds: [embed] });
  }

  if (sub === "add") {
    const cardName = rest.join(' ').trim();
    if (!cardName) {
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('Add to Team')
        .setDescription('Add a card to your team.')
        .addFields({
          name: 'Usage',
          value: '`op team add <card name>`',
          inline: false
        })
        .setFooter({ text: 'Specify a card to add' });
      
      return message.reply({ embeds: [embed] });
    }

    if (!user.team) user.team = [];
    if (user.team.length >= 3) {
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setDescription('Your crew is full! Remove a card first.')
        .setFooter({ text: 'Maximum 3 cards per team' });
      
      return message.reply({ embeds: [embed] });
    }

    const userCard = fuzzyFindCard(user.cards || [], cardName);

    if (!userCard) {
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setDescription(`You don't own **${cardName}**.`)
        .setFooter({ text: 'Use op collection to see your cards' });
      
      return message.reply({ embeds: [embed] });
    }

    // Check if card is in case (locked away)
    if (user.case && user.case.find(c => normalize(c.name) === normalize(userCard.name))) {
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setDescription(`**${userCard.name}** is locked in your case and can't be added to your team.`)
        .setFooter({ text: 'Use op unlock to return it to your collection first' });
      
      return message.reply({ embeds: [embed] });
    }

    // Check if card is in training
    if (isCardInTraining(user, userCard.name)) {
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setDescription(`**${userCard.name}** is currently in training and can't be added to your team.`)
        .setFooter({ text: 'Use op untrain to stop training first' });
      
      return message.reply({ embeds: [embed] });
    }

    if (user.team.some(teamCard => normalize(teamCard) === normalize(userCard.name))) {
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setDescription(`**${userCard.name}** is already in your crew.`)
        .setFooter({ text: 'Card already on team' });
      
      return message.reply({ embeds: [embed] });
    }

    user.team.push(userCard.name);

    // Update quest progress for team changes
    try {
        const { updateQuestProgress } = require('../utils/questSystem.js');
        await updateQuestProgress(user, 'team_change', 1);
    } catch (error) {
        // Remove excessive logging for performance
        // console.log('Quest system not available');
    }

    await saveUserWithRetry(user);
    
    const embed = new EmbedBuilder()
      .setTitle('Card Added')
      .setDescription(`Added **${userCard.name}** to your team!`)
      .setColor(0x2b2d31)
      .setFooter({ text: 'Team updated' });
    
    return message.reply({ embeds: [embed] });
  }

  // Display team (default behavior)
  if (!user.team) user.team = [];

  const teamCards = [];
  let totalPower = 0;

  for (const cardName of user.team) {
    const userCard = user.cards?.find(card => normalize(card.name) === normalize(cardName));
    if (userCard) {
      // Find card definition
      const cardDef = allCards.find(c => normalize(c.name) === normalize(userCard.name));
      if (cardDef) {
        const level = userCard.level >= 1 ? userCard.level : (userCard.timesUpgraded ? userCard.timesUpgraded + 1 : 1);
        let stats = calculateCardStats(cardDef, level);
        let { power, health, speed } = stats;
        // Apply equipment bonuses using new system
        const equipped = user.equipped;
        if (equipped) {
          const equippedItem = equipped[cardDef.name];
          if (equippedItem) {
            const { findShopItem } = require('../utils/battleSystem.js');
            const equipmentData = findShopItem(equippedItem);
            if (equipmentData && equipmentData.statBoost) {
              const boosts = equipmentData.statBoost;
              if (boosts.power) power = Math.ceil(power * (1 + boosts.power / 100));
              if (boosts.health) health = Math.ceil(health * (1 + boosts.health / 100));
              if (boosts.speed) speed = Math.ceil(speed * (1 + boosts.speed / 100));
            }
          }
        }
        const cardData = {
          ...userCard,
          displayName: userCard.name,
          rank: userCard.rank, // Ensure the user's card rank is preserved
          power: power,
          health: health,
          speed: speed,
          locked: userCard.locked || false,
          level: level
        };
        teamCards.push(cardData);
        totalPower += power;
      }
    }
  }

  const embed = buildTeamEmbed(teamCards, username, totalPower);
  return message.reply({ embeds: [embed] });
}

module.exports = { data, execute };