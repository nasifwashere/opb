// Script to migrate all user inventories to a flat array of strings
const mongoose = require('mongoose');
const User = require('../db/models/User.js');

async function migrateInventories() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/opb');
  const users = await User.find({});
  let fixed = 0;

  for (const user of users) {
    let changed = false;
    if (!Array.isArray(user.inventory)) {
      if (user.inventory && typeof user.inventory === 'object') {
        user.inventory = Object.keys(user.inventory).reduce((arr, key) => {
          for (let i = 0; i < user.inventory[key]; i++) arr.push(key);
          return arr;
        }, []);
        changed = true;
      } else {
        user.inventory = [];
        changed = true;
      }
    } else {
      // Flatten and stringify all entries
      const flat = user.inventory.flat().map(String);
      if (JSON.stringify(flat) !== JSON.stringify(user.inventory)) {
        user.inventory = flat;
        changed = true;
      }
    }
    if (changed) {
      await user.save();
      fixed++;
      console.log(`Fixed inventory for user ${user.userId}`);
    }
  }
  console.log(`Migration complete. Fixed ${fixed} users.`);
  await mongoose.disconnect();
}

migrateInventories().catch(e => { console.error(e); process.exit(1); });
