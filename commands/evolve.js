const { SlashCommandBuilder, EmbedBuilder  } = require('discord.js');
const User = require('../db/models/User.js');
const fs = require('fs');
const path = require('path');
const { getEvolution } = require('../utils/evolutionSystem.js');
const { transformAllDuplicatesToEvolution } = require('../utils/cardTransformationSystem.js');
const config = require('../config.json');
const Fuse = require('fuse.js');

const cardsPath = path.resolve('data', 'cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

// Evolution cost matrix
const evolutionCosts = {
  'C_B': { cost: 250, level: 5 },
  'B_A': { cost: 1000, level: 25 },
  'A_S': { cost: 2500, level: 30 },
  'S_UR': { cost: 30000, level: 90 }
};

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

function findCard(cardName) {
  return allCards.find(c => normalize(c.name) === normalize(cardName));
}

// Fuzzy find a card from user's card list using Fuse.js
function fuzzyFindCard(cards, input) {
  if (!cards || cards.length === 0) return null;
  
  const normInput = normalize(input);
  
  // First try exact match
  let match = cards.find(card => normalize(card.name) === normInput);
  if (match) return match;
  
  // Configure Fuse.js for fuzzy search
  const fuseOptions = {
    keys: ['name'],
    includeScore: true,
    threshold: 0.6, // 0 = exact match, 1 = match anything
    ignoreLocation: true,
    findAllMatches: true
  };
  
  const fuse = new Fuse(cards, fuseOptions);
  const results = fuse.search(input);
  
  // Return the best match if score is good enough
  if (results.length > 0 && results[0].score <= 0.4) {
    return results[0].item;
  }
  
  // Fallback to partial match
  return cards.find(card => {
    const normName = normalize(card.name);
    return normName.includes(normInput) || normInput.includes(normName);
  });
}

function findUserCard(user, cardName) {
  if (!user.cards || user.cards.length === 0) return null;
  return fuzzyFindCard(user.cards, cardName);
}

function getEvolutionCost(fromRank, toRank) {
  const key = `${fromRank}_${toRank}`;
  return evolutionCosts[key] || null;
}

const data = new SlashCommandBuilder()
  .setName('evolve')
  .setDescription('Evolve a card to its next form.');

async function execute(message, args) {
  const userId = message.author.id;
  const username = message.author.username;
  const cardName = args.join(' ').trim();

  if (!cardName) {
    return message.reply('Usage: `op evolve <card name>` (supports partial name matching)');
  }

  let user = await User.findOne({ userId });
  if (!user) return message.reply('Start your journey with `op start` first!');

  // Ensure username is set if missing
  if (!user.username) {
    user.username = username;
    await user.save();
  }

  // Ensure saga is set if missing (for existing users)
  if (!user.saga) {
    user.saga = "East Blue";
    await user.save();
  }

  // Find the card in user's collection
  const userCard = findUserCard(user, cardName);
  if (!userCard) {
    return message.reply(`Please state a valid card name. You don't own "${cardName}". Try using partial names like "luffy" or "gear"!`);
  }

  // Find the card definition
  const cardDef = findCard(userCard.name);
  if (!cardDef) {
    return message.reply(`Card definition for "${userCard.name}" not found.`);
  }

  // Check if card can evolve
  if (!cardDef.evolution) {
    return message.reply(`"${cardDef.name}" cannot evolve further.`);
  }

  const evolution = cardDef.evolution;
  const currentLevel = userCard.level || userCard.timesUpgraded + 1 || 1;

  // Check level requirement
  if (currentLevel < evolution.requiredLevel) {
    return message.reply(`"${cardDef.name}" needs to be level ${evolution.requiredLevel} to evolve. Current level: ${currentLevel}`);
  }

  // Check saga requirement - only if globally enabled
  if (config.sagaRequirementsEnabled && evolution.requiredSaga) {
    const currentSaga = user.saga || "East Blue";
    if (currentSaga !== evolution.requiredSaga) {
      return message.reply(`You need to reach the "${evolution.requiredSaga}" saga to evolve this card. Current saga: ${currentSaga}`);
    }
  }

  // Find the evolved form
  const evolvedCard = allCards.find(c => c.name === evolution.nextId);
  if (!evolvedCard) {
    return message.reply(`Evolution target "${evolution.nextId}" not found in database.`);
  }

  // Calculate evolution cost
  const costInfo = getEvolutionCost(cardDef.rank, evolvedCard.rank);
  const evolutionCost = evolution.cost || costInfo?.cost || 1000;

  // Check if user has enough Beli
  if (user.beli < evolutionCost) {
    return message.reply(`You need ${evolutionCost} Beli to evolve this card. You have ${user.beli} Beli.`);
  }

  // Perform evolution
  user.beli -= evolutionCost;

  // Count duplicates for success message
  const duplicateCount = user.cards.filter(c => normalize(c.name) === normalize(userCard.name)).length;

  // Update the first card to evolved form, preserving level and experience
  const cardIndex = user.cards.findIndex(c => normalize(c.name) === normalize(userCard.name));
  user.cards[cardIndex] = {
    name: evolvedCard.name,
    rank: evolvedCard.rank,
    level: currentLevel, // Preserve current level
    timesUpgraded: userCard.timesUpgraded || 0,
    locked: userCard.locked || false,
    experience: userCard.experience || 0
  };

  // Transform all duplicates of the original card to the evolved form
  transformAllDuplicatesToEvolution(user, evolvedCard.name, evolvedCard);

  await user.save();

  // Update quest progress for evolution
  try {
    const { updateQuestProgress } = require('../utils/questSystem.js');
    await updateQuestProgress(user, 'evolve', 1);
  } catch (error) {
    console.error('Error updating evolution quest progress:', error);
  }

  // Create success embed
  const transformMessage = duplicateCount > 1 ? `All ${duplicateCount} copies transformed!` : 'Card evolved!';
  const embed = new EmbedBuilder()
    .setTitle('<:sucess:1375872950321811547> Evolution Success!')
    .setDescription(`**${cardDef.name}** has evolved into **${evolvedCard.name}**!\n${transformMessage}`)
    .addFields(
      { name: 'Previous Form', value: `[${cardDef.rank}] ${cardDef.name}`, inline: true },
      { name: 'New Form', value: `[${evolvedCard.rank}] ${evolvedCard.name}`, inline: true },
      { name: 'Cost', value: `${evolutionCost} Beli`, inline: true },
      { name: 'Level Preserved', value: `${user.cards[cardIndex].level}`, inline: true },
      { name: 'Remaining Beli', value: `${user.beli}`, inline: true },
      { name: 'Cards Transformed', value: `${duplicateCount}`, inline: true }
    )
    .setColor(0x9b59b6);

  if (evolvedCard.image && evolvedCard.image !== "placeholder") {
    embed.setImage(evolvedCard.image);
  }

  await message.reply({ embeds: [embed] });
}


module.exports = { data, execute };