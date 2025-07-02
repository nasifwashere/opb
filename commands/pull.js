const User = require('../db/models/User.js');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

// --- Rank settings and weights ---
const rankSettings = {
    C: { color: 0x2ecc40, rankName: "C", rankImage: "https://files.catbox.moe/80exn1.png" },
    B: { color: 0x3498db, rankName: "B", rankImage: "https://files.catbox.moe/ta2g9o.png" },
    A: { color: 0x9b59b6, rankName: "A", rankImage: "https://files.catbox.moe/hcyso9.png" },
    S: { color: 0xe67e22, rankName: "S", rankImage: "https://files.catbox.moe/niidag.png" },
    UR: { color: 0xe74c3c, rankName: "UR", rankImage: "https://via.placeholder.com/32x32/e74c3c/ffffff?text=UR" }
};

const rankWeights = [
    { rank: 'C', weight: 80 },
    { rank: 'B', weight: 17 },
    { rank: 'A', weight: 2.7 },
    { rank: 'S', weight: 0.3 }
];

const DAILY_PULL_LIMIT = 5; // pulls allowed per day

// --- Helper Functions ---
function prettyTime(ms) {
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    
    minutes = minutes % 60;
    seconds = seconds % 60;
    
    let out = [];
    if (hours > 0) out.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
    if (minutes > 0) out.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
    if (out.length === 0) out.push(`${seconds} seconds`);
    
    return out.join(", ");
}

function weightedRandomRank() {
    const total = rankWeights.reduce((t, r) => t + r.weight, 0);
    const rand = Math.random() * total;
    let sum = 0;
    
    for (const r of rankWeights) {
        sum += r.weight;
        if (rand < sum) return r.rank;
    }
    
    return rankWeights[rankWeights.length - 1].rank;
}

function loadCardsForSaga(saga = "East Blue") {
    const cardsPath = path.resolve('data', 'cards.json');
    
    if (!fs.existsSync(cardsPath)) {
        throw new Error("cards.json file not found!");
    }
    
    const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
    return allCards;
}

// Only pick cards that are NOT evolved forms (i.e., only cards without evolvesFrom)
function pickCard(cards, rank) {
    const filtered = cards.filter(card => card.rank === rank && !card.evolvesFrom);
    
    if (filtered.length > 0) {
        return filtered[Math.floor(Math.random() * filtered.length)];
    }
    
    const baseCards = cards.filter(card => !card.evolvesFrom);
    if (baseCards.length > 0) {
        return baseCards[Math.floor(Math.random() * baseCards.length)];
    }
    
    return cards[Math.floor(Math.random() * cards.length)];
}

// --- User State Management ---
async function getUserPullState(userId, username) {
    let user = await User.findOne({ userId });
    
    if (!user) {
        const config = require('../config.json');
        user = new User({
            userId: userId,
            username: username || `User_${userId.slice(-4)}`,
            beli: config.defaultCurrency || 500,
            xp: 0,
            level: 1,
            stage: 0,
            hp: 100,
            maxHp: 100,
            atk: 15,
            spd: 50,
            def: 10,
            wins: 0,
            losses: 0,
            saga: "East Blue",
            team: [],
            pulls: [],
            lastPull: 0,
            cards: [],
            inventory: ["Basic Potion", "Basic Potion", "Basic Potion"],
            equipped: new Map(),
            battleState: {
                inBattle: false,
                enemy: null,
                battleHp: 100,
                turnCount: 0,
                battleLog: []
            },
            exploreStates: {
                inBossFight: false,
                battleState: null,
                currentStage: null,
                currentLocation: null,
                defeatCooldown: null
            },
            lastExplore: null,
            lastBattle: null,
            defeatedAt: null,
            questData: {
                progress: new Map(),
                completed: [],
                lastReset: {
                    daily: 0,
                    weekly: 0
                }
            },
            pullData: {
                dailyPulls: 0,
                lastReset: Date.now()
            },
            activeBoosts: [],
            createdAt: new Date(),
            lastActive: new Date()
        });
        
        await saveUserWithRetry(user);
    }
    
    // Initialize pullData if missing for existing users (one-time only)
    if (!user.pullData) {
        user.pullData = {
            dailyPulls: 0,
            lastReset: Date.now()
        };
        await saveUserWithRetry(user);
    }
    
    // Ensure username is set if missing
    if (!user.username) {
        user.username = username;
    }
    
    return user;
}

// Silent quest progress update (no console spam)
async function silentUpdateQuestProgress(user, actionType, amount) {
    try {
        const { updateQuestProgress } = require('../utils/questSystem.js');
        
        // Override console.log temporarily to suppress quest spam
        const originalLog = console.log;
        console.log = () => {}; // Suppress all console.log during quest update
        
        const result = await updateQuestProgress(user, actionType, amount);
        
        // Restore original console.log
        console.log = originalLog;
        
        return result;
    } catch (error) {
        // Restore console.log in case of error
        console.log = console.log.originalLog || console.log;
        return [];
    }
}

// Safe save with retry mechanism for version conflicts
async function saveUserWithRetry(user, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await user.save();
            return true;
        } catch (error) {
            if (error.name === 'VersionError' && attempt < maxRetries) {
                // Refresh the user document and try again
                const freshUser = await User.findById(user._id);
                if (freshUser) {
                    // Copy our changes to the fresh document
                    freshUser.pullData = user.pullData;
                    freshUser.lastPull = user.lastPull;
                    freshUser.pulls = user.pulls;
                    freshUser.cards = user.cards;
                    freshUser.saga = user.saga;
                    user = freshUser;
                    continue;
                }
            }
            throw error;
        }
    }
    return false;
}

// --- Command Export ---
const data = new SlashCommandBuilder()
    .setName('pull')
    .setDescription('Pull a random card from the East Blue saga. (5 pulls per day)');

async function execute(message) {
    const userId = message.author.id;
    const username = message.author.username;
    let user = await getUserPullState(userId, username);
    
    let needsSave = false;
    
    // Set default saga if missing
    if (!user.saga) {
        user.saga = "East Blue";
        needsSave = true;
    }
    
    // Check if user needs individual reset (fallback in case global reset missed them)
    const resetSystem = require('../utils/resetSystem.js');
    if (resetSystem.shouldResetUserPulls(user)) {
        user.pullData.dailyPulls = 0;
        user.pullData.lastReset = Date.now();
        needsSave = true;
    }
    
    // Save any pending changes before checking limits
    if (needsSave) {
        try {
            await saveUserWithRetry(user);
        } catch (error) {
            console.error('Error saving user data:', error);
            return message.reply('There was an error processing your request. Please try again.');
        }
    }
    
    // Check daily pull limit
    if (user.pullData.dailyPulls >= DAILY_PULL_LIMIT) {
        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor(0xff6b6b)
                .setTitle('Daily Pull Limit Reached!')
                .setDescription(`You've used all **${DAILY_PULL_LIMIT}** of your daily pulls!\n\n⏰ **Next reset:** Check \`op timers\` for reset time`)
                .setFooter({ text: 'Pulls reset every 5 hours globally' })
            ]
        });
    }
    
    // Load cards
    let cards;
    try {
        cards = loadCardsForSaga(user.saga);
    } catch (error) {
        return message.reply('Error loading card data. Please try again later.');
    }
    
    // Choose rank and card
    const rank = weightedRandomRank();
    const card = pickCard(cards, rank);
    
    // Increment daily pull counter
    user.pullData.dailyPulls += 1;
    user.lastPull = Date.now();
    
    // Add to legacy pulls array for compatibility (keep last 5)
    if (!user.pulls) user.pulls = [];
    user.pulls.push(Date.now());
    if (user.pulls.length > DAILY_PULL_LIMIT) {
        user.pulls = user.pulls.slice(-DAILY_PULL_LIMIT);
    }
    
    // Add card to user's collection
    if (!user.cards) user.cards = [];
    user.cards.push({
        name: card.name,
        rank: card.rank,
        level: 1,
        experience: 0,
        timesUpgraded: 0,
        locked: false
    });
    
    // Save user data with retry mechanism
    try {
        await saveUserWithRetry(user);
    } catch (error) {
        console.error('Error saving pull data:', error);
        return message.reply('There was an error saving your pull. Please try again.');
    }
    
    // Update quest progress silently (this handles its own saves)
    await silentUpdateQuestProgress(user, 'pull', 1);
    
    // Prepare evolution text
    let evolutionText = "";
    if (card.evolvesFrom) {
        evolutionText = `Evolves from **${card.evolvesFrom}**`;
    }
    
    // Prepare the embed
    const rankSet = rankSettings[card.rank];
    const embed = new EmbedBuilder()
        .setColor(rankSet.color)
        .setTitle(`**${card.name}**`)
        .setDescription(`${card.shortDesc}\nPHS: ${card.phs}${evolutionText ? `\n${evolutionText}` : ""}`)
        .setThumbnail(rankSet.rankImage);
    
    if (card.image && card.image !== "placeholder") {
        embed.setImage(card.image);
    }
    
    const pullsRemaining = DAILY_PULL_LIMIT - user.pullData.dailyPulls;
    embed.setFooter({
        text: `Pulled by ${message.author.username} • ${pullsRemaining} pulls remaining today`,
        iconURL: message.author.displayAvatarURL()
    });
    
    await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };