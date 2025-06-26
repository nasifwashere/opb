const mongoose = require('mongoose');

const questSchema = new mongoose.Schema({
  questId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, enum: ['daily', 'weekly', 'story'], required: true },
  requirements: [{
    type: { type: String, required: true }, // 'battle_win', 'explore', 'pull', 'evolve', etc.
    target: { type: Number, required: true },
    current: { type: Number, default: 0 }
  }],
  rewards: [{
    type: { type: String, required: true }, // 'beli', 'xp', 'item', 'card'
    amount: { type: Number },
    itemName: { type: String }
  }],
  unlockRequirements: {
    saga: { type: String },
    level: { type: Number },
    completedQuests: [{ type: String }]
  },
  active: { type: Boolean, default: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Quest', questSchema);
