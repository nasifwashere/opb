const fs = require('fs');
const path = require('path');

// Load shop data
function loadShopData() {
  const shopPath = path.resolve('data', 'shop.json');
  if (!fs.existsSync(shopPath)) return { potions: [], equipment: [], legendary: [], items: [] };
  return JSON.parse(fs.readFileSync(shopPath, 'utf8'));
}

// Rarity weights for random drops
const RARITY_WEIGHTS = {
  common: 50,
  uncommon: 25,
  rare: 15,
  epic: 7,
  legendary: 3
};

// Get all items from all categories
function getAllItemsFromShop() {
  const shop = loadShopData();
  const allItems = [];
  
  ['potions', 'equipment', 'legendary', 'items'].forEach(category => {
    if (shop[category]) {
      shop[category].forEach(item => allItems.push(item));
    }
  });
  
  return allItems;
}

// Get weighted random item based on rarity
function getRandomItemByRarity(rarityLevel = 'common') {
  const allItems = getAllItemsFromShop();
  const availableItems = allItems.filter(item => 
    item.rarity === rarityLevel && item.available
  );
  
  if (availableItems.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * availableItems.length);
  return availableItems[randomIndex];
}

// Get items by rarity level (used for specific drops)
function getItemsByRarity(rarity) {
  const allItems = getAllItemsFromShop();
  return allItems.filter(item => item.rarity === rarity && item.available);
}

// Roll for item drop with various conditions
function rollForItemDrop(conditions = {}) {
  const {
    baseChance = 0.15,      // 15% base chance
    bonusChance = 0,        // Additional chance based on conditions
    minRarity = 'common',   // Minimum rarity to drop
    maxRarity = 'legendary' // Maximum rarity to drop
  } = conditions;

  const totalChance = baseChance + bonusChance;
  
  // Check if we get an item drop
  if (Math.random() > totalChance) return null;

  // Determine rarity based on weights
  const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const minIndex = rarityOrder.indexOf(minRarity);
  const maxIndex = rarityOrder.indexOf(maxRarity);
  
  let weightedRarities = [];
  for (let i = minIndex; i <= maxIndex; i++) {
    const rarity = rarityOrder[i];
    const weight = RARITY_WEIGHTS[rarity];
    for (let j = 0; j < weight; j++) {
      weightedRarities.push(rarity);
    }
  }
  
  const selectedRarity = weightedRarities[Math.floor(Math.random() * weightedRarities.length)];
  return getRandomItemByRarity(selectedRarity);
}

// Get exploration rewards based on stage type
function getExplorationReward(stageType, rank = null) {
  let conditions = {
    baseChance: 0.12,
    bonusChance: 0,
    minRarity: 'common',
    maxRarity: 'rare'
  };

  if (stageType === 'boss' && rank) {
    // Boss battles have better rewards
    conditions.baseChance = 0.25;
    conditions.bonusChance = 0.1;
    
    switch (rank) {
      case 'S':
        conditions.minRarity = 'rare';
        conditions.maxRarity = 'legendary';
        break;
      case 'A':
        conditions.minRarity = 'uncommon';
        conditions.maxRarity = 'epic';
        break;
      case 'B':
        conditions.minRarity = 'common';
        conditions.maxRarity = 'rare';
        break;
      default:
        conditions.minRarity = 'common';
        conditions.maxRarity = 'uncommon';
    }
  }

  return rollForItemDrop(conditions);
}

// Get sailing rewards based on location
function getSailingReward(location) {
  let conditions = {
    baseChance: 0.18,
    bonusChance: 0.05,
    minRarity: 'common',
    maxRarity: 'epic'
  };

  // Grand Line has better rewards
  if (location.includes('Grand Line')) {
    conditions.baseChance = 0.25;
    conditions.bonusChance = 0.1;
    conditions.minRarity = 'uncommon';
    conditions.maxRarity = 'legendary';
  }

  return rollForItemDrop(conditions);
}

// Get daily reward
function getDailyReward() {
  const conditions = {
    baseChance: 0.2,
    bonusChance: 0.05,
    minRarity: 'common',
    maxRarity: 'rare'
  };

  return rollForItemDrop(conditions);
}

// Add item to user's inventory
function addItemToInventory(user, item) {
  if (!user.inventory) user.inventory = {};
  
  const itemKey = item.name.toLowerCase().replace(/\s+/g, '');
  
  if (user.inventory[itemKey]) {
    user.inventory[itemKey]++;
  } else {
    user.inventory[itemKey] = 1;
  }
}

// Format item reward text
function formatItemReward(item) {
  if (!item) return '';
  
  const rarityEmojis = {
    'common': '⚪',
    'uncommon': '🟢',
    'rare': '🔵',
    'epic': '🟣',
    'legendary': '🟠'
  };
  
  const emoji = rarityEmojis[item.rarity] || '';
  return `${emoji} **${item.name}** obtained!`;
}

module.exports = {
  loadShopData,
  getAllItemsFromShop,
  getRandomItemByRarity,
  getItemsByRarity,
  rollForItemDrop,
  getExplorationReward,
  getSailingReward,
  getDailyReward,
  addItemToInventory,
  formatItemReward
};