const User = require('../db/models/User.js');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { addCardWithTransformation } = require('../utils/cardTransformationSystem.js');
const path = require('path');
const fs = require('fs');

// --- Rank settings and weights ---
const rankSettings = {
    C: { color: 0x2ecc40, rankName: "C", rankImage: "https://files.catbox.moe/7xzfbe.png" },
    B: { color: 0x3498db, rankName: "B", rankImage: "https://files.catbox.moe/d0oebp.png" },
    A: { color: 0x9b59b6, rankName: "A", rankImage: "https://files.catbox.moe/qlntg7.png" },
    S: { color: 0xe67e22, rankName: "S", rankImage: "https://files.catbox.moe/9iq0m3.png" },
    UR: { color: 0xe74c3c, rankName: "UR", rankImage: "https://files.catbox.moe/70hwjn.png" }
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

function loadCardsForSaga(userSaga) {
    const cardsPath = path.resolve('data', 'cards.json');
    if (!fs.existsSync(cardsPath)) {
        throw new Error("cards.json file not found!");
    }
    const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
    // Only allow cards from sagas the user has reached or earlier
    const sagaOrder = [
        'East Blue', 'Alabasta', 'Drum Island', 'Arabasta', 'Jaya', 'Skypiea', 'Water 7', 'Enies Lobby', 'Thriller Bark', 'Sabaody', 'Impel Down', 'Marineford', 'Fishman Island', 'Punk Hazard', 'Dressrosa', 'Zou', 'Whole Cake', 'Wano', 'Final Saga'
    ];
    const userSagaIndex = sagaOrder.indexOf(userSaga);
    return allCards.filter(card => !card.evolvesFrom && sagaOrder.indexOf(card.saga) <= userSagaIndex);
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
        // Don't create user automatically - require op start first
        return null;
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
    
    // Check if user exists - require op start first
    if (!user) {
        const embed = new EmbedBuilder()
            .setColor(0xff6b6b)
            .setTitle('Adventure Not Started')
            .setDescription('You need to start your One Piece adventure first!\n\nUse `op start` to begin your journey.')
            .setFooter({ text: 'Start your adventure with op start' });
        
        return message.reply({ embeds: [embed] });
    }
    
    // Always reload user from DB to ensure latest state (fixes reset token issue)
    user = await User.findOne({ userId });

    let needsSave = false;

    // Set default saga if missing
    if (!user.saga) {
        user.saga = "East Blue";
        needsSave = true;
    }

    // Get the most recent reset time (global or per-user)
    const resetSystem = require('../utils/resetSystem.js');
    const globalLastPullReset = resetSystem.config?.lastPullReset || 0;
    const userLastReset = user.pullData?.lastReset || 0;
    const mostRecentReset = Math.max(globalLastPullReset, userLastReset);

    // Only reset pulls if both are in the past
    if (user.pullData.dailyPulls > 0 && user.pullData.lastReset < mostRecentReset) {
        user.pullData.dailyPulls = 0;
        user.pullData.lastReset = mostRecentReset;
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

    // Calculate pulls remaining at the start
    const pullsRemaining = DAILY_PULL_LIMIT - user.pullData.dailyPulls;

    // Check pull limit
    if (user.pullData.dailyPulls >= DAILY_PULL_LIMIT) {
        // Calculate time left until next reset
        const pullResetInterval = 5 * 60 * 60 * 1000; // 5 hours
        const nextResetTime = mostRecentReset + pullResetInterval;
        const now = Date.now();
        let msLeft = nextResetTime - now;
        if (msLeft < 0) msLeft = 0;
        // Format time left
        function prettyTime(ms) {
            if (ms <= 0) return "Ready";
            let seconds = Math.floor(ms / 1000);
            let minutes = Math.floor(seconds / 60);
            let hours = Math.floor(minutes / 60);
            seconds = seconds % 60;
            minutes = minutes % 60;
            hours = hours % 24;
            let out = [];
            if (hours > 0) out.push(`${hours}h`);
            if (minutes > 0) out.push(`${minutes}m`);
            if (out.length === 0) out.push(`${seconds}s`);
            return out.join(" ");
        }
        return message.reply({
            embeds: [new EmbedBuilder()
                .setColor(0xff775c) // light red
                .setTitle('Pull Limit Reached')
                .setDescription(`You've reached the pull limit for this reset!\n\n⏰ **Next reset:** ${prettyTime(msLeft)}`)
                .setFooter({ text: `Pulls reset in ${prettyTime(msLeft)}` })
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
    
    // Add card to user's collection with evolution transformation
    const cardToAdd = {
        name: card.name,
        rank: card.rank,
        level: 1,
        experience: 0,
        timesUpgraded: 0,
        locked: false
    };
    const addResult = addCardWithTransformation(user, cardToAdd);
    // Save user data with retry mechanism
    try {
        await saveUserWithRetry(user);
    } catch (error) {
        console.error('Error saving pull data:', error);
        return message.reply('There was an error saving your pull. Please try again.');
    }
    // Update quest progress and save user
    await silentUpdateQuestProgress(user, 'pull', 1);
    try {
        await saveUserWithRetry(user);
    } catch (error) {
        console.error('Error saving quest progress:', error);
    }
    // Prepare evolution text
    let evolutionText = "";
    if (card.evolvesFrom) {
        evolutionText = `Evolves from **${card.evolvesFrom}**`;
    }
    // Prepare the embed
    const rankSet = rankSettings[card.rank];
    let description = `${card.shortDesc}\nPHS: ${card.phs}${evolutionText ? `\n${evolutionText}` : ""}`;
    if (addResult && addResult.attachedToTraining) {
        description += `\n\n🎯 **Attached to training card!**\nThis duplicate has been attached to **${addResult.trainingCardName}** currently in training.\nWhen training finishes, you'll receive both the trained card and this duplicate.`;
    } else if (addResult && addResult.autosold) {
        description += `\n\n**Duplicate card auto-sold!** You already owned this card, so it was automatically sold.`;
    } else if (addResult && addResult.autoxp) {
        description += `\n\n✨ **Duplicate card converted to XP!** You already owned this card, so your main card gained **+${addResult.xpAdded} XP**.`;
    }
    // Fix footer for pulls remaining (calculate after the pull is made)
    const pullsLeft = DAILY_PULL_LIMIT - user.pullData.dailyPulls;
    let pullsLeftText = pullsLeft === 0 ? '0 pulls remaining this reset' : `${pullsLeft} pulls remaining this reset`;
    const footerText = addResult && addResult.attachedToTraining 
        ? `Pulled by ${message.author.username} • Attached to training card • ${pullsLeftText}`
        : `Pulled by ${message.author.username} • ${pullsLeftText}`;
    const embed = new EmbedBuilder()
        .setColor(rankSet.color)
        .setTitle(`**${card.name}**`)
        .setDescription(description)
        .setThumbnail(rankSet.rankImage);
    if (card.image && card.image !== "placeholder") {
        embed.setImage(card.image);
    }
    embed.setFooter({
        text: footerText,
        iconURL: message.author.displayAvatarURL()
    });
    await message.reply({ embeds: [embed] });
}

module.exports = { data, execute };