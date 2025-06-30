const name = 'ready';
const once = true;
const fs = require('fs').promises;
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../config.json');

async function execute(client) {
  console.log(`[READY] Logged in as ${client.user.tag}!`);
  
  // Auto-start drop timer if drops channel is configured
  try {
    const configData = await fs.readFile(CONFIG_PATH, 'utf8');
    const config = JSON.parse(configData);
    
    if (config.dropChannelId) {
      const { startDropTimer } = require('../commands/mod/setDrops.js');
      startDropTimer(client);
      console.log('Auto-started drop timer from config');
    }
  } catch (error) {
    console.log('No config found or drops not configured');
  }
}

module.exports = { name, once, execute };
