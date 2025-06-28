const mongoose = require('mongoose');

const cardInstanceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rank: { type: String, required: true },
  level: { type: Number, default: 1 },
  timesUpgraded: { type: Number, default: 0 },
  locked: { type: Boolean, default: false },
  experience: { type: Number, default: 0 }
});

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  beli: { type: Number, default: 500 },
  xp: { type: Number, default: 0 },
  saga: { type: String, default: 'East Blue' },
  team: [{ type: String }],
  cards: [cardInstanceSchema],
  inventory: [{ type: String }],
  equipped: { type: Map, of: String },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  pulls: [{ type: Number }],
  lastPull: { type: Number, default: 0 },
  exploreStage: { type: Number, default: 0 },
  exploreLast: { type: Number, default: 0 },
  exploreLossCooldown: { type: Number, default: 0 },
  exploreLog: [{
    saga: String,
    step: Number,
    event: String,
    time: { type: Number, default: Date.now }
  }],
  location: { type: String, default: 'Windmill Village' },
  lastDaily: { type: Number, default: 0 },
  completedQuests: [{ type: String }],
  activeQuests: [{
    questId: String,
    progress: { type: Map, of: Number },
    startedAt: { type: Number, default: Date.now }
  }],
  settings: {
    notifications: { type: Boolean, default: true },
    duelAccept: { type: String, default: 'manual' },
    language: { type: String, default: 'en' }
  },
  battleCooldown: { type: Number, default: 0 },
  duelCooldown: { type: Number, default: 0 },
  disallowedCards: [{ type: String }],
  locationCooldowns: { type: Map, of: Number },
  activeBoosts: [{
    type: String,
    expiresAt: Number,
    multiplier: Number
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
