// removeLegacyItems.js
// Script to remove unwanted legacy items from all users' inventories
const mongoose = require('mongoose');
const User = require('./db/models/User');

const REMOVE_ITEMS = [
  'luckycharm',
  'healingpotion',
  'powerboost',
  'treasuremapfragment'
];

function normalize(str) {
  return String(str || '').replace(/\s+/g, '').toLowerCase();
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/opb');
  const users = await User.find({});
  for (const user of users) {
    if (!Array.isArray(user.inventory)) continue;
    const before = user.inventory.length;
    user.inventory = user.inventory.filter(item => !REMOVE_ITEMS.includes(normalize(item)));
    if (user.inventory.length !== before) {
      await user.save();
      console.log(`Cleaned inventory for user ${user.userId}`);
    }
  }
  console.log('Done.');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
