const User = require('../db/models/User.js');

const MAX_TRAINING_CARDS = 3;
const MAX_TRAINING_TIME = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds
const XP_PER_MINUTE = 1;

/**
 * Normalize string for consistent comparison
 */
function normalize(str) {
    return String(str || '').replace(/\s+/g, '').toLowerCase();
}

/**
 * Find a card in user's collection by fuzzy matching
 */
function fuzzyFindCard(cards, input) {
    const normInput = normalize(input);
    let bestMatch = null;
    let bestScore = 0;

    for (const card of cards) {
        const normName = normalize(card.name);
        let score = 0;

        if (normName === normInput) score = 3;
        else if (normName.includes(normInput)) score = 2;
        else if (normName.startsWith(normInput)) score = 1;

        if (score > bestScore) {
            bestScore = score;
            bestMatch = card;
        }
    }

    return bestMatch;
}

/**
 * Calculate accumulated XP for a training card
 */
function calculateTrainingXP(startTime) {
    const currentTime = Date.now();
    const trainingDuration = currentTime - startTime;
    const minutesTrained = Math.floor(trainingDuration / (1000 * 60));
    return minutesTrained * XP_PER_MINUTE;
}

/**
 * Check if card is currently in training
 */
function isCardInTraining(user, cardName) {
    if (!user.training) return false;
    return user.training.some(trainingCard => 
        normalize(trainingCard.cardName) === normalize(cardName)
    );
}

/**
 * Check if card is in user's team
 */
function isCardInTeam(user, cardName) {
    if (!user.team) return false;
    return user.team.some(teamCard => 
        normalize(teamCard) === normalize(cardName)
    );
}

/**
 * Remove card from team
 */
function removeFromTeam(user, cardName) {
    if (!user.team) return;
    const index = user.team.findIndex(teamCard => 
        normalize(teamCard) === normalize(cardName)
    );
    if (index !== -1) {
        user.team.splice(index, 1);
    }
}

/**
 * Start training a card
 */
async function startTraining(userId, cardName) {
    try {
        const user = await User.findOne({ userId });
        if (!user) {
            return { success: false, message: 'User not found. Start your journey with `op start` first!' };
        }

        // Initialize training array if needed
        if (!user.training) user.training = [];

        // Check if user has reached training limit
        if (user.training.length >= MAX_TRAINING_CARDS) {
            return { 
                success: false, 
                message: `You can only train ${MAX_TRAINING_CARDS} cards at once. Use \`op untrain <card>\` to stop training a card first.` 
            };
        }

        // Find the card in user's collection
        const card = fuzzyFindCard(user.cards || [], cardName);
        if (!card) {
            return { success: false, message: `You don't own a card named **${cardName}**.` };
        }

        // Check if card is already in training
        if (isCardInTraining(user, card.name)) {
            return { success: false, message: `**${card.name}** is already in training!` };
        }

        // Remove card from team if it's there
        removeFromTeam(user, card.name);

        // Remove card from user's collection
        const cardIndex = user.cards.findIndex(c => 
            normalize(c.name) === normalize(card.name)
        );
        user.cards.splice(cardIndex, 1);

        // Add to training
        // Always resolve name/rank from cards.json if possible, using fuzzy match
        const cardsPath = require('path').resolve('data', 'cards.json');
        const allCards = JSON.parse(require('fs').readFileSync(cardsPath, 'utf8'));
        let fixedName = card.name;
        let fixedRank = card.rank;
        let def = allCards.find(c => c && c.name && normalize(c.name) === normalize(fixedName));
        if (!def && fixedName) {
            def = fuzzyFindCard(allCards, fixedName);
        }
        if (def) {
            fixedName = def.name;
            fixedRank = def.rank;
        }
        user.training.push({
            name: fixedName,
            cardName: fixedName, // for legacy compatibility
            rank: fixedRank,
            level: card.level || 1,
            experience: card.experience || 0,
            timesUpgraded: card.timesUpgraded || 0,
            locked: card.locked || false,
            startTime: Date.now(),
            accumulatedXP: 0
        });

        // Mark arrays as modified and save
        user.markModified('training');
        user.markModified('cards');
        user.markModified('team');
        await user.save();

        return { 
            success: true, 
            message: `**${card.name}** has started training! They will gain 1 XP per minute.`,
            card: card
        };
    } catch (error) {
        console.error('Error starting training:', error);
        return { success: false, message: 'Failed to start training. Please try again.' };
    }
}

/**
 * Stop training a card and return it with accumulated XP
 */
async function stopTraining(userId, cardName) {
    try {
        const user = await User.findOne({ userId });
        if (!user) {
            return { success: false, message: 'User not found. Start your journey with `op start` first!' };
        }

        // Initialize arrays if needed
        if (!user.training) user.training = [];
        if (!user.cards) user.cards = [];

        // Find the card in training
        const trainingIndex = user.training.findIndex(trainingCard => 
            normalize(trainingCard.cardName) === normalize(cardName)
        );

        if (trainingIndex === -1) {
            return { success: false, message: `**${cardName}** is not currently in training.` };
        }

        const trainingCard = user.training[trainingIndex];
        
        // Calculate total XP gained
        const accumulatedXP = calculateTrainingXP(trainingCard.startTime);
        const totalXP = trainingCard.experience + accumulatedXP;

        // Remove from training
        user.training.splice(trainingIndex, 1);


        // Calculate new level from XP
        const XP_PER_LEVEL = 100;
        const newLevel = Math.floor(totalXP / XP_PER_LEVEL) + 1;

        // Return card to collection with updated XP and level
        const cardsPath = require('path').resolve('data', 'cards.json');
        const allCards = JSON.parse(require('fs').readFileSync(cardsPath, 'utf8'));
        let fixedName = trainingCard.name || trainingCard.cardName;
        let fixedRank = trainingCard.rank;
        // Always resolve from cards.json if possible
        const def = allCards.find(c => c && c.name && normalize(c.name) === normalize(fixedName));
        if (def) {
          fixedName = def.name;
          fixedRank = def.rank;
        }
        
        // Update timesUpgraded to be consistent with new level for legacy compatibility
        const newTimesUpgraded = Math.max(0, newLevel - 1);
        
        const returnedCard = {
          name: fixedName,
          rank: fixedRank,
          level: newLevel,
          experience: totalXP,
          timesUpgraded: newTimesUpgraded, // Keep this consistent with level
          locked: trainingCard.locked
        };
        user.cards.push(returnedCard);
        
        // Add any duplicates that were collected during training back to collection
        const duplicateCount = trainingCard.duplicates || 0;
        for (let i = 0; i < duplicateCount; i++) {
          const duplicateCard = {
            name: fixedName,
            rank: fixedRank,
            level: 1, // Duplicates start at level 1
            experience: 0,
            timesUpgraded: 0,
            locked: false
          };
          user.cards.push(duplicateCard);
        }

        // Mark arrays as modified and save
        user.markModified('training');
        user.markModified('cards');
        await user.save();

        const trainingDuration = Date.now() - trainingCard.startTime;
        const minutesTrained = Math.floor(trainingDuration / (1000 * 60));
        const hoursTrained = Math.floor(minutesTrained / 60);
        const remainingMinutes = minutesTrained % 60;

        const duplicatesMessage = duplicateCount > 0 ? ` (+${duplicateCount} duplicate${duplicateCount > 1 ? 's' : ''} collected during training)` : '';
        
        return { 
            success: true, 
            message: `**${fixedName}** has finished training!${duplicatesMessage}`,
            card: returnedCard,
            xpGained: accumulatedXP,
            totalXP: totalXP,
            duplicatesReturned: duplicateCount,
            trainingTime: { hours: hoursTrained, minutes: remainingMinutes, total: minutesTrained }
        };
    } catch (error) {
        console.error('Error stopping training:', error);
        return { success: false, message: 'Failed to stop training. Please try again.' };
    }
}

/**
 * Get user's training status
 */
async function getTrainingStatus(userId) {
    try {
        const user = await User.findOne({ userId });
        if (!user) {
            return { success: false, message: 'User not found.' };
        }

        if (!user.training || user.training.length === 0) {
            return { 
                success: true, 
                training: [], 
                message: 'No cards are currently in training.' 
            };
        }

        // Calculate current XP for each training card
        const cardsPath = require('path').resolve('data', 'cards.json');
        const allCards = JSON.parse(require('fs').readFileSync(cardsPath, 'utf8'));
        function fuzzyFindCard(cards, input) {
            const normInput = normalize(input);
            let bestMatch = null;
            let bestScore = 0;
            for (const card of cards) {
                const normName = normalize(card.name);
                let score = 0;
                if (normName === normInput) score = 3;
                else if (normName.includes(normInput)) score = 2;
                else if (normName.startsWith(normInput)) score = 1;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = card;
                }
            }
            return bestMatch;
        }
        const trainingStatus = user.training.map(trainingCard => {
            const currentXP = calculateTrainingXP(trainingCard.startTime);
            const totalXP = trainingCard.experience + currentXP;
            const trainingDuration = Date.now() - trainingCard.startTime;
            const minutesTrained = Math.floor(trainingDuration / (1000 * 60));
            const hoursTrained = Math.floor(minutesTrained / 60);
            const remainingMinutes = minutesTrained % 60;
            // Always resolve name/rank from cards.json if possible, using fuzzy match
            let fixedName = trainingCard.name || trainingCard.cardName;
            let fixedRank = trainingCard.rank;
            let def = allCards.find(c => c && c.name && normalize(c.name) === normalize(fixedName));
            if (!def && fixedName) {
                def = fuzzyFindCard(allCards, fixedName);
            }
            if (def) {
                fixedName = def.name;
                fixedRank = def.rank;
            }
            return {
                ...trainingCard,
                name: fixedName,
                rank: fixedRank,
                currentAccumulatedXP: currentXP,
                currentTotalXP: totalXP,
                duplicates: trainingCard.duplicates || 0,
                trainingTime: { hours: hoursTrained, minutes: remainingMinutes, total: minutesTrained }
            };
        });

        return { 
            success: true, 
            training: trainingStatus,
            slotsUsed: user.training.length,
            maxSlots: MAX_TRAINING_CARDS
        };
    } catch (error) {
        console.error('Error getting training status:', error);
        return { success: false, message: 'Failed to get training status.' };
    }
}

/**
 * Auto-untrain cards that have been training for more than a week
 */
async function autoUntrainExpiredCards() {
    try {
        const users = await User.find({ 
            'training.0': { $exists: true } // Users with at least one training card
        });

        let autoUntrainedCount = 0;
        const currentTime = Date.now();

        for (const user of users) {
            if (!user.training) continue;

            const expiredCards = [];
            const remainingCards = [];

            for (const trainingCard of user.training) {
                const trainingDuration = currentTime - trainingCard.startTime;
                
                if (trainingDuration >= MAX_TRAINING_TIME) {
                    // Calculate final XP
                    const accumulatedXP = calculateTrainingXP(trainingCard.startTime);
                    const totalXP = trainingCard.experience + accumulatedXP;
                    
                    // Calculate final level
                    const XP_PER_LEVEL = 100;
                    const finalLevel = Math.floor(totalXP / XP_PER_LEVEL) + 1;

                    // Return card to collection
                    if (!user.cards) user.cards = [];
                    // Always use cards.json for canonical name/rank
                    const cardsPath = require('path').resolve('data', 'cards.json');
                    const allCards = JSON.parse(require('fs').readFileSync(cardsPath, 'utf8'));
                    let fixedName = trainingCard.cardName || trainingCard.name;
                    let fixedRank = trainingCard.rank;
                    const def = allCards.find(c => c && c.name && normalize(c.name) === normalize(trainingCard.cardName || trainingCard.name));
                    if (def) {
                      fixedName = def.name;
                      fixedRank = def.rank;
                    }
                    if (!fixedName) fixedName = '[Unknown Card]';
                    if (!fixedRank) fixedRank = '[Unknown Rank]';
                    
                    // Update timesUpgraded to be consistent with level for legacy compatibility
                    const finalTimesUpgraded = Math.max(0, finalLevel - 1);
                    
                    user.cards.push({
                        name: fixedName,
                        rank: fixedRank,
                        level: finalLevel,
                        experience: totalXP,
                        timesUpgraded: finalTimesUpgraded, // Keep this consistent with level
                        locked: trainingCard.locked
                    });
                    
                    // Add any duplicates that were collected during training back to collection
                    const duplicateCount = trainingCard.duplicates || 0;
                    for (let i = 0; i < duplicateCount; i++) {
                        const duplicateCard = {
                            name: fixedName,
                            rank: fixedRank,
                            level: 1, // Duplicates start at level 1
                            experience: 0,
                            timesUpgraded: 0,
                            locked: false
                        };
                        user.cards.push(duplicateCard);
                    }

                    expiredCards.push({
                        name: fixedName,
                        xpGained: accumulatedXP,
                        totalXP: totalXP
                    });
                    autoUntrainedCount++;
                } else {
                    remainingCards.push(trainingCard);
                }
            }

            if (expiredCards.length > 0) {
                user.training = remainingCards;
                user.markModified('training');
                user.markModified('cards');
                await user.save();

                // TODO: Send DM notification to user about auto-untrained cards
                console.log(`Auto-untrained ${expiredCards.length} cards for user ${user.userId}`);
            }
        }

        if (autoUntrainedCount > 0) {
            console.log(`[TRAINING] Auto-untrained ${autoUntrainedCount} cards that exceeded 1 week training limit`);
        }

        return autoUntrainedCount;
    } catch (error) {
        console.error('Error in auto-untrain:', error);
        return 0;
    }
}

module.exports = {
    startTraining,
    stopTraining,
    getTrainingStatus,
    autoUntrainExpiredCards,
    isCardInTraining,
    MAX_TRAINING_CARDS,
    MAX_TRAINING_TIME
};