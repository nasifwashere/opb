const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { sagas } = require('../utils/sagas.js');

const islandData = {
  'East Blue': {
    islands: [
      { name: 'Windmill Village', boss: 'Higuma', unlocked: true },
      { name: 'Shells Town', boss: 'Axe-Hand Morgan', unlocked: true },
      { name: 'Orange Town', boss: 'Buggy', unlocked: false },
      { name: 'Syrup Village', boss: 'Kuro', unlocked: false },
      { name: 'Baratie', boss: 'Don Krieg', unlocked: false },
      { name: 'Arlong Park', boss: 'Arlong', unlocked: false }
    ],
    color: 0x3498db,
    description: 'The beginning of the Grand Adventure'
  },
  'Alabasta': {
    islands: [
      { name: 'Reverse Mountain', boss: 'Laboon', unlocked: false },
      { name: 'Whiskey Peak', boss: 'Mr. 5', unlocked: false },
      { name: 'Little Garden', boss: 'Mr. 3', unlocked: false },
      { name: 'Drum Island', boss: 'Wapol', unlocked: false },
      { name: 'Alabasta', boss: 'Crocodile', unlocked: false }
    ],
    color: 0xf1c40f,
    description: 'The desert kingdom saga'
  },
  'Water 7': {
    islands: [
      { name: 'Jaya', boss: 'Bellamy', unlocked: false },
      { name: 'Skypiea', boss: 'Enel', unlocked: false },
      { name: 'Long Ring Long Land', boss: 'Foxy', unlocked: false },
      { name: 'Water 7', boss: 'CP9', unlocked: false }
    ],
    color: 0x9b59b6,
    description: 'The city of water and shipwrights'
  },
  'Enies Lobby': {
    islands: [
      { name: 'Enies Lobby', boss: 'Rob Lucci', unlocked: false }
    ],
    color: 0xe74c3c,
    description: 'The judicial island battle'
  },
  'Thriller Bark': {
    islands: [
      { name: 'Thriller Bark', boss: 'Gecko Moria', unlocked: false }
    ],
    color: 0x8e44ad,
    description: 'The haunted ship'
  },
  'Sabaody': {
    islands: [
      { name: 'Sabaody Archipelago', boss: 'Kizaru', unlocked: false }
    ],
    color: 0x16a085,
    description: 'The archipelago of bubbles'
  },
  'Marineford': {
    islands: [
      { name: 'Amazon Lily', boss: 'Boa Hancock', unlocked: false },
      { name: 'Impel Down', boss: 'Magellan', unlocked: false },
      { name: 'Marineford', boss: 'Akainu', unlocked: false }
    ],
    color: 0xc0392b,
    description: 'The war of the best'
  },
  'Dressrosa': {
    islands: [
      { name: 'Punk Hazard', boss: 'Caesar Clown', unlocked: false },
      { name: 'Dressrosa', boss: 'Doflamingo', unlocked: false }
    ],
    color: 0xe67e22,
    description: 'The kingdom of passion'
  },
  'Whole Cake': {
    islands: [
      { name: 'Zou', boss: 'Jack', unlocked: false },
      { name: 'Whole Cake Island', boss: 'Big Mom', unlocked: false }
    ],
    color: 0xf39c12,
    description: 'The tea party from hell'
  },
  'Wano': {
    islands: [
      { name: 'Wano Country', boss: 'Kaido', unlocked: false }
    ],
    color: 0x2c3e50,
    description: 'The land of samurai'
  }
};

function createMapEmbed(currentSaga, sagaData, userProgress) {
  const embed = new EmbedBuilder()
    .setTitle(` ${currentSaga} Islands`)
    .setDescription(sagaData.description)
    .setColor(sagaData.color)
    .setFooter({ text: 'Use buttons to navigate between sagas' });

  let mapDisplay = '';
  sagaData.islands.forEach((island, index) => {
    const isUnlocked = userProgress >= index;
    const isCompleted = userProgress > index;
    const isCurrent = userProgress === index;
    
    const status = isUnlocked ? '<:unlocked_IDS:1388596601064390656>' : '<:Padlock_Crown:1388587874084982956>';
    const progress = isCompleted ? ' <:sucess:1375872950321811547>' : isCurrent ? ' 📍' : '';
    mapDisplay += `${status} **${island.name}**${progress}\n`;
    mapDisplay += `   └ Boss: ${island.boss}\n\n`;
  });

  embed.addFields({ name: 'Islands', value: mapDisplay || 'No islands available', inline: false });

  // Add legend
  embed.addFields({ 
    name: 'Legend', 
    value: '<:unlocked_IDS:1388596601064390656> Available • <:Padlock_Crown:1388587874084982956> Locked • <:sucess:1375872950321811547> Completed • 📍 Current Location', 
    inline: false 
  });

  return embed;
}

function createSagaButtons(currentSaga, unlockedSagas) {
  const buttons = [];
  const sagaNames = Object.keys(islandData);
  
  sagaNames.forEach((saga, index) => {
    const isUnlocked = unlockedSagas.includes(saga);
    const isCurrent = saga === currentSaga;
    
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`map_${saga.replace(/\s+/g, '_')}`)
        .setLabel(saga)
        .setStyle(isCurrent ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(!isUnlocked)
    );
  });

  // Split into rows of 3
  const rows = [];
  for (let i = 0; i < buttons.length; i += 3) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 3)));
  }

  return rows;
}

function getUserUnlockedSagas(user) {
  // Determine which sagas the user has unlocked based on their progress
  const currentSagaIndex = sagas.indexOf(user.saga || 'East Blue');
  return sagas.slice(0, currentSagaIndex + 1);
}

function getUserProgressInSaga(user, saga) {
  const exploreStage = user.exploreStage || 0;
  
  // Map explore stages to island progress for East Blue
  if (saga === 'East Blue') {
    if (exploreStage >= 38) return 6; // Completed East Blue
    if (exploreStage >= 30) return 5; // Arlong Park
    if (exploreStage >= 25) return 4; // Baratie  
    if (exploreStage >= 20) return 3; // Syrup Village
    if (exploreStage >= 13) return 2; // Orange Town
    if (exploreStage >= 6) return 1;  // Shells Town
    return 0; // Windmill Village
  }
  
  // For other sagas, check if unlocked and return 0 for now
  const unlockedSagas = user.unlockedSagas || ['East Blue'];
  if (!unlockedSagas.includes(saga)) {
    return -1; // Not unlocked
  }
  
  // Return 0 for unlocked but not started sagas
  return 0;
}

const data = { name: 'map', description: 'View the world map and your exploration progress.' };

async function execute(message, args) {
  const userId = message.author.id;
  const username = message.author.username;
  let user = await User.findOne({ userId });

  if (!user) return message.reply('Start your journey with `op start` first!');

  // Ensure username is set if missing
  if (!user.username) {
    user.username = username;
    await user.save();
  }

  const unlockedSagas = getUserUnlockedSagas(user);
  let currentSaga = user.saga || 'East Blue';

  // Allow viewing specific saga if provided
  const sagaArg = args.join(' ').trim();
  if (sagaArg) {
    const requestedSaga = Object.keys(islandData).find(saga => 
      saga.toLowerCase() === sagaArg.toLowerCase() ||
      saga.toLowerCase().includes(sagaArg.toLowerCase())
    );
    
    if (requestedSaga && unlockedSagas.includes(requestedSaga)) {
      currentSaga = requestedSaga;
    } else if (requestedSaga) {
      return message.reply(`<:arrow:1375872983029256303> You haven't unlocked the "${requestedSaga}" saga yet!`);
    }
  }

  const sagaData = islandData[currentSaga];
  if (!sagaData) {
    return message.reply(`<:arrow:1375872983029256303> Saga "${currentSaga}" not found.`);
  }

  const userProgress = getUserProgressInSaga(user, currentSaga);
  
  const embed = createMapEmbed(currentSaga, sagaData, userProgress);
  const components = createSagaButtons(currentSaga, unlockedSagas);

  const mapMessage = await message.reply({ embeds: [embed], components });

  // Button interaction collector
  const filter = i => i.user.id === userId;
  const collector = mapMessage.createMessageComponentCollector({ filter, time: 300000 });

  collector.on('collect', async interaction => {
    await interaction.deferUpdate();

    if (interaction.customId.startsWith('map_')) {
      const selectedSaga = interaction.customId.replace('map_', '').replace(/_/g, ' ');
      
      if (unlockedSagas.includes(selectedSaga) && islandData[selectedSaga]) {
        currentSaga = selectedSaga;
        const newSagaData = islandData[currentSaga];
        const newUserProgress = getUserProgressInSaga(user, currentSaga);
        
        const newEmbed = createMapEmbed(currentSaga, newSagaData, newUserProgress);
        const newComponents = createSagaButtons(currentSaga, unlockedSagas);
        
        await mapMessage.edit({ embeds: [newEmbed], components: newComponents });
      }
    }
  });

  collector.on('end', () => {
    mapMessage.edit({ components: [] }).catch(() => {});
  });
}


module.exports = { data, execute };