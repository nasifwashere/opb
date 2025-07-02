const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { calculateBattleStats, calculateDamage, resetTeamHP } = require('../utils/battleSystem.js');
const { distributeXPToTeam, XP_PER_LEVEL } = require('../utils/levelSystem.js');
const path = require('path');
const fs = require('fs');
const { updateQuestProgress } = require('../utils/questSystem.js');

// Location data based on your specifications
const LOCATIONS = {
    'WINDMILL VILLAGE': [
        {
            type: "narrative",
            title: "Your Journey Commences",
            desc: "You ate the Gum-Gum Fruit! Your rubber powers awaken as your adventure begins in Windmill Village.",
            reward: { type: "xp", amount: 50 }
        },
        {
            type: "narrative",
            title: "Meeting Shanks",
            desc: "You encounter the legendary Red-Haired Shanks at the bar. His presence fills you with determination.",
            reward: { type: "beli", amount: 50 }
        },
        {
            type: "narrative",
            title: "Set Out to Sea",
            desc: "You prepare to leave Windmill Village behind and chase your dream of becoming Pirate King!",
            reward: { type: "xp", amount: 25 }
        },
        {
            type: "boss",
            title: "Fight with Higuma",
            desc: "The mountain bandit Higuma blocks your path!",
            enemy: { name: "Higuma", hp: 60, atk: [8, 12], spd: 45, rank: "C" },
            reward: { type: "multiple", rewards: [
                { type: "beli", amount: 100 },
                { type: "xp", amount: 50 }
            ]},
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Shanks' Sacrifice",
            desc: "The Sea King attacks! Shanks loses his arm saving you. His sacrifice strengthens your resolve.",
            reward: { type: "item", name: "Straw Hat" }
        },
        {
            type: "narrative",
            title: "Arrived at Romance Dawn",
            desc: "You finally arrive at Romance Dawn Island, ready to begin your grand adventure!",
            reward: { type: "beli", amount: 75 }
        },
        {
            type: "narrative",
            title: "Final Departure",
            desc: "With Shanks' hat on your head, you set sail to begin your grand adventure!",
            reward: { type: "xp", amount: 75 }
        }
    ],
    'SHELLS TOWN': [
        {
            type: "narrative", 
            title: "Arrival at Shells Town",
            desc: "You arrive at the Marine base town, seeking your first crew member.",
            reward: { type: "xp", amount: 30 }
        },
        {
            type: "narrative",
            title: "Meet Coby",
            desc: "You encounter the timid Coby, who dreams of becoming a Marine. He tells you about the famous pirate hunter Zoro.",
            reward: { type: "xp", amount: 30 }
        },
        {
            type: "choice",
            title: "Free Zoro?",
            desc: "You find Zoro tied up in the Marine base courtyard. Do you want to free the legendary pirate hunter?",
            choice: {
                yes: { type: "card", name: "Roronoa Zoro", rank: "C" },
                no: { type: "beli", amount: 25 }
            }
        },
        {
            type: "enemy",
            title: "Fight Helmeppo",
            desc: "The spoiled Marine captain's son challenges you!",
            enemy: { name: "Helmeppo", hp: 20, atk: [1, 2], spd: 30, rank: "D" },
            reward: { type: "multiple", rewards: [
                { type: "beli", amount: 50 },
                { type: "xp", amount: 25 }
            ]},
            loseCooldown: 30 * 60 * 1000
        },
        {
            type: "multi_enemy",
            title: "Fight Marine Squad",
            desc: "Three Marines block your escape!",
            enemies: [
                { name: "Marine Grunt #1", hp: 15, atk: [2, 4], spd: 25, rank: "D" },
                { name: "Marine Grunt #2", hp: 15, atk: [2, 4], spd: 25, rank: "D" },
                { name: "Marine Grunt #3", hp: 15, atk: [2, 4], spd: 25, rank: "D" }
            ],
            reward: { type: "multiple", rewards: [
                { type: "beli", amount: 75 },
                { type: "xp", amount: 40 }
            ]},
            loseCooldown: 45 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Gathering Strength",
            desc: "You and your crew prepare for the upcoming battle against Captain Morgan.",
            reward: { type: "item", name: "Marine Sword" }
        },
        {
            type: "boss",
            title: "Captain Morgan",
            desc: "The tyrannical Axe-Hand Morgan appears to stop you!",
            enemy: { name: "Captain Morgan", hp: 100, atk: [12, 15], spd: 60, rank: "C" },
            reward: { type: "beli", amount: 200, xp: 100 },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Departure to Orange Town",
            desc: "With Morgan defeated, you sail toward Orange Town where new adventures await.",
            reward: { type: "beli", amount: 100 }
        }
    ],
    'ORANGE TOWN': [
        {
            type: "narrative",
            title: "Meet Nami",
            desc: "You encounter a clever orange-haired thief named Nami. She seems interested in your crew but remains cautious.",
            reward: { type: "xp", amount: 40 }
        },
        {
            type: "narrative",
            title: "Buggy's Terror",
            desc: "The town is in chaos! Buggy the Clown's crew has been terrorizing the innocent villagers.",
            reward: { type: "beli", amount: 60 }
        },
        {
            type: "narrative",
            title: "Planning the Attack",
            desc: "You devise a strategy to take down Buggy's crew and free the town from their reign of terror.",
            reward: { type: "item", name: "Town Map" }
        },
        {
            type: "narrative",
            title: "Circus Preparation",
            desc: "Buggy's crew prepares for their deadly circus performance. The tension in the air is thick.",
            reward: { type: "xp", amount: 35 }
        },
        {
            type: "enemy",
            title: "Fight Cabaji",
            desc: "Buggy's acrobatic swordsman Cabaji challenges you to a duel!",
            enemy: { name: "Cabaji", hp: 70, atk: [10, 15], spd: 70, rank: "C" },
            reward: { type: "beli", amount: 120, xp: 60 },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "boss",
            title: "Buggy the Clown",
            desc: "The Devil Fruit user Buggy appears! His Chop-Chop powers make sword attacks useless!",
            enemy: { name: "Buggy", hp: 120, atk: [15, 20], spd: 65, rank: "B", ability: "sword_immunity" },
            reward: { type: "beli", amount: 300, xp: 120 },
            loseCooldown: 90 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Nami Joins!",
            desc: "Impressed by your victory over Buggy, Nami officially joins your crew as navigator!",
            reward: { type: "card", name: "Nami", rank: "C" }
        }
    ],
    'SYRUP VILLAGE': [
        {
            type: "narrative",
            title: "Peaceful Village",
            desc: "You arrive at the seemingly peaceful Syrup Village, unaware of the danger lurking beneath.",
            reward: { type: "beli", amount: 80 }
        },
        {
            type: "narrative",
            title: "Meet Usopp",
            desc: "You meet the village storyteller Usopp, who dreams of becoming a brave warrior of the sea!",
            reward: { type: "card", name: "Usopp", rank: "C" }
        },
        {
            type: "multi_enemy",
            title: "Fight Sham and Buchi",
            desc: "The cat brothers of the Black Cat Pirates attack!",
            enemies: [
                { name: "Sham", hp: 70, atk: [10, 10], spd: 55, rank: "C" },
                { name: "Buchi", hp: 70, atk: [10, 10], spd: 55, rank: "C" }
            ],
            reward: { type: "multiple", rewards: [
                { type: "beli", amount: 150 },
                { type: "xp", amount: 80 }
            ]},
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "boss",
            title: "Captain Kuro",
            desc: "The cunning Captain Kuro reveals himself! His incredible speed gives him the first strike!",
            enemy: { name: "Captain Kuro", hp: 130, atk: [17, 22], spd: 90, rank: "B", ability: "first_strike" },
            reward: { type: "beli", amount: 400, xp: 150 },
            loseCooldown: 90 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Go to Baratie",
            desc: "With Kuro defeated, you set sail for the floating restaurant Baratie!",
            reward: { type: "xp", amount: 60 }
        }
    ],
    'BARATIE': [
        {
            type: "narrative",
            title: "Speed Boost Food",
            desc: "The chefs at Baratie prepare special dishes that enhance your crew's speed!",
            reward: { type: "item", name: "Speed Boost Food", count: 3 }
        },
        {
            type: "narrative",
            title: "Meet Sanji",
            desc: "You meet the passionate cook Sanji, whose kicks are as fiery as his cooking!",
            reward: { type: "card", name: "Sanji", rank: "B" }
        },
        {
            type: "narrative",
            title: "Mihawk Appears",
            desc: "The World's Greatest Swordsman, Dracule Mihawk, makes a brief but intimidating appearance.",
            reward: { type: "xp", amount: 100 }
        },
        {
            type: "boss",
            title: "Don Krieg",
            desc: "The armored pirate Don Krieg attacks! His armor reflects damage back to attackers!",
            enemy: { name: "Don Krieg", hp: 82, atk: [11, 17], spd: 65, rank: "A", ability: "damage_reflection" },
            reward: { type: "beli", amount: 500, xp: 200 },
            loseCooldown: 120 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Reach Arlong Park",
            desc: "Your crew sets sail for the dangerous waters of Arlong Park, Nami's troubled past awaits.",
            reward: { type: "beli", amount: 120 }
        }
    ],
    'ARLONG PARK': [
        {
            type: "narrative",
            title: "Nami's Past",
            desc: "You learn the truth about Nami's connection to the fish-men and her tragic past.",
            reward: { type: "xp", amount: 80 }
        },
        {
            type: "narrative",
            title: "Fish-Man Supremacy",
            desc: "The fish-men boast about their superiority over humans. Their arrogance fuels your determination.",
            reward: { type: "beli", amount: 100 }
        },
        {
            type: "narrative",
            title: "Preparing for War",
            desc: "You rally the villagers and prepare for the final battle against Arlong's crew.",
            reward: { type: "item", name: "Battle Banner" }
        },
        {
            type: "enemy",
            title: "Fight Chew",
            desc: "The fish-man Chew attacks with his water-spitting abilities!",
            enemy: { name: "Chew", hp: 80, atk: [15, 15], spd: 60, rank: "C" },
            reward: { type: "beli", amount: 130, xp: 70 },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "enemy",
            title: "Fight Kuroobi",
            desc: "The ray fish-man Kuroobi demonstrates his fish-man karate!",
            enemy: { name: "Kuroobi", hp: 80, atk: [16, 16], spd: 65, rank: "C" },
            reward: { type: "beli", amount: 140, xp: 75 },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "enemy",
            title: "Fight Hachi",
            desc: "The six-sword wielding octopus fish-man Hachi blocks your path!",
            enemy: { name: "Hachi", hp: 80, atk: [17, 17], spd: 70, rank: "C" },
            reward: { type: "beli", amount: 150, xp: 80 },
            loseCooldown: 60 * 60 * 1000
        },
        {
            type: "boss",
            title: "Arlong",
            desc: "The saw-shark fish-man Arlong emerges for the final battle! His reign of terror ends here!",
            enemy: { name: "Arlong", hp: 200, atk: [20, 30], spd: 85, rank: "A" },
            reward: { type: "beli", amount: 750, xp: 300 },
            loseCooldown: 120 * 60 * 1000
        },
        {
            type: "narrative",
            title: "Alabasta Unlocked!",
            desc: "With Arlong defeated, you've completed the East Blue saga! The Grand Line awaits - Alabasta arc is now unlocked!",
            reward: { type: "saga_unlock", saga: "Alabasta" },
            questTrigger: "saga_complete"
        }
    ]
};

const LOCATION_COOLDOWNS = {
    'WINDMILL VILLAGE': 1 * 60 * 1000, // 1 minute
    'SHELLS TOWN': 3 * 60 * 1000, // 3 minutes
    'ORANGE TOWN': 3 * 60 * 1000, // 3 minutes
    'SYRUP VILLAGE': 4 * 60 * 1000, // 4 minutes
    'BARATIE': 5 * 60 * 1000, // 5 minutes
    'ARLONG PARK': 6 * 60 * 1000 // 6 minutes
};

const DEFEAT_COOLDOWN = 5 * 60 * 1000; // 5 minutes on defeat
const IMMUNE_USER_ID = 1257718161298690119; // Set to your user ID for immunity

function normalizeItemName(item) {
    return item.replace(/\s+/g, '').toLowerCase();
}

function addToInventory(user, item) {
    if (!user.inventory) user.inventory = [];
    const normItem = normalizeItemName(item);
    if (!user.inventory.map(normalizeItemName).includes(normItem)) {
        user.inventory.push(normItem);
    }
}

async function addXP(user, amount) {
    const xpBoost = user.activeBoosts?.find(boost => 
        boost.type === 'double_xp' && boost.expiresAt > Date.now()
    );
    const finalAmount = xpBoost ? amount * 2 : amount;

    // Add to user's total XP
    user.xp = (user.xp || 0) + finalAmount;

    // Distribute XP to team members and handle level ups
    if (user.team && user.team.length > 0) {
        const levelUpChanges = distributeXPToTeam(user, finalAmount);

        // Store level up information for display
        if (levelUpChanges && levelUpChanges.length > 0) {
            if (!user.recentLevelUps) user.recentLevelUps = [];
            user.recentLevelUps.push(...levelUpChanges);
        }

        // Mark the user document as modified to ensure cards array is saved
        user.markModified('cards');

        // Save the user document to persist XP changes
        try {
            await user.save();
            console.log('User XP data saved successfully');
        } catch (error) {
            console.error('Error saving user XP data:', error);
        }
    }
}

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

function createHpBar(current, max) {
    const percentage = Math.max(0, current / max);
    const barLength = 10;
    const filledBars = Math.round(percentage * barLength);
    const emptyBars = barLength - filledBars;
    return '█'.repeat(filledBars) + '░'.repeat(emptyBars);
}

function getCurrentLocation(stage) {
    if (stage < 7) return 'WINDMILL VILLAGE';
    if (stage < 16) return 'SHELLS TOWN';  // Shells Town has 9 stages (7-15)
    if (stage < 23) return 'ORANGE TOWN';  // Orange Town has 7 stages (16-22)
    if (stage < 28) return 'SYRUP VILLAGE'; // Syrup Village has 5 stages (23-27)
    if (stage < 33) return 'BARATIE';      // Baratie has 5 stages (28-32)
    if (stage < 42) return 'ARLONG PARK';  // Arlong Park has 9 stages (33-41)
    return 'COMPLETED';
}

function getLocalStage(globalStage) {
    if (globalStage < 7) return globalStage;
    if (globalStage < 16) return globalStage - 7;
    if (globalStage < 23) return globalStage - 16;
    if (globalStage < 28) return globalStage - 23;
    if (globalStage < 33) return globalStage - 28;
    if (globalStage < 42) return globalStage - 33;
    return 0;
}

function getTotalStagesInLocation(location) {
    return LOCATIONS[location] ? LOCATIONS[location].length : 0;
}

const data = new SlashCommandBuilder()
  .setName('explore')
  .setDescription('Begin or continue your adventure in the One Piece world!');

async function execute(message, args, client) {
    const userId = message.author.id;
    let user = await User.findOne({ userId });

    if (!user) {
        return message.reply('Start your journey with `op start`!');
    }

    // Initialize user progress if needed
    if (user.stage === undefined) user.stage = 0;
    if (!user.exploreStates) user.exploreStates = {};

    // === STUCK STATE DETECTION AND CLEANUP ===
    let wasStuck = false;
    let fixedIssues = [];

    // Fix 1: Check for corrupted battle state
    if (user.exploreStates.inBossFight) {
        const battleState = user.exploreStates.battleState;
        const stageData = user.exploreStates.currentStage;
        
        // If battle state is corrupted or missing critical data
        if (!battleState || !stageData || !battleState.userTeam || !battleState.enemies) {
            user.exploreStates.inBossFight = false;
            user.exploreStates.battleState = null;
            user.exploreStates.currentStage = null;
            user.exploreStates.currentLocation = null;
            wasStuck = true;
            fixedIssues.push('Corrupted battle state');
        }
        // If all enemies are defeated but still in battle
        else if (battleState.enemies && battleState.enemies.every(e => e.currentHp <= 0)) {
            user.exploreStates.inBossFight = false;
            user.exploreStates.battleState = null;
            user.exploreStates.currentStage = null;
            user.exploreStates.currentLocation = null;
            user.stage++; // Advance stage
            wasStuck = true;
            fixedIssues.push('Stuck in completed battle');
        }
        // If all team members are defeated but still in battle
        else if (battleState.userTeam && battleState.userTeam.every(card => card.currentHp <= 0)) {
            user.exploreStates.inBossFight = false;
            user.exploreStates.battleState = null;
            user.exploreStates.currentStage = null;
            user.exploreStates.currentLocation = null;
            user.exploreStates.defeatCooldown = Date.now() + (30 * 60 * 1000); // 30 min cooldown
            wasStuck = true;
            fixedIssues.push('Stuck in lost battle');
        }
    }

    // Fix 2: Check for invalid stage numbers
    if (user.stage < 0) {
        user.stage = 0;
        wasStuck = true;
        fixedIssues.push('Invalid negative stage');
    }

    const maxStage = Object.values(LOCATIONS).reduce((total, location) => total + location.length, 0);
    if (user.stage > maxStage) {
        user.stage = maxStage - 1;
        wasStuck = true;
        fixedIssues.push('Stage beyond available content');
    }

    // Fix 3: Clear excessively long defeat cooldowns (over 24 hours)
    if (user.exploreStates.defeatCooldown && user.exploreStates.defeatCooldown > Date.now() + (24 * 60 * 60 * 1000)) {
        user.exploreStates.defeatCooldown = null;
        wasStuck = true;
        fixedIssues.push('Excessive defeat cooldown');
    }

    // Fix 4: Specific fix for Orange Town bug (stage 23)
    if (user.stage === 23) {
        // Users stuck at stage 23 due to Orange Town array length mismatch
        user.stage = 23; // Set to corrected Syrup Village start
        wasStuck = true;
        fixedIssues.push('Orange Town transition bug');
    }

    // Fix 5: Check for stuck location transitions
    const currentLoc = getCurrentLocation(user.stage);
    const localStg = getLocalStage(user.stage);
    const locData = LOCATIONS[currentLoc];
    
    if (currentLoc !== 'COMPLETED' && locData && localStg >= locData.length) {
        // Auto-advance to next location
        const currentLocationIndex = Object.keys(LOCATIONS).indexOf(currentLoc);
        if (currentLocationIndex >= 0 && currentLocationIndex < Object.keys(LOCATIONS).length - 1) {
            let nextLocationStartStage = 0;
            const locationNames = Object.keys(LOCATIONS);
            for (let i = 0; i <= currentLocationIndex; i++) {
                nextLocationStartStage += LOCATIONS[locationNames[i]].length;
            }
            user.stage = nextLocationStartStage;
            wasStuck = true;
            fixedIssues.push('Stuck between locations');
        }
    }

    // Fix 6: Validate team state for battles
    if (user.team && user.team.length > 0) {
        // Check if team has valid cards
        const validTeam = user.team.filter(cardName => {
            const userCard = user.cards?.find(card => card.name === cardName);
            return userCard && userCard.level >= 1;
        });
        
        if (validTeam.length === 0 && user.team.length > 0) {
            user.team = []; // Clear invalid team
            wasStuck = true;
            fixedIssues.push('Invalid team composition');
        }
    }

    // Save fixes if any were applied
    if (wasStuck) {
        await user.save();
        
        const fixEmbed = new EmbedBuilder()
            .setTitle('🔧 Exploration Issues Fixed')
            .setDescription([
                'Detected and automatically fixed the following issues:',
                '',
                ...fixedIssues.map(issue => `✅ ${issue}`),
                '',
                'You can now continue exploring normally!'
            ].join('\n'))
            .setColor(0x2ecc71)
            .setFooter({ text: 'Use op explore again to continue' });

        return message.reply({ embeds: [fixEmbed] });
    }

    // === NORMAL EXPLORATION CONTINUES ===

    // Check if user is in boss fight state
    if (user.exploreStates.inBossFight) {
        return await handleBossFight(message, user, client);
    }

    // Check cooldowns
    const currentLocation = getCurrentLocation(user.stage);

    if (currentLocation === 'COMPLETED') {
        return message.reply('🎉 Congratulations! You have completed the East Blue Saga! More adventures await in future updates!');
    }

    // Cooldown removed - users can explore without waiting

    // Check defeat cooldown
    if (user.exploreStates.defeatCooldown && user.exploreStates.defeatCooldown > Date.now()) {
        const defeatTimeLeft = user.exploreStates.defeatCooldown - Date.now();
        return message.reply(`💀 You were defeated! Wait ${prettyTime(defeatTimeLeft)} before trying again.`);
    }

    const localStage = getLocalStage(user.stage);
    const locationData = LOCATIONS[currentLocation];

    if (!locationData || localStage >= locationData.length) {
        // Move to next location
        const currentLocationIndex = Object.keys(LOCATIONS).indexOf(currentLocation);
        if (currentLocationIndex >= 0 && currentLocationIndex < Object.keys(LOCATIONS).length - 1) {
            const nextLocation = Object.keys(LOCATIONS)[currentLocationIndex + 1];

            // Calculate the starting stage of next location
            let nextLocationStartStage = 0;
            const locationNames = Object.keys(LOCATIONS);
            for (let i = 0; i <= currentLocationIndex; i++) {
                nextLocationStartStage += LOCATIONS[locationNames[i]].length;
            }

            // Advance to next location's first stage
            user.stage = nextLocationStartStage;
            user.lastExplore = new Date();
            // Update quest progress for exploration
            try {
                await updateQuestProgress(user, 'explore', 1);
            } catch (error) {
                console.error('Error updating quest progress:', error);
            }
            await user.save();

            const nextEmbed = new EmbedBuilder()
                .setColor(0x2C2F33)
                .setDescription([
                    `**Location Complete**`,
                    '',
                    `You've completed **${currentLocation}**`,
                    '',
                    `**${nextLocation}** is now available`,
                    '',
                    'Use `op explore` to continue your adventure'
                ].join('\n'))
                .setFooter({ text: 'Adventure Progress' });

            return message.reply({ embeds: [nextEmbed] });
        } else {
            const completeEmbed = new EmbedBuilder()
                .setColor(0x2C2F33)
                .setDescription([
                    '**East Blue Saga Complete**',
                    '',
                    'You have completed all available locations',
                    '',
                    'More content coming soon'
                ].join('\n'))
                .setFooter({ text: 'Adventure Complete' });

            return message.reply({ embeds: [completeEmbed] });
        }
    }

    const stageData = locationData[localStage];

    // Handle different stage types
    if (stageData.type === 'narrative') {
        await handleNarrative(message, user, stageData, currentLocation);
    } else if (stageData.type === 'choice') {
        await handleChoice(message, user, stageData, currentLocation, client);
    } else if (stageData.type === 'enemy' || stageData.type === 'boss' || stageData.type === 'multi_enemy') {
        await handleBattle(message, user, stageData, currentLocation, client);
    }
}

async function handleNarrative(message, user, stageData, currentLocation) {
    const localStage = getLocalStage(user.stage);
    const totalStages = getTotalStagesInLocation(currentLocation);

    // Add engaging features
    const features = await generateExploreFeatures(user, stageData);

    let description = stageData.desc;
    if (features.cardCommentary) {
        description += `\n\n💭 *${features.cardCommentary}*`;
    }
    if (features.fortune) {
        description += `\n\n🔮 **Fortune**: *${features.fortune}*`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`🗺️ ${currentLocation} - ${stageData.title}`)
        .setDescription(description)
        .setColor(0x2c2f33)
        .setFooter({ text: `Progress: ${localStage + 1}/${totalStages}` });

    // Apply original rewards
    await applyReward(user, stageData.reward, stageData.questTrigger);

    // Apply hidden event rewards
    if (features.hiddenEvent) {
        await applyReward(user, features.hiddenEvent.reward);
        embed.addFields({ name: '✨ Hidden Event', value: features.hiddenEvent.text, inline: false });
    }

    // Show mini choice if available
    if (features.miniChoice) {
        embed.addFields({ name: '🤔 Quick Decision', value: features.miniChoice.question, inline: false });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('choice_a')
                    .setLabel(features.miniChoice.optionA.label)
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('choice_b')
                    .setLabel(features.miniChoice.optionB.label)
                    .setStyle(ButtonStyle.Secondary)
            );

        const choiceMessage = await message.reply({ embeds: [embed], components: [row] });
        await handleMiniChoice(choiceMessage, user, features.miniChoice, stageData);
        return;
    }

    // Add reward info to embed
    let rewardText = '';
    if (stageData.reward) {
        rewardText += getRewardText(stageData.reward);
    }
    if (features.hiddenEvent && rewardText) {
        rewardText += '\n' + getRewardText(features.hiddenEvent.reward);
    } else if (features.hiddenEvent) {
        rewardText = getRewardText(features.hiddenEvent.reward);
    }

    if (rewardText) {
        embed.addFields({ name: '🎁 Rewards', value: rewardText, inline: false });
    }

    // Check for level ups and display them
    if (user.recentLevelUps && user.recentLevelUps.length > 0) {
        let levelUpText = '';
        user.recentLevelUps.forEach(change => {
            levelUpText += `🎉 **${change.name}** leveled up! Lv.${change.oldLevel} → Lv.${change.newLevel}\n`;
        });
        embed.addFields({ name: '⭐ Level Ups!', value: levelUpText, inline: false });
        user.recentLevelUps = []; // Clear after displaying
    }

    // Set cooldown and advance stage
    user.lastExplore = new Date();
    user.stage++;

    // Update quest progress for exploration
    try {
        await updateQuestProgress(user, 'explore', 1);
    } catch (error) {
        console.log('Quest system not available');
    }

    await user.save();

    await message.reply({ embeds: [embed] });
}

async function handleChoice(message, user, stageData, currentLocation, client) {
    const localStage = getLocalStage(user.stage);
    const totalStages = getTotalStagesInLocation(currentLocation);

    const embed = new EmbedBuilder()
        .setTitle(`🗺️ ${currentLocation} - ${stageData.title}`)
        .setDescription(stageData.desc)
        .setColor(0xe67e22)
        .setFooter({ text: `Progress: ${localStage + 1}/${totalStages}` });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('choice_yes')
                .setLabel('Yes')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('choice_no')
                .setLabel('No')
                .setStyle(ButtonStyle.Secondary)
        );

    const choiceMessage = await message.reply({ embeds: [embed], components: [row] });

    const filter = i => i.user.id === message.author.id;
    const collector = choiceMessage.createMessageComponentCollector({ filter, time: 60000 });

    // Set a shorter timeout to prevent Discord API errors
    setTimeout(() => {
        if (!collector.ended) {
            collector.stop('timeout');
        }
    }, 50000);

    collector.on('collect', async interaction => {
        try {
            // Check if interaction is still valid and not expired
            if (!interaction.isRepliable() || Date.now() - interaction.createdTimestamp > 13 * 60 * 1000) {
                console.log('Interaction expired or no longer repliable');
                collector.stop();
                return;
            }

            // Try to defer update with error handling
            try {
                await interaction.deferUpdate();
            } catch (deferError) {
                if (deferError.code === 10062) {
                    console.log('Interaction already expired, stopping collector');
                    collector.stop();
                    return;
                }
                throw deferError;
            }

            const choice = interaction.customId === 'choice_yes' ? 'yes' : 'no';
            const reward = stageData.choice[choice];

            await applyReward(user, reward);

            const resultEmbed = new EmbedBuilder()
                .setTitle(`✅ Choice Made: ${choice.toUpperCase()}`)
                .setDescription(`You chose **${choice}**!`)
                .setColor(choice === 'yes' ? 0x2ecc71 : 0x95a5a6)
                .setFooter({ text: `Progress: ${localStage + 2}/${totalStages}` });

            if (reward) {
                resultEmbed.addFields({ name: 'Reward', value: getRewardText(reward), inline: false });
            }

            // Check for level ups and display them
            if (user.recentLevelUps && user.recentLevelUps.length > 0) {
                let levelUpText = '';
                user.recentLevelUps.forEach(change => {
                    levelUpText += `🎉 **${change.name}** leveled up! Lv.${change.oldLevel} → Lv.${change.newLevel}\n`;
                });
                resultEmbed.addFields({ name: '⭐ Level Ups!', value: levelUpText, inline: false });
                user.recentLevelUps = []; // Clear after displaying
            }

            // Set cooldown and advance stage
            user.lastExplore = new Date();
            user.stage++;

            // Update quest progress for exploration
            try {
                await updateQuestProgress(user, 'explore', 1);
            } catch (error) {
                console.log('Quest system not available');
            }

            await user.save();

            // Disable collector to prevent further interactions
            collector.stop();

            await choiceMessage.edit({ embeds: [resultEmbed], components: [] });
        } catch (error) {
            console.error('Choice interaction error:', error);

            // If it's an expired interaction, don't try to update
            if (error.code === 10062) {
                console.log('Interaction expired, cleaning up');
                collector.stop();
                return;
            }

            collector.stop();
            try {
                // Only try to edit if the interaction hasn't expired
                if (Date.now() - interaction.createdTimestamp < 13 * 60 * 1000) {
                    await choiceMessage.edit({ components: [] });
                }
            } catch (editError) {
                console.error('Error removing components:', editError);
            }
        }
    });

    collector.on('end', (collected, reason) => {
        // Only try to edit if not expired
        if (reason !== 'time' && reason !== 'timeout') {
            choiceMessage.edit({ components: [] }).catch(() => {});
        }
        // Clean up any pending timeouts
        if (collector.timer) {
            clearTimeout(collector.timer);
        }
    });
}

async function handleBattle(message, user, stageData, currentLocation, client) {
    // Get user's team using the battle system
    const battleTeam = calculateBattleStats(user);

    if (!battleTeam || battleTeam.length === 0) {
        return message.reply('❌ You need to set up your team first! Use `op team add <card>` to add cards to your team.');
    }

    // Fix HP property - ensure we're using maxHp correctly
    battleTeam.forEach(card => {
        card.maxHp = card.hp; // Set maxHp to the calculated hp value
        card.currentHp = card.hp; // Set current HP to full at start of battle
    });

    // Initialize battle state
    let enemies = [];

    if (stageData.type === 'multi_enemy') {
        // Use original enemy stats from stage data, don't load from cards.json
        enemies = stageData.enemies.map(enemy => ({
            ...enemy,
            currentHp: enemy.hp,
            maxHp: enemy.hp
        }));
    } else {
        // Use original enemy stats from stage data
        enemies = [{
            ...stageData.enemy,
            currentHp: stageData.enemy.hp,
            maxHp: stageData.enemy.hp
        }];
    }

    const battleState = {
        userTeam: battleTeam,
        enemies: enemies,
        turn: 1,
        isBossFight: stageData.type === 'boss'
    };

    // Initialize exploreStates if it doesn't exist
    if (!user.exploreStates) {
        user.exploreStates = {};
    }

    // Store battle state
    user.exploreStates.battleState = battleState;
    user.exploreStates.inBossFight = true;
    user.exploreStates.currentStage = stageData;
    user.exploreStates.currentLocation = currentLocation;

    await user.save();

    return await displayBattleState(message, user, client);
}

async function handleBossFight(message, user, client) {
    return await displayBattleState(message, user, client);
}

async function displayBattleState(message, user, client) {
    const battleState = user.exploreStates.battleState;
    const stageData = user.exploreStates.currentStage;
    const currentLocation = user.exploreStates.currentLocation;

    if (!battleState || !stageData) {
        // Clean up corrupted state
        user.exploreStates.inBossFight = false;
        user.exploreStates.battleState = null;
        user.exploreStates.currentStage = null;
        await user.save();
        return message.reply('❌ Battle state corrupted. Please try exploring again.');
    }

    const localStage = getLocalStage(user.stage);
    const totalStages = getTotalStagesInLocation(currentLocation);

    const embed = new EmbedBuilder()
        .setTitle(`⚔️ ${stageData.title}`)
        .setDescription(stageData.desc)
        .setColor(battleState.isBossFight ? 0xe74c3c : 0xf39c12)
        .setFooter({ text: `Progress: ${localStage + 1}/${totalStages}` });

    // Display your team
    let teamDisplay = '';
    battleState.userTeam.forEach((card, index) => {
        if (card.currentHp > 0) {
            const hpBar = createHpBar(card.currentHp, card.maxHp);
            const lockStatus = card.locked ? ' 🔒' : '';
            teamDisplay += `**Lv.${card.level} ${card.name}${lockStatus}**\n❤️ ${card.currentHp}/${card.maxHp} ${hpBar}\n`;
        } else {
            teamDisplay += `**${card.name}** - 💀 *Defeated*\n`;
        }
    });

    embed.addFields({
        name: `🏴‍☠️ Your Crew`,
        value: teamDisplay || 'No active crew members',
        inline: false
    });

    // Enemy HP bars
    let enemyDisplay = '';
    battleState.enemies.forEach((enemy, index) => {
        if (enemy.currentHp > 0) {
            const enemyHpBar = createHpBar(enemy.currentHp, enemy.maxHp);
            enemyDisplay += `**${enemy.name}**\n💀 ${enemy.currentHp}/${enemy.maxHp} ${enemyHpBar}\n`;
        } else {
            enemyDisplay += `**${enemy.name}** - ☠️ *Defeated*\n`;
        }
    });

    embed.addFields({
        name: `👹 Enemies`,
        value: enemyDisplay || 'No enemies remaining',
        inline: false
    });

    // Create battle buttons
    const battleButtons = [
        new ButtonBuilder()
            .setCustomId('battle_attack')
            .setLabel('Attack')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('battle_items')
            .setLabel('Items')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('battle_flee')
            .setLabel('Retreat')
            .setStyle(ButtonStyle.Secondary)
    ];

    const row = new ActionRowBuilder().addComponents(battleButtons);

    const battleMessage = await message.reply({ embeds: [embed], components: [row] });

    const filter = i => i.user.id === message.author.id;
    const collector = battleMessage.createMessageComponentCollector({ filter, time: 300000 });

    collector.on('collect', async interaction => {
        try {
            // Check if interaction is still valid
            if (!interaction.isRepliable()) {
                console.log('Battle interaction no longer repliable');
                return;
            }

            await interaction.deferUpdate();

            // Re-fetch user data to ensure it's current
            const freshUser = await User.findOne({ userId: user.userId });
            if (!freshUser || !freshUser.exploreStates.inBossFight) {
                // Battle state was cleared, stop collector
                collector.stop();
                await battleMessage.edit({ 
                    content: '⚠️ Battle state was reset. Please use `op explore` to continue.',
                    embeds: [],
                    components: [] 
                });
                return;
            }

            if (interaction.customId === 'battle_attack') {
                await handleBattleAttack(interaction, freshUser, battleMessage);
            } else if (interaction.customId === 'battle_items') {
                await handleBattleItems(interaction, freshUser, battleMessage);
            } else if (interaction.customId === 'battle_flee') {
                await handleBattleFlee(interaction, freshUser, battleMessage);
            }
        } catch (error) {
            console.error('Battle interaction error:', error);
            // Attempt to clean up battle state on error
            try {
                const errorUser = await User.findOne({ userId: user.userId });
                if (errorUser) {
                    errorUser.exploreStates.inBossFight = false;
                    errorUser.exploreStates.battleState = null;
                    errorUser.exploreStates.currentStage = null;
                    errorUser.exploreStates.currentLocation = null;
                    await errorUser.save();
                }
            } catch (saveError) {
                console.error('Error cleaning up battle state:', saveError);
            }

            collector.stop();
            try {
                await battleMessage.edit({ 
                    content: '❌ An error occurred in battle. Your battle state has been reset. Use `op explore` to continue.',
                    embeds: [],
                    components: [] 
                });
            } catch (editError) {
                console.error('Error editing battle message:', editError);
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        try {
            if (reason === 'time') {
                // Battle timed out - clean up state
                const timeoutUser = await User.findOne({ userId: user.userId });
                if (timeoutUser && timeoutUser.exploreStates.inBossFight) {
                    timeoutUser.exploreStates.inBossFight = false;
                    timeoutUser.exploreStates.battleState = null;
                    timeoutUser.exploreStates.currentStage = null;
                    timeoutUser.exploreStates.currentLocation = null;
                    // Set short cooldown for timeout
                    timeoutUser.exploreStates.defeatCooldown = Date.now() + (15 * 60 * 1000); // 15 minutes
                    await timeoutUser.save();
                }
                
                await battleMessage.edit({ 
                    content: '⏰ Battle timed out! Your exploration state has been reset. Use `op explore` to continue.',
                    embeds: [],
                    components: [] 
                });
            } else {
                await battleMessage.edit({ components: [] });
            }
        } catch (error) {
            console.error('Error handling battle collector end:', error);
        }
    });
}

async function handleBattleAttack(interaction, user, battleMessage) {
    try {
        const battleState = user.exploreStates.battleState;

        // Check if battle state exists
        if (!battleState || !battleState.userTeam) {
            return await interaction.followUp({ content: 'Battle state corrupted. Please restart the battle.', ephemeral: true });
        }

    // Get first alive card from team
    const activeCard = battleState.userTeam.find(card => card.currentHp > 0);
    if (!activeCard) {
        return await handleBattleDefeat(interaction, user, battleMessage, 'All your crew members are defeated!');
    }

    // User attacks first enemy alive
    const targetEnemy = battleState.enemies.find(e => e.currentHp > 0);
    if (!targetEnemy) return;

    let attackDamage = calculateDamage(activeCard, targetEnemy, 'normal');

    targetEnemy.currentHp = Math.max(0, targetEnemy.currentHp - attackDamage);

    let battleLog = `⚔️ ${activeCard.name} attacks ${targetEnemy.name} for ${attackDamage} damage!`;

    if (targetEnemy.currentHp <= 0) {
        battleLog += `\n💀 ${targetEnemy.name} is defeated!`;    }

    // Check if all enemies defeated
    if (battleState.enemies.every(e => e.currentHp <= 0)) {
        return await handleBattleVictory(interaction, user, battleMessage, battleLog);
    }

    // Enemy attacks back
    const aliveEnemies = battleState.enemies.filter(e => e.currentHp > 0);
    for (const enemy of aliveEnemies) {
        const targetCard = battleState.userTeam.find(card => card.currentHp > 0);
        if (!targetCard) break;

        const enemyDamage = calculateDamage(enemy, targetCard, 'normal');

        targetCard.currentHp = Math.max(0, targetCard.currentHp - enemyDamage);
        battleLog += `\n💥 ${enemy.name} attacks ${targetCard.name} for ${enemyDamage} damage!`;

        if (targetCard.currentHp <= 0) {
            battleLog += `\n💀 ${targetCard.name} is defeated!`;
        }
    }

    // Check if all team defeated
    if (battleState.userTeam.every(card => card.currentHp <= 0)) {
        return await handleBattleDefeat(interaction, user, battleMessage, battleLog);
    }

    battleState.turn++;
    user.exploreStates.battleState = battleState;
    await user.save();

    // Update battle display
    await updateBattleDisplay(interaction, user, battleMessage, battleLog);
    } catch (error) {
        console.error('Error in handleBattleAttack:', error);
        try {
            await interaction.followUp({ content: 'An error occurred during battle. Please try again.', ephemeral: true });
        } catch (followUpError) {
            console.error('Error sending error message:', followUpError);
        }
    }
}

async function updateBattleDisplay(interaction, user, battleMessage, battleLog) {
    const battleState = user.exploreStates.battleState;
    const stageData = user.exploreStates.currentStage;
    const currentLocation = user.exploreStates.currentLocation;

    if (!battleState || !stageData || !currentLocation) {
        console.error('Battle state corrupted during update');
        return;
    }
    const localStage = getLocalStage(user.stage);
    const totalStages = getTotalStagesInLocation(currentLocation);

    const embed = new EmbedBuilder()
        .setTitle(`⚔️ Turn ${battleState.turn}`)
        .setDescription(battleLog)
        .setColor(0xf39c12)
        .setFooter({ text: `Progress: ${localStage + 1}/${totalStages}` });

    // Display your team
    let teamDisplay = '';
    battleState.userTeam.forEach((card, index) => {
        if (card.currentHp > 0) {
            const hpBar = createHpBar(card.currentHp, card.maxHp);
            const lockStatus = card.locked ? ' 🔒' : '';
            teamDisplay += `**Lv.${card.level} ${card.name}${lockStatus}**\n❤️ ${card.currentHp}/${card.maxHp} ${hpBar}\n`;
        } else {
            teamDisplay += `**${card.name}** - 💀 *Defeated*\n`;
        }
    });

    embed.addFields({
        name: `🏴‍☠️ Your Crew`,
        value: teamDisplay || 'No active crew members',
        inline: false
    });

    // Enemy HP bars
    let enemyDisplay = '';
    battleState.enemies.forEach((enemy, index) => {
        if (enemy.currentHp > 0) {
            const enemyHpBar = createHpBar(enemy.currentHp, enemy.maxHp);
            enemyDisplay += `**${enemy.name}**\n💀 ${enemy.currentHp}/${enemy.maxHp} ${enemyHpBar}\n`;
        } else {
            enemyDisplay += `**${enemy.name}** - ☠️ *Defeated*\n`;
        }
    });

    embed.addFields({
        name: `👹 Enemies`,
        value: enemyDisplay || 'No enemies remaining',
        inline: false
    });

    const battleButtons = [
        new ButtonBuilder()
            .setCustomId('battle_attack')
            .setLabel('Attack')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('battle_items')
            .setLabel('Items')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('battle_flee')
            .setLabel('Retreat')
            .setStyle(ButtonStyle.Secondary)
    ];

    const row = new ActionRowBuilder().addComponents(battleButtons);
    await battleMessage.edit({ embeds: [embed], components: [row] });
}

async function handleBattleItems(interaction, user, battleMessage) {
    const usableItems = ['healthpotion', 'strengthpotion', 'speedboostfood', 'defensepotion'];
    const availableItems = usableItems.filter(item => canUseInventoryItem(user, item));

    if (availableItems.length === 0) {
        return await interaction.followUp({ content: 'You have no usable items!', ephemeral: true });
    }

    const itemButtons = availableItems.map(item => 
        new ButtonBuilder()
            .setCustomId(`use_${item}`)
            .setLabel(item.charAt(0).toUpperCase() + item.slice(1).replace(/([A-Z])/g, ' $1'))
            .setStyle(ButtonStyle.Primary)
    );

    const itemRow = new ActionRowBuilder().addComponents(itemButtons.slice(0, 5));

    const itemMessage = await interaction.followUp({ 
        content: 'Choose an item to use:', 
        components: [itemRow], 
        ephemeral: true 
    });

    // Handle item selection
    const itemFilter = i => i.user.id === interaction.user.id && i.customId.startsWith('use_');
    const itemCollector = itemMessage.createMessageComponentCollector({ filter: itemFilter, time: 30000 });

    itemCollector.on('collect', async itemInteraction => {
        await itemInteraction.deferUpdate();

        const itemName = itemInteraction.customId.replace('use_', '');
        const effect = useInventoryItem(user, itemName);

        if (!effect) {
            return await itemInteraction.followUp({ content: 'Item could not be used!', ephemeral: true });
        }

        const battleState = user.exploreStates.battleState;
        let effectText = '';

        // Apply item effects to first alive card
        const activeCard = battleState.userTeam.find(card => card.currentHp > 0);
        if (activeCard && effect.type === 'heal') {
            const healAmount = Math.min(effect.amount, activeCard.maxHp - activeCard.currentHp);
            activeCard.currentHp += healAmount;
            effectText = `${activeCard.name} healed ${healAmount} HP!`;
        } else {
            effectText = `Used ${itemName}!`;
        }

        await user.save();

        // Update battle display with item effect
        const embed = new EmbedBuilder()
            .setTitle(`Item Used: ${itemName.charAt(0).toUpperCase() + itemName.slice(1)}`)
            .setDescription(effectText)
            .setColor(0x2ecc71);

        await itemInteraction.editReply({ embeds: [embed], components: [] });

        // Continue battle
        battleState.turn++;
        await handleEnemyTurn(interaction, user, battleMessage);
    });
}

async function handleEnemyTurn(interaction, user, battleMessage) {
    const battleState = user.exploreStates.battleState;

    if (!battleState || !battleState.userTeam || !battleState.enemies) {
        console.error('Battle state corrupted during enemy turn');
        return;
    }

    let battleLog = '';

    // Each alive enemy attacks
    for (const enemy of battleState.enemies) {
        if (enemy.currentHp <= 0) continue;

        const targetCard = battleState.userTeam.find(card => card.currentHp > 0);
        if (!targetCard) break;

        const damage = calculateDamage(enemy, targetCard, 'normal');

        targetCard.currentHp = Math.max(0, targetCard.currentHp - damage);
        battleLog += `${enemy.name} attacks ${targetCard.name} for ${damage} damage!\n`;

        if (targetCard.currentHp <= 0) {
            battleLog += `${targetCard.name} is defeated!\n`;
        }
    }

    // Check if all team defeated
    if (battleState.userTeam.every(card => card.currentHp <= 0)) {
        return await handleBattleDefeat(interaction, user, battleMessage, battleLog);
    }

    await user.save();
    await updateBattleDisplay(interaction, user, battleMessage, battleLog);
}

function canUseInventoryItem(user, itemName) {
    if (!user.inventory) return false;
    const normalizedItem = normalizeItemName(itemName);
    return user.inventory.some(item => normalizeItemName(item) === normalizedItem);
}

function useInventoryItem(user, itemName) {
    if (!canUseInventoryItem(user, itemName)) return null;

    const normalizedItem = normalizeItemName(itemName);
    const itemIndex = user.inventory.findIndex(item => normalizeItemName(item) === normalizedItem);

    if (itemIndex === -1) return null;

    // Remove item from inventory
    user.inventory.splice(itemIndex, 1);

    // Return item effects
    const itemEffects = {
        'healthpotion': { type: 'heal', amount: 50 },
        'strengthpotion': { type: 'attack_boost', amount: 20, duration: 3 },
        'speedboostfood': { type: 'speed_boost', amount: 15, duration: 3 },
        'defensepotion': { type: 'defense_boost', amount: 15, duration: 3 }
    };

    return itemEffects[normalizedItem] || null;
}

async function handleBattleFlee(interaction, user, battleMessage) {
    try {
        // Clean up battle state properly
        user.exploreStates.inBossFight = false;
        user.exploreStates.battleState = null;
        user.exploreStates.currentStage = null;

        // Set flee cooldown
        user.exploreStates.defeatCooldown = Date.now() + (30 * 60 * 1000); // 30 minute cooldown for fleeing

        await user.save();

        const fleeEmbed = new EmbedBuilder()
            .setTitle('🏃‍♂️ Fled from Battle!')
            .setDescription('You successfully escaped from the battle, but you\'ll need to wait before trying again.')
            .setColor(0x95a5a6);

        await battleMessage.edit({ embeds: [fleeEmbed], components: [] });
    } catch (error) {
        console.error('Error handling battle flee:', error);
        await interaction.followUp({ content: 'An error occurred while fleeing. Please try the command again.', ephemeral: true });
    }
}

async function handleBattleVictory(interaction, user, battleMessage, battleLog) {
    const stageData = user.exploreStates.currentStage;
    const currentLocation = user.exploreStates.currentLocation;

    // Clean up battle state
    user.exploreStates.inBossFight = false;
    user.exploreStates.battleState = null;
    user.exploreStates.currentStage = null;

    // Apply rewards
    await applyReward(user, stageData.reward);

    // Set cooldown and advance stage
    user.lastExplore = new Date();
    user.stage++;

    // Reset team HP for next battle
    if (user.team) {
        const battleTeam = calculateBattleStats(user);
        resetTeamHP(battleTeam);
    }

    // Update quest progress
    try {
        await updateQuestProgress(user, 'explore', 1);
        if (stageData.type === 'boss') {
            await updateQuestProgress(user, 'battle_win', 1);
        }
    } catch (error) {
        console.log('Quest system not available');
    }

    await user.save();

    const localStage = getLocalStage(user.stage - 1); // -1 because we already advanced
    const totalStages = getTotalStagesInLocation(currentLocation);

    const victoryEmbed = new EmbedBuilder()
        .setTitle('🎉 Victory!')
        .setDescription(battleLog + '\n\n✅ **You won the battle!**\n*Your team has recovered!*')
        .setColor(0x2ecc71)
        .setFooter({ text: `Progress: ${localStage + 1}/${totalStages}` });

    if (stageData.reward) {
        victoryEmbed.addFields({ name: 'Rewards', value: getRewardText(stageData.reward), inline: false });
    }

    // Check for level ups and display them
    if (user.recentLevelUps && user.recentLevelUps.length > 0) {
        let levelUpText = '';
        user.recentLevelUps.forEach(change => {
            levelUpText += `🎉 **${change.name}** leveled up! Lv.${change.oldLevel} → Lv.${change.newLevel}\n`;
        });
        victoryEmbed.addFields({ name: '⭐ Level Ups!', value: levelUpText, inline: false });
        user.recentLevelUps = []; // Clear after displaying
    }

    await battleMessage.edit({ embeds: [victoryEmbed], components: [] });
}

async function handleBattleDefeat(interaction, user, battleMessage, battleLog) {
    const stageData = user.exploreStates.currentStage;
    const currentLocation = user.exploreStates.currentLocation;

    // Clean up battle state
    user.exploreStates.inBossFight = false;
    user.exploreStates.battleState = null;
    user.exploreStates.currentStage = null;

    // Set defeat cooldown
    user.exploreStates.defeatCooldown = Date.now() + (stageData.loseCooldown || DEFEAT_COOLDOWN);

    await user.save();

    const localStage = getLocalStage(user.stage);
    const totalStages = getTotalStagesInLocation(currentLocation);

    const defeatEmbed = new EmbedBuilder()
        .setTitle('💀 Defeat!')
        .setDescription(battleLog + '\n\n❌ **You were defeated!**')
        .setColor(0xe74c3c)
        .setFooter({ text: `Progress: ${localStage + 1}/${totalStages}` });

    await battleMessage.edit({ embeds: [defeatEmbed], components: [] });
}

async function applyReward(user, reward, questTrigger = null) {
    if (!reward || !user) return;
    
    // Validate user object has required properties
    if (!user.userId) {
        console.error('Invalid user object in applyReward');
        return;
    }

    if (reward.type === 'xp') {
        await addXP(user, reward.amount);
    } else if (reward.type === 'beli') {
        user.beli = (user.beli || 0) + reward.amount;
    } else if (reward.type === 'item') {
        addToInventory(user, reward.name);
        if (reward.count && reward.count > 1) {
            for (let i = 1; i < reward.count; i++) {
                addToInventory(user, reward.name);
            }
        }
    } else if (reward.type === 'card') {
        if (!user.cards) user.cards = [];
        user.cards.push({
            name: reward.name,
            rank: reward.rank,
            level: 1,
            timesUpgraded: 0
        });
    } else if (reward.type === 'multiple') {
        for (const subReward of reward.rewards) {
            await applyReward(user, subReward);
        }
    } else if (reward.type === 'saga_unlock') {
        if (!user.unlockedSagas) user.unlockedSagas = ['East Blue'];
        if (!user.unlockedSagas.includes(reward.saga)) {
            user.unlockedSagas.push(reward.saga);
        }

        // Trigger saga completion quest
        try {
            await updateQuestProgress(user, 'saga_complete', 1);
        } catch (error) {
            console.log('Quest system not available');
        }
    }
}

function getRewardText(reward) {
    if (!reward) return 'None';

    if (reward.type === 'xp') {
        return `+${reward.amount} XP`;
    } else if (reward.type === 'beli') {
        return `+${reward.amount} Beli`;
    } else if (reward.type === 'item') {
        const count = reward.count || 1;
        return `${reward.name}${count > 1 ? ` x${count}` : ''}`;
    } else if (reward.type === 'card') {
        return `[${reward.rank}] ${reward.name}`;
    } else if (reward.type === 'multiple') {
        return reward.rewards.map(r => getRewardText(r)).join(', ');
    } else if (reward.type === 'saga_unlock') {
        return `${reward.saga} Saga Unlocked!`;
    }

    return 'Unknown reward';
}

// Feature generation for engaging exploration
async function generateExploreFeatures(user, stageData) {
    const features = {};

    // 30% chance for card commentary
    if (Math.random() < 0.3 && user.team && user.team.length > 0) {
        features.cardCommentary = generateCardCommentary(user.team[0], stageData);
    }

    // 25% chance for fortune message
    if (Math.random() < 0.25) {
        features.fortune = generateFortune();
    }

    // 40% chance for hidden event
    if (Math.random() < 0.4) {
        features.hiddenEvent = generateHiddenEvent();
    }

    // 20% chance for mini choice (only if no other special events)
    if (Math.random() < 0.2 && !features.hiddenEvent) {
        features.miniChoice = generateMiniChoice();
    }

    return features;
}

function generateCardCommentary(cardName, stageData) {
    const commentaries = {
        'Monkey D. Luffy': [
            "Luffy grins: 'This looks fun!'",
            "Luffy sniffs the air: 'I smell adventure!'",
            "Luffy stretches: 'Let's see what's ahead!'",
        ],
        'Roronoa Zoro': [
            "Zoro mutters: 'Tch... smells like trouble.'",
            "Zoro yawns: 'Wake me when there's a fight.'",
            "Zoro looks around: 'Which way is north again?'",
        ],
        'Nami': [
            "Nami checks her map: 'We're making good progress.'",
            "Nami counts coins: 'Hope this is profitable.'",
            "Nami frowns: 'Something feels off about this place.'",
        ],
        'Usopp': [
            "Usopp nervously looks around: 'I-Is it safe here?'",
            "Usopp boasts: 'I've been to places twice as dangerous!'",
            "Usopp checks his slingshot: 'Better be prepared.'",
        ],
        'Sanji': [
            "Sanji lights a cigarette: 'What a lovely day for adventure.'",
            "Sanji adjusts his tie: 'Let's handle this with style.'",
            "Sanji sniffs: 'I could cook something amazing with local ingredients.'",
        ],
    };

    const cardComments = commentaries[cardName] || [
        "Your crew member stays alert.",
        "They seem ready for whatever comes next.",
        "You sense their determination.",
    ];

    return cardComments[Math.floor(Math.random() * cardComments.length)];
}

function generateFortune() {
    const fortunes = [
        "The winds whisper of treasure nearby...",
        "A seagull's cry warns of danger ahead.",
        "The sea speaks of great adventures to come.",
        "Your destiny shines brighter with each step.",
        "The stars align in your favor today.",
        "Ancient spirits watch your journey with interest.",
        "Your next battle will test more than strength.",
        "Friendship will prove more valuable than gold.",
        "The path ahead holds unexpected allies.",
        "Your courage will be rewarded soon.",
    ];

    return fortunes[Math.floor(Math.random() * fortunes.length)];
}

function generateHiddenEvent() {
    const events = [
        {
            text: "You spot a glint in the sand and find some buried Beli!",
            reward: { type: "beli", amount: Math.floor(Math.random() * 50) + 25 },
        },
        {
            text: "A friendly seagull drops a small trinket at your feet.",
            reward: { type: "xp", amount: Math.floor(Math.random() * 30) + 15 },
        },
        {
            text: "You help a lost merchant and receive a small token of gratitude.",
            reward: { type: "beli", amount: Math.floor(Math.random() * 40) + 20 },
        },
        {
            text: "Your experience here teaches you something valuable.",
            reward: { type: "xp", amount: Math.floor(Math.random() * 25) + 20 },
        },
        {
            text: "You find an old bottle with a few coins inside!",
            reward: { type: "beli", amount: Math.floor(Math.random() * 35) + 15 },
        },
    ];

    return events[Math.floor(Math.random() * events.length)];
}

function generateMiniChoice() {
    const choices = [
        {
            question: "You spot a suspicious barrel floating nearby. What do you do?",
            optionA: { label: "Investigate", reward: { type: "beli", amount: 40 }, risk: 0.3 },
            optionB: { label: "Ignore it", reward: { type: "xp", amount: 20 }, risk: 0 },
        },
        {
            question: "A wounded pirate asks for help. How do you respond?",
            optionA: { label: "Help them", reward: { type: "xp", amount: 35 }, risk: 0 },
            optionB: { label: "Be cautious", reward: { type: "beli", amount: 25 }, risk: 0.2 },
        },
        {
            question: "You find a locked chest half-buried in the sand.",
            optionA: { label: "Try to open it", reward: { type: "beli", amount: 60 }, risk: 0.4 },
            optionB: { label: "Leave it alone", reward: { type: "xp", amount: 30 }, risk: 0 },
        },
        {
            question: "A stranger offers to sell you 'valuable information'.",
            optionA: { label: "Buy it (30 Beli)", cost: 30, reward: { type: "xp", amount: 45 }, risk: 0.3 },
            optionB: { label: "Decline politely", reward: { type: "xp", amount: 15 }, risk: 0 },
        },
    ];

    return choices[Math.floor(Math.random() * choices.length)];
}

async function handleMiniChoice(choiceMessage, user, miniChoice, stageData) {
    const filter = i => i.user.id === user.userId;
    const collector = choiceMessage.createMessageComponentCollector({ filter, time: 45000 });

    collector.on('collect', async interaction => {
        try {
            await interaction.deferUpdate();

            const choice = interaction.customId === 'choice_a' ? 'optionA' : 'optionB';
            const selectedOption = miniChoice[choice];

            let resultText = `You chose: **${selectedOption.label}**\n\n`;

            // Handle cost
            if (selectedOption.cost && user.beli >= selectedOption.cost) {
                user.beli -= selectedOption.cost;
                resultText += `*Paid ${selectedOption.cost} Beli*\n`;
            } else if (selectedOption.cost && user.beli < selectedOption.cost) {
                resultText += "You don't have enough Beli!\n";
                collector.stop();
                await choiceMessage.edit({ components: [] });
                return;
            }

            // Check for risk
            const failed = Math.random() < selectedOption.risk;
            if (failed) {
                resultText += "❌ Things didn't go as planned...";
                const penalty = Math.floor(Math.random() * 20) + 10;
                user.beli = Math.max(0, (user.beli || 0) - penalty);
                resultText += ` You lost ${penalty} Beli.`;
            } else {
                await applyReward(user, selectedOption.reward);
                resultText += `✅ ${getRewardText(selectedOption.reward)}`;
            }

            // Apply original stage rewards
            await applyReward(user, stageData.reward);

            // Advance stage
            user.lastExplore = new Date();
            user.stage++;

            // Update quest progress
            try {
                await updateQuestProgress(user, 'explore', 1);
            } catch (error) {
                console.log('Quest system not available');
            }

            await user.save();

            const resultEmbed = new EmbedBuilder()
                .setTitle('⚡ Choice Result')
                .setDescription(resultText)
                .setColor(failed ? 0xe74c3c : 0x2ecc71);

            if (stageData.reward) {
                resultEmbed.addFields({ name: '🎁 Stage Reward', value: getRewardText(stageData.reward), inline: false });
            }

            // Check for level ups and display them
            if (user.recentLevelUps && user.recentLevelUps.length > 0) {
                let levelUpText = '';
                user.recentLevelUps.forEach(change => {
                    levelUpText += `🎉 **${change.name}** leveled up! Lv.${change.oldLevel} → Lv.${change.newLevel}\n`;
                });
                resultEmbed.addFields({ name: '⭐ Level Ups!', value: levelUpText, inline: false });
                user.recentLevelUps = []; // Clear after displaying
            }

            collector.stop();
            await choiceMessage.edit({ embeds: [resultEmbed], components: [] });

        } catch (error) {
            console.error('Mini choice error:', error);
            collector.stop();
            await choiceMessage.edit({ components: [] });
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            // Auto-advance if no choice made
            handleAutoAdvance(choiceMessage, user, stageData);
        }
    });
}

async function handleAutoAdvance(choiceMessage, user, stageData) {
    try {
        await applyReward(user, stageData.reward);
        user.lastExplore = new Date();
        user.stage++;

        try {
            await updateQuestProgress(user, 'explore', 1);
        } catch (error) {
            console.log('Quest system not available');
        }

        await user.save();

        const timeoutEmbed = new EmbedBuilder()
            .setTitle('⏰ Time\'sUp!')
            .setDescription('You took too long to decide and continued on your journey.')
            .setColor(0x95a5a6);

        if (stageData.reward) {
            timeoutEmbed.addFields({ name: '🎁 Reward', value: getRewardText(stageData.reward), inline: false });
        }

        // Check for level ups and display them
        if (user.recentLevelUps && user.recentLevelUps.length > 0) {
            let levelUpText = '';
            user.recentLevelUps.forEach(change => {
                levelUpText += `🎉 **${change.name}** leveled up! Lv.${change.oldLevel} → Lv.${change.newLevel}\n`;
            });
            timeoutEmbed.addFields({ name: '⭐ Level Ups!', value: levelUpText, inline: false });
            user.recentLevelUps = []; // Clear after displaying
        }

        await choiceMessage.edit({ embeds: [timeoutEmbed], components: [] });
    } catch (error) {
        console.error('Auto advance error:', error);
    }
}

module.exports = { data, execute };