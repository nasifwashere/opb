const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle  } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');

// Load cards data
const cardsPath = path.resolve('data', 'cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function calculateCardStats(cardDef, level) {
  // Use the same calculation as other commands by importing from levelSystem
  const { calculateCardStats: systemCalculateCardStats } = require('../utils/levelSystem.js');
  return systemCalculateCardStats(cardDef, level);
}

function buildTeamEmbed(teamCards, username, totalPower) {
  let teamDisplay = '';

  for (let i = 0; i < 3; i++) {
    const slotNumber = i + 1;
    const card = teamCards[i];

    if (card) {
      const lockStatus = card.locked ? ' 🔒' : '';
      teamDisplay += `**${slotNumber}.** Lv.${card.level} ${card.displayName}${lockStatus}\n`;
      teamDisplay += `\`\`\`${card.power} PWR • ${card.health} HP • ${card.speed} SPD\`\`\`\n`;
    } else {
      teamDisplay += `**${slotNumber}.** *Empty Slot*\n`;
      teamDisplay += `\`\`\`Use 'op team add <card>' to fill this slot\`\`\`\n`;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`${username}'s Team`)
    .setDescription(teamDisplay)
    .addFields({ name: "Total Power", value: `${totalPower}`, inline: true })
    .setColor(0x2f3136)
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
  if (!user) return message.reply("You need to start first! Use `op start`.");

  // Ensure username is set if missing
  if (!user.username) {
    user.username = username;
    await user.save();
  }

  if (sub === "remove") {
    const cardName = rest.join(' ').trim();
    if (!cardName) return message.reply("Please specify a card to remove. Usage: `op team remove <card name>`");

    const userCard = fuzzyFindCard(user.cards || [], cardName);
    if (!userCard) {
      return message.reply(`Card not found in your collection. Use \`op collection\` to see your cards.`);
    }

    const originalTeam = [...(user.team || [])];
    user.team = user.team.filter(teamCardName => normalize(teamCardName) !== normalize(userCard.name));

    if (user.team.length === originalTeam.length) {
      return message.reply(`Card not found in your team. Use \`op team\` to see your current team.`);
    }

    await user.save();
    return message.reply(`Removed **${userCard.name}** from your crew.`);
  }

  if (sub === "add") {
    const cardName = rest.join(' ').trim();
    if (!cardName) return message.reply("Please specify a card to add. Usage: `op team add <card name>`");

    if (!user.team) user.team = [];
    if (user.team.length >= 3) {
      return message.reply("Your crew is full! Remove a card first using `op team remove <card>`.");
    }

    const userCard = fuzzyFindCard(user.cards || [], cardName);

    if (!userCard) {
      return message.reply(`You don't own **${cardName}**. Use \`op collection\` to see your cards.`);
    }

    if (user.team.some(teamCard => normalize(teamCard) === normalize(userCard.name))) {
      return message.reply(`**${userCard.name}** is already in your crew.`);
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
        await message.reply(`✅ Added **${cardName}** to your team!`);
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