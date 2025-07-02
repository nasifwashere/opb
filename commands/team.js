const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');

// Load cards data with fallback
let allCards = [];
try {
  const cardsPath = path.resolve('data', 'cards.json');
  allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
} catch (error) {
  console.log('Cards data not found, team command will work with basic functionality');
  allCards = [];
}

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
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
  let teamDisplay = '';

  for (let i = 0; i < 3; i++) {
    const slotNumber = i + 1;
    const card = teamCards[i];

    if (card) {
      const lockStatus = card.locked ? ' 🔒' : '';
      teamDisplay += `**${slotNumber}.** Lv.${card.level} ${card.displayName}${lockStatus}\n`;
      teamDisplay += `${card.power} PWR • ${card.health} HP • ${card.speed} SPD\n\n`;
    } else {
      teamDisplay += `**${slotNumber}.** *Empty Slot*\n`;
      teamDisplay += `Use \`op team add <card>\` to fill this slot\n\n`;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`${username}'s Team`)
    .setDescription(teamDisplay)
    .addFields({ name: "Total Power", value: `${totalPower}`, inline: true })
    .setColor(0x2b2d31)
    .setFooter({ text: "op team add <card> • op team remove <card>" });

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
    await user.save();
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

    const originalTeam = [...(user.team || [])];
    user.team = user.team.filter(teamCardName => normalize(teamCardName) !== normalize(userCard.name));

    if (user.team.length === originalTeam.length) {
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setDescription('Card not found in your team.')
        .setFooter({ text: 'Use op team to see your current team' });
      
      return message.reply({ embeds: [embed] });
    }

    await user.save();
    
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
        console.log('Quest system not available');
    }

    await user.save();
    
    const embed = new EmbedBuilder()
      .setTitle('Card Added')
      .setDescription(`Added **${userCard.name}** to your team!`)
      .setColor(0x2b2d31)
      .setFooter({ text: 'Team updated' });
    
    await message.reply({ embeds: [embed] });
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
        const level = userCard.level || 1;
        const stats = calculateCardStats(cardDef, level);

        // Apply equipment bonuses
        let { power, health, speed } = stats;

        // Check for equipped items using the same logic as other commands
        const equipped = user.equipped;
        if (equipped) {
          const normalizedCardName = normalize(cardDef.name);
          const equippedItem = equipped[normalizedCardName];

          if (equippedItem === 'strawhat') {
            power = Math.ceil(power * 1.3);
            health = Math.ceil(health * 1.3);
            speed = Math.ceil(speed * 1.3);
          }
        }

        const cardData = {
          ...userCard,
          displayName: userCard.name,
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