const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true, unique: true },
  username: { type: String, required: true },
  beli: { type: Number, default: 0 },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  stage: { type: Number, default: 0 },
  hp: { type: Number, default: 100 },
  maxHp: { type: Number, default: 100 },
  atk: { type: Number, default: 15 },
  spd: { type: Number, default: 50 },
  def: { type: Number, default: 10 },

  // Collections
  cards: [{
    name: { type: String, required: true },
    rank: { type: String, required: true },
    level: { type: Number, default: 1, min: 1 },
    experience: { type: Number, default: 0, min: 0 },
    timesUpgraded: { type: Number, default: 0, min: 0 },
    locked: { type: Boolean, default: false }
  }],

  team: [{ type: String }], // Array of card names

  // Locked cards stored separately
  case: [{
    name: { type: String, required: true },
    rank: { type: String, required: true },
    level: { type: Number, default: 1, min: 1 },
    experience: { type: Number, default: 0, min: 0 },
    timesUpgraded: { type: Number, default: 0, min: 0 },
    locked: { type: Boolean, default: true }
  }],

  inventory: [{ type: String }],

  // Equipment system - maps card names to equipped item names
  equipped: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Training system - cards currently in training
  training: [{
    cardName: { type: String, required: true },
    rank: { type: String, required: true },
    level: { type: Number, default: 1 },
    experience: { type: Number, default: 0 },
    timesUpgraded: { type: Number, default: 0 },
    locked: { type: Boolean, default: false },
    startTime: { type: Number, required: true }, // Unix timestamp
    accumulatedXP: { type: Number, default: 0 }
  }],

  // Quest System - Fixed structure
  activeQuests: [{
    questId: { type: String, required: true },
    progress: { type: mongoose.Schema.Types.Mixed, default: {} }, // Store as plain object
    startedAt: { type: Number, default: Date.now }
  }],

  completedQuests: [{ type: String }], // Array of "questId_resetPeriod" strings

  // Quest data tracking for migration and consistency
  questData: {
    lastReset: {
      daily: { type: Number, default: 0 },
      weekly: { type: Number, default: 0 }
    },
    migrationVersion: { type: Number, default: 1 }
  },

  // Game progression
  location: { type: String, default: "Foosha Village" },
  unlockedSagas: [{ type: String, default: ["East Blue"] }],
  
  // Timers
  lastDaily: { type: Date },
  nextPullReset: { type: Date },
  
  // Daily reward system
  dailyReward: {
    lastClaimed: { type: Number }, // Unix timestamp
    streak: { type: Number, default: 0, min: 0, max: 7 }
  },
  
  // Pull system
  pullData: {
    dailyPulls: { type: Number, default: 0 },
    lastReset: { type: Number, default: Date.now }
  },

  // Bounty system
  bounty: { type: Number, default: 0 },

  // Gambling system
  gamblingData: {
    lastGamble: { type: Number, default: 0 },
    remainingGambles: { type: Number, default: 3 }
  },
  
  // Trading and market
  tradeOffers: [{
    offerId: String,
    fromUser: String,
    toUser: String,
    fromCards: [String],
    toCards: [String],
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date }
  }],
  
  // Crew system
  crewId: { type: String },
  crewRole: { type: String, default: 'member' },
  
  // Battle system
  battleStats: {
    totalBattles: { type: Number, default: 0 },
    pvpWins: { type: Number, default: 0 },
    pvpLosses: { type: Number, default: 0 },
    pveWins: { type: Number, default: 0 },
    pveLosses: { type: Number, default: 0 }
  },

  // User preferences
  settings: {
    autoTeam: { type: Boolean, default: false },
    notifications: { type: Boolean, default: true },
    publicProfile: { type: Boolean, default: true }
  },

  // Administrative
  banned: { type: Boolean, default: false },
  banReason: { type: String },
  lastActive: { type: Date, default: Date.now }
}, {
  timestamps: true,
  // Ensure proper JSON serialization of Mixed types
  toJSON: { 
    transform: function(doc, ret) {
      // Ensure activeQuests progress is always an object
      if (ret.activeQuests) {
        ret.activeQuests = ret.activeQuests.map(quest => ({
          ...quest,
          progress: quest.progress || {}
        }));
      }
      return ret;
    }
  }
});

// Index for quest operations
userSchema.index({ 'activeQuests.questId': 1 });
userSchema.index({ completedQuests: 1 });

// Pre-save middleware to ensure quest data consistency
userSchema.pre('save', function(next) {
  // Initialize quest arrays if they don't exist
  if (!this.activeQuests) this.activeQuests = [];
  if (!this.completedQuests) this.completedQuests = [];
  if (!this.training) this.training = [];
  if (!this.case) this.case = [];
  
  // Ensure quest data structure exists
  if (!this.questData) {
    this.questData = {
      lastReset: { daily: 0, weekly: 0 },
      migrationVersion: 1
    };
  }
  
  // Ensure pullData structure exists
  if (!this.pullData) {
    this.pullData = {
      dailyPulls: 0,
      lastReset: Date.now()
    };
  }
  
  // Clean up activeQuests - ensure progress is always an object
  this.activeQuests = this.activeQuests.map(quest => ({
    questId: quest.questId,
    progress: (quest.progress && typeof quest.progress === 'object' && !Array.isArray(quest.progress)) 
      ? quest.progress 
      : {},
    startedAt: quest.startedAt || Date.now()
  }));
  
  next();
});

module.exports = mongoose.model('User', userSchema);
