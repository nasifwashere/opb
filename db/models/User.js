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
        name: String,
        rank: String,
        level: { type: Number, default: 1 },
        timesUpgraded: { type: Number, default: 0 }
    }],
    
    inventory: [String],
    equipped: { type: Map, of: String, default: {} },
    team: [String],
    
    // Battle state
    battleState: {
        inBattle: { type: Boolean, default: false },
        enemy: mongoose.Schema.Types.Mixed,
        battleHp: Number,
        turnCount: { type: Number, default: 0 },
        battleLog: [String]
    },
    
    // Explore states for complex exploration system
    exploreStates: {
        inBossFight: { type: Boolean, default: false },
        battleState: mongoose.Schema.Types.Mixed,
        currentStage: mongoose.Schema.Types.Mixed,
        currentLocation: String,
        defeatCooldown: Date
    },
    
    // Cooldowns
    lastExplore: { type: Date, default: null },
    lastBattle: { type: Date, default: null },
    defeatedAt: { type: Date, default: null },
    
    // Quest system
    questData: {
        progress: { type: Map, of: Number, default: {} },
        completed: [String],
        lastReset: {
            daily: { type: Number, default: 0 },
            weekly: { type: Number, default: 0 }
        }
    },
    
    // Boosts
    activeBoosts: [{
        type: String,
        expiresAt: Date,
        multiplier: Number
    }],
    
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now }
});

// Additional indexes for performance
userSchema.index({ beli: -1 });
userSchema.index({ xp: -1 });
userSchema.index({ wins: -1 });

module.exports = mongoose.model('User', userSchema);