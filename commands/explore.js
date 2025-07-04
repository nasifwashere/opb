const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { addCardWithTransformation } = require('../utils/cardTransformationSystem.js');
const { calculateBattleStats, calculateDamage, resetTeamHP } = require('../utils/battleSystem.js');
const { distributeXPToTeam, XP_PER_LEVEL } = require('../utils/levelSystem.js');
const { saveUserWithRetry } = require('../utils/saveWithRetry.js');
const path = require('path');
const fs = require('fs');
const { createProfessionalTeamDisplay, createEnemyDisplay, createBattleLogDisplay, createBattleStatusDisplay } = require('../utils/uiHelpers.js');

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
            enemy: { name: "Higuma", hp: 75, atk: [10, 12], spd: 50, rank: "C" },
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
            reward: { type: "item", name: "Basic Potion" }
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
            reward: { type: "item", name: "Rusty Cutlass" }
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
            title: "Reached Orange Town",
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
            reward: { type: "item", name: "Normal Potion" }
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
            reward: { type: "item", name: "Basic Potion", count: 2 }
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
            enemy: { name: "Don Krieg", hp: 150, atk: [18, 25], spd: 80, rank: "A", ability: "damage_reflection" },
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
            reward: { type: "item", name: "Marine Saber" }
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
            reward: { type: "saga_unlock", saga: "Alabasta" }
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
const IMMUNE_USER_ID = "1257718161298690119";

function normalizeItemName(item) {
    return item.replace(/\s+/g, '').toLowerCase();
}

function addToInventory(user, item) {
    if (!user.inventory) user.inventory = [];
    const normItem = normalizeItemName(item);
    user.inventory.push(normItem);
}

async function addXP(user, amount) {
    const xpBoost = user.activeBoosts?.find(boost => 
        boost.type === 'double_xp' && boost.expiresAt > Date.now()
    );
    const finalAmount = xpBoost ? amount * 2 : amount;

    // Award XP to user with new leveling system
    const { awardUserXP } = require('../utils/userLevelSystem.js');
    const userLevelResult = awardUserXP(user, finalAmount);

    // Store user level up information for display
    if (userLevelResult.leveledUp) {
        if (!user.recentUserLevelUps) user.recentUserLevelUps = [];
        user.recentUserLevelUps.push(userLevelResult);
    }

    // Distribute XP to team members and handle card level ups
    if (user.team && user.team.length > 0) {
        const cardLevelUpChanges = distributeXPToTeam(user, finalAmount);

        // Store card level up information for display
        if (cardLevelUpChanges && cardLevelUpChanges.length > 0) {
            if (!user.recentLevelUps) user.recentLevelUps = [];
            user.recentLevelUps.push(...cardLevelUpChanges);
        }

        // Mark the user document as modified to ensure cards array is saved
        user.markModified('cards');

        // Save the user document to persist XP changes
        try {
            await user.save();
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

function createEnhancedHealthBar(current, max) {
    const percentage = Math.max(0, current / max);
    const barLength = 20;
    const filledBars = Math.round(percentage * barLength);
    const emptyBars = barLength - filledBars;
    
    // Use different colors based on health percentage
    let healthEmoji;
    let barColor;
    if (percentage > 0.6) {
        healthEmoji = '🟢';
        barColor = '🟩';
    } else if (percentage > 0.3) {
        healthEmoji = '🟡';
        barColor = '🟨';
    } else {
        healthEmoji = '🔴';
        barColor = '🟥';
    }
    
    const healthBar = barColor.repeat(filledBars) + '⬛'.repeat(emptyBars);
    return `${healthEmoji} ${healthBar} ${current}/${max}`;
}

function createTeamDisplay(team, teamName, showStats = true) {
    if (!team || team.length === 0) {
        return `**═══${teamName}═══**\n*No active cards*`;
    }
    
    let display = `**═══${teamName}═══**\n`;
    
    team.forEach((card, index) => {
        if (card.currentHp > 0) {
            const healthBar = createEnhancedHealthBar(card.currentHp, card.maxHp || card.hp);
            const level = card.level || 1;
            const rank = card.rank || 'C';
            
            display += `\n🔸 **${card.name}** | Lv. ${level} **${rank}**\n`;
            display += `${healthBar}\n`;
            
            if (showStats) {
                const power = card.power || card.atk || 100;
                const speed = card.speed || card.spd || 50;
                display += `⚔️ ${power} PWR • ❤️ ${card.maxHp || card.hp} HP • ⚡ ${speed} SPD\n`;
            }
        }
    });
    
    return display;
}

function getCurrentLocation(stage) {
    if (stage < 7) return 'WINDMILL VILLAGE';
    if (stage < 16) return 'SHELLS TOWN';
    if (stage < 24) return 'ORANGE TOWN';
    if (stage < 29) return 'SYRUP VILLAGE';
    if (stage < 34) return 'BARATIE';
    if (stage < 43) return 'ARLONG PARK';
    return 'COMPLETED';
}

function getLocalStage(globalStage) {
    if (globalStage < 7) return globalStage;
    if (globalStage < 16) return globalStage - 7;
    if (globalStage < 24) return globalStage - 16;
    if (globalStage < 29) return globalStage - 24;
    if (globalStage < 34) return globalStage - 29;
    if (globalStage < 43) return globalStage - 34;
    return 0;
}

function getNextLocation(currentLocation) {
    const locationOrder = [
        'WINDMILL VILLAGE',
        'SHELLS TOWN',
        'ORANGE TOWN',
        'SYRUP VILLAGE',
        'BARATIE',
        'ARLONG PARK'
    ];
    
    const currentIndex = locationOrder.indexOf(currentLocation);
    if (currentIndex === -1 || currentIndex >= locationOrder.length - 1) {
        return 'COMPLETED';
    }
    
    return locationOrder[currentIndex + 1];
}

// Calculate equipped item bonuses
function calculateEquippedBonuses(user) {
    // This function is deprecated - equipment bonuses are now handled 
    // by the new equipment system in battle calculations
    return { hp: 0, atk: 0, spd: 0, def: 0 };
}

// Legacy function removed - now using team-based battle system

// Check if user can use inventory items in battle
function canUseInventoryItem(user, itemName) {
    if (!user.inventory) return false;
    const normalizedItem = normalizeItemName(itemName);
    return user.inventory.some(item => normalizeItemName(item) === normalizedItem);
}

// Use inventory item in battle
function useInventoryItem(user, itemName) {
    if (!canUseInventoryItem(user, itemName)) return null;
    
    const normalizedItem = normalizeItemName(itemName);
    const itemIndex = user.inventory.findIndex(item => normalizeItemName(item) === normalizedItem);
    
    if (itemIndex === -1) return null;
    
    // Remove item from inventory
    user.inventory.splice(itemIndex, 1);
    
    // Return item effects
    const itemEffects = {
        'basicpotion': { type: 'heal', percent: 10 },
        'normalpotion': { type: 'heal', percent: 20 },
        'maxpotion': { type: 'heal', percent: 30 }
    };
    
    return itemEffects[normalizedItem] || null;
}

const data = {
    name: "explore",
    description: "Begin or continue your adventure in the One Piece world!"
};



async function execute(message, args, client) {
    const userId = message.author.id;
    let user = await User.findOne({ userId });

    if (!user) {
        return message.reply('Start your journey with `op start`!');
    }

    // Initialize user progress if needed
    if (user.stage === undefined) user.stage = 0;
    if (!user.exploreStates) user.exploreStates = {};

    // Check if user is in boss fight state
    if (user.exploreStates.inBossFight) {
        return await handleBossFight(message, user, client);
    }

    // Check cooldowns
    const currentLocation = getCurrentLocation(user.stage);
    
    if (currentLocation === 'COMPLETED') {
        return message.reply('🎉 Congratulations! You have completed the East Blue Saga! More adventures await in future updates!');
    }

    // Check explore cooldown using config
    const config = require('../config.json');
    const cooldownTime = config.exploreCooldown || 120000; // 2 minutes default
    const lastExplore = user.lastExplore ? new Date(user.lastExplore).getTime() : 0;
    const timeLeft = (lastExplore + cooldownTime) - Date.now();

    if (timeLeft > 0 && userId !== IMMUNE_USER_ID) {
        return message.reply(`⏰ You need to wait ${prettyTime(timeLeft)} before exploring again!`);
    }

    // Check defeat cooldown
    if (user.exploreStates.defeatCooldown && user.exploreStates.defeatCooldown > Date.now()) {
        const defeatTimeLeft = user.exploreStates.defeatCooldown - Date.now();
        return message.reply(`💀 You were defeated! Wait ${prettyTime(defeatTimeLeft)} before trying again.`);
    }

    const localStage = getLocalStage(user.stage);
    const locationData = LOCATIONS[currentLocation];
    
    // Check if we need to move to next location
    if (!locationData || localStage >= locationData.length) {
        // Instead of showing "no more stages", automatically move to next location
        const nextLocation = getNextLocation(currentLocation);
        
        if (nextLocation === 'COMPLETED') {
            // Mark saga as completed for infinite sail eligibility
            if (!user.completedSagas) user.completedSagas = [];
            if (!user.completedSagas.includes('East Blue')) {
                user.completedSagas.push('East Blue');
                await saveUserWithRetry(user);
            }
            return message.reply('🎉 Congratulations! You have completed all available locations in the East Blue saga!');
        }
        
        // IMPORTANT: Actually advance the stage and save progress
        user.stage++; // Increment stage to move to first stage of next location
        user.lastExplore = new Date(); // Set cooldown
        
        // Update quest progress for exploration
        try {
            const { updateQuestProgress } = require('../utils/questSystem.js');
            await updateQuestProgress(user, 'explore', 1);
        } catch (error) {
            // Quest system is optional
        }
        
        await saveUserWithRetry(user); // Save the user's progress
        
        // Automatically transition to next location
        const embed = new EmbedBuilder()
            .setTitle(`🗺️ Moving to ${nextLocation}`)
            .setDescription(`You have completed **${currentLocation}**!\n\nYour adventure continues in **${nextLocation}**...\n\n✅ **Progress saved!** Use \`op explore\` again to continue.`)
            .setColor(0x2ecc71)
            .setFooter({ text: 'Your stage has been advanced to the next location!' });
        
        await saveUserWithRetry(user);
        
        await message.reply({ embeds: [embed] });
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
    const embed = new EmbedBuilder()
        .setTitle(`🗺️ ${currentLocation} - ${stageData.title}`)
        .setDescription(stageData.desc)
        .setColor(0x3498db);

    // Apply rewards
    await applyReward(user, stageData.reward);
    
    // Add reward info to embed
    if (stageData.reward) {
        embed.addFields({ name: 'Reward', value: getRewardText(stageData.reward), inline: false });
    }

    // Set cooldown and advance stage
    user.lastExplore = new Date();
    user.stage++;
    
    // Update quest progress for exploration
    try {
        const { updateQuestProgress } = require('../utils/questSystem.js');
        await updateQuestProgress(user, 'explore', 1);
    } catch (error) {
        // Remove excessive logging - quest system is optional
        // console.log('Quest system not available');
    }
    
    await saveUserWithRetry(user);
    
    await message.reply({ embeds: [embed] });
}

async function handleChoice(message, user, stageData, currentLocation, client) {
    const embed = new EmbedBuilder()
        .setTitle(`🗺️ ${currentLocation} - ${stageData.title}`)
        .setDescription(stageData.desc)
        .setColor(0xe67e22);

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

    collector.on('collect', async interaction => {
        try {
            await interaction.deferUpdate();
            
            const choice = interaction.customId === 'choice_yes' ? 'yes' : 'no';
            const reward = stageData.choice[choice];
            
            await applyReward(user, reward);
            
            const resultEmbed = new EmbedBuilder()
                .setTitle(`✅ Choice Made: ${choice.toUpperCase()}`)
                .setDescription(`You chose **${choice}**!`)
                .setColor(choice === 'yes' ? 0x2ecc71 : 0x95a5a6);
            
            if (reward) {
                resultEmbed.addFields({ name: 'Reward', value: getRewardText(reward), inline: false });
            }
            
            // Set cooldown and advance stage
            user.lastExplore = new Date();
            user.stage++;
            
            // Update quest progress for exploration
            try {
                const { updateQuestProgress } = require('../utils/questSystem.js');
                await updateQuestProgress(user, 'explore', 1);
            } catch (error) {
                // Remove excessive logging - quest system is optional
                // console.log('Quest system not available');
            }
            
            await saveUserWithRetry(user);
            
            await choiceMessage.edit({ embeds: [resultEmbed], components: [] });
        } catch (error) {
            console.error('Choice interaction error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'An error occurred while processing your choice.', ephemeral: true });
            }
        }
    });

    collector.on('end', collected => {
        if (collected.size === 0) {
            choiceMessage.edit({ components: [] }).catch(() => {});
        }
    });
}

async function handleBattle(message, user, stageData, currentLocation, client) {
    // Validate user has a team set up
    if (!user.team || user.team.length === 0) {
        return message.reply('❌ You need to set up your team first! Use `op team add <card>` to add cards to your team.');
    }

    // Validate user has cards
    if (!user.cards || user.cards.length === 0) {
        return message.reply('❌ You don\'t have any cards! Pull some cards first with `op pull`.');
    }

    // Get user's team using the proper battle system
    const battleTeam = calculateBattleStats(user);

    if (!battleTeam || battleTeam.length === 0) {
        return message.reply('❌ Your team is invalid or cards are missing. Please check your team with `op team` and fix any issues.');
    }

    // Initialize enemies
    let enemies = [];
    
    if (stageData.type === 'multi_enemy') {
        enemies = stageData.enemies.map(enemy => ({
            ...enemy,
            currentHp: enemy.hp,
            maxHp: enemy.hp
        }));
    } else {
        enemies = [{
            ...stageData.enemy,
            currentHp: stageData.enemy.hp,
            maxHp: stageData.enemy.hp
        }];
    }

    // Ensure battle team has proper health values
    battleTeam.forEach(card => {
        if (!card.currentHp || card.currentHp <= 0) {
            card.currentHp = card.hp || card.maxHp || 100;
        }
        if (!card.maxHp) {
            card.maxHp = card.hp || 100;
        }
    });

    // Final validation - ensure we have at least one alive team member
    const aliveCount = battleTeam.filter(card => card.currentHp > 0).length;
    if (aliveCount === 0) {
        return message.reply('❌ Your team has no health! Please check your cards or try again.');
    }

    const battleState = {
        userTeam: battleTeam,
        enemies: enemies,
        turn: 1,
        userBoosts: {},
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
    
    await saveUserWithRetry(user);

    return await displayBattleState(message, user, client);
}

async function handleBossFight(message, user, client) {
    return await displayBattleState(message, user, client);
}

async function displayBattleState(message, user, client) {
    const battleState = user.exploreStates.battleState;
    const stageData = user.exploreStates.currentStage;
    
    if (!battleState || !stageData) {
        // Clean up corrupted state
        user.exploreStates.inBossFight = false;
        user.exploreStates.battleState = null;
        user.exploreStates.currentStage = null;
        await saveUserWithRetry(user);
        return message.reply('❌ Battle state corrupted. Please try exploring again.');
    }

    // Create clean battle embed
    const embed = new EmbedBuilder()
        .setTitle(stageData.title)
        .setDescription(stageData.desc)
        .setColor(0x2b2d31);

    // Use enhanced team display
    const aliveTeamMembers = battleState.userTeam.filter(card => card.currentHp > 0);
    
    // Emergency check - if no team members are alive, something went wrong
    if (aliveTeamMembers.length === 0) {
        // Reset team health as emergency fix
        battleState.userTeam.forEach(card => {
            if (!card.currentHp || card.currentHp <= 0) {
                card.currentHp = card.hp || card.maxHp || 100;
            }
        });
        const fixedTeam = battleState.userTeam.filter(card => card.currentHp > 0);
        
        if (fixedTeam.length > 0) {
            const teamDisplay = createProfessionalTeamDisplay(fixedTeam, message.author.username);
            embed.addFields({
                name: `${message.author.username}'s Team`,
                value: teamDisplay,
                inline: false
            });
        } else {
            // If still no team, clean up and restart
            user.exploreStates.inBossFight = false;
            user.exploreStates.battleState = null;
            user.exploreStates.currentStage = null;
            await saveUserWithRetry(user);
            return message.reply('❌ Battle initialization failed. Please try exploring again with `op explore`.');
        }
    } else {
        const teamDisplay = createProfessionalTeamDisplay(aliveTeamMembers, message.author.username);
        embed.addFields({
            name: `${message.author.username}'s Team`,
            value: teamDisplay,
            inline: false
        });
    }

    // Enhanced enemy display
    const activeEnemies = battleState.enemies.filter(enemy => enemy.currentHp > 0);
    if (activeEnemies.length > 0) {
        const enemyDisplay = createEnemyDisplay(activeEnemies);
        embed.addFields({
            name: `Enemies`,
            value: enemyDisplay,
            inline: false
        });
    }



    // Create clean battle buttons
    const battleButtons = [
        new ButtonBuilder()
            .setCustomId('battle_attack')
            .setLabel('Attack')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('battle_items')
            .setLabel('Items')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('battle_flee')
            .setLabel('Flee')
            .setStyle(ButtonStyle.Secondary)
    ];

    const row = new ActionRowBuilder().addComponents(battleButtons);

    const battleMessage = await message.reply({ embeds: [embed], components: [row] });

    const filter = i => i.user.id === message.author.id;
    const collector = battleMessage.createMessageComponentCollector({ filter, time: 300000 });

    collector.on('collect', async interaction => {
        try {
            await interaction.deferUpdate();
            
            if (interaction.customId === 'battle_attack') {
                await handleBattleAttack(interaction, user, battleMessage);
            } else if (interaction.customId === 'battle_items') {
                await handleBattleItems(interaction, user, battleMessage);
            } else if (interaction.customId === 'battle_flee') {
                await handleBattleFlee(interaction, user, battleMessage);
            }
        } catch (error) {
            console.error('Battle interaction error:', error);
            // Attempt to clean up battle state on error
            try {
                user.exploreStates.inBossFight = false;
                user.exploreStates.battleState = null;
                user.exploreStates.currentStage = null;
                await saveUserWithRetry(user);
            } catch (saveError) {
                console.error('Error cleaning up battle state:', saveError);
            }
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.followUp({ content: 'An error occurred during battle. Battle state has been reset.', ephemeral: true });
            }
        }
    });

    collector.on('end', () => {
        battleMessage.edit({ components: [] }).catch(() => {});
    });
}

async function handleBattleAttack(interaction, user, battleMessage) {
    try {
        // Use the passed-in user first, only refresh if battle state is missing
        let currentUser = user;
        
        // Check if battle state exists in current user
        if (!currentUser.exploreStates || !currentUser.exploreStates.battleState) {
            // Try refreshing from database as fallback
            const freshUser = await User.findOne({ userId: interaction.user.id });
            if (!freshUser || !freshUser.exploreStates || !freshUser.exploreStates.battleState) {
                return await interaction.followUp({ 
                    content: '❌ Battle state lost! Please start exploring again with `op explore`.', 
                    ephemeral: true 
                });
            }
            currentUser = freshUser;
        }

        const battleState = currentUser.exploreStates.battleState;
        
        // Validate battle state has required properties
        if (!battleState.userTeam || !battleState.enemies) {
            return await interaction.followUp({ 
                content: '❌ Invalid battle state! Please start exploring again with `op explore`.', 
                ephemeral: true 
            });
        }

        // Get the first alive team member to attack
        const attacker = battleState.userTeam.find(card => card.currentHp > 0);
        if (!attacker) {
            return await handleBattleDefeat(interaction, currentUser, battleMessage, 'Your team is defeated!');
        }

        // Find first enemy alive
        const targetEnemy = battleState.enemies.find(e => e.currentHp > 0);
        if (!targetEnemy) {
            return await interaction.followUp({ 
                content: '❌ No enemies to attack!', 
                ephemeral: true 
            });
        }

        // Calculate damage using the proper battle system
        let attackDamage = calculateDamage(attacker, targetEnemy);
        
        // Apply user boosts
        if (battleState.userBoosts && battleState.userBoosts.attack_boost) {
            attackDamage += battleState.userBoosts.attack_boost.amount;
            battleState.userBoosts.attack_boost.duration--;
            if (battleState.userBoosts.attack_boost.duration <= 0) {
                delete battleState.userBoosts.attack_boost;
            }
        }
        
        targetEnemy.currentHp = Math.max(0, targetEnemy.currentHp - attackDamage);
        
        let battleLog = `${attacker.name} attacks ${targetEnemy.name} for ${attackDamage} damage!`;
        
        if (targetEnemy.currentHp <= 0) {
            battleLog += `\n${targetEnemy.name} is defeated!`;
        }

        // Check if all enemies defeated
        if (battleState.enemies.every(e => e.currentHp <= 0)) {
            return await handleBattleVictory(interaction, currentUser, battleMessage, battleLog);
        }

        // Enemy attacks back - target random team member
        const aliveEnemies = battleState.enemies.filter(e => e.currentHp > 0);
        const aliveTeamMembers = battleState.userTeam.filter(card => card.currentHp > 0);
        
        for (const enemy of aliveEnemies) {
            if (aliveTeamMembers.length === 0) break;
            
            const target = aliveTeamMembers[Math.floor(Math.random() * aliveTeamMembers.length)];
            const damage = calculateDamage(enemy, target);
            
            target.currentHp = Math.max(0, target.currentHp - damage);
            battleLog += `\n${enemy.name} attacks ${target.name} for ${damage} damage!`;
            
            if (target.currentHp <= 0) {
                battleLog += `\n${target.name} is defeated!`;
            }
        }

        // Check if all team members defeated
        if (battleState.userTeam.every(card => card.currentHp <= 0)) {
            return await handleBattleDefeat(interaction, currentUser, battleMessage, battleLog);
        }

        battleState.turn++;
        currentUser.exploreStates.battleState = battleState;
        await saveUserWithRetry(currentUser);

        // Create enhanced battle log display
        const battleLogDisplay = createBattleLogDisplay([battleLog]);
        
        // Update battle display
        const embed = new EmbedBuilder()
            .setTitle(`Turn ${battleState.turn} - Battle Continues`)
            .setColor(0x2b2d31);

        // Enhanced team display
        const aliveTeam = battleState.userTeam.filter(card => card.currentHp > 0);
        if (aliveTeam.length > 0) {
            const teamDisplay = createProfessionalTeamDisplay(aliveTeam, interaction.user.username);
            embed.addFields({
                name: `${interaction.user.username}'s Team`,
                value: teamDisplay,
                inline: false
            });
        }

        // Enhanced enemy display
        const currentEnemies = battleState.enemies.filter(enemy => enemy.currentHp > 0);
        if (currentEnemies.length > 0) {
            const enemyDisplay = createEnemyDisplay(currentEnemies);
            embed.addFields({
                name: `Enemies`,
                value: enemyDisplay,
                inline: false
            });
        }

        // Battle log display
        embed.addFields({
            name: `Recent Actions`,
            value: battleLogDisplay,
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
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('battle_flee')
                .setLabel('Flee')
                .setStyle(ButtonStyle.Secondary)
        ];

        const row = new ActionRowBuilder().addComponents(battleButtons);

        await battleMessage.edit({ embeds: [embed], components: [row] });

    } catch (error) {
        console.error('Error in handleBattleAttack:', error);
        return await interaction.followUp({ 
            content: '❌ An error occurred during the attack. Please try exploring again with `op explore`.', 
            ephemeral: true 
        });
    }
}

async function handleBattleItems(interaction, user, battleMessage) {
    try {
        // Use the passed-in user first, only refresh if battle state is missing
        let currentUser = user;
        
        // Check if battle state exists in current user
        if (!currentUser.exploreStates || !currentUser.exploreStates.battleState) {
            // Try refreshing from database as fallback
            const freshUser = await User.findOne({ userId: interaction.user.id });
            if (!freshUser || !freshUser.exploreStates || !freshUser.exploreStates.battleState) {
                return await interaction.followUp({ 
                    content: '❌ Battle state lost! Please start exploring again with `op explore`.', 
                    ephemeral: true 
                });
            }
            currentUser = freshUser;
        }

        const usableItems = ['basicpotion', 'normalpotion', 'maxpotion'];
        const availableItems = usableItems.filter(item => canUseInventoryItem(currentUser, item));
        
        if (availableItems.length === 0) {
            return await interaction.followUp({ content: 'You have no usable items!', ephemeral: true });
        }
        
        const itemButtons = availableItems.map(item => {
            const itemLabels = {
                'basicpotion': 'Basic Potion',
                'normalpotion': 'Normal Potion', 
                'maxpotion': 'Max Potion'
            };
            return new ButtonBuilder()
                .setCustomId(`use_${item}`)
                .setLabel(itemLabels[item] || item)
                .setStyle(ButtonStyle.Primary);
        });
        
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
            try {
                await itemInteraction.deferUpdate();
                
                // Use the outer currentUser directly instead of refreshing
                // This prevents battle state loss from database consistency issues
                const itemName = itemInteraction.customId.replace('use_', '');
                const effect = useInventoryItem(currentUser, itemName);
                
                if (!effect) {
                    return await itemInteraction.followUp({ content: 'Item could not be used!', ephemeral: true });
                }

                const battleState = currentUser.exploreStates.battleState;
                let effectText = '';

                // Apply item effects
                if (effect.type === 'heal') {
                    // Heal the first injured team member
                    const injuredCard = battleState.userTeam.find(card => card.currentHp < card.maxHp && card.currentHp > 0);
                    if (injuredCard) {
                        const healAmount = Math.floor(injuredCard.maxHp * (effect.percent / 100));
                        const actualHeal = Math.min(healAmount, injuredCard.maxHp - injuredCard.currentHp);
                        injuredCard.currentHp += actualHeal;
                        effectText = `Healed ${injuredCard.name} for ${actualHeal} HP (${effect.percent}% of max HP)!`;
                    } else {
                        effectText = `No injured team members to heal!`;
                    }
                } else if (effect.type === 'attack_boost') {
                    if (!battleState.userBoosts) battleState.userBoosts = {};
                    battleState.userBoosts.attack_boost = { amount: effect.amount, duration: effect.duration };
                    effectText = `Attack increased by ${effect.amount}!`;
                } else if (effect.type === 'speed_boost') {
                    if (!battleState.userBoosts) battleState.userBoosts = {};
                    battleState.userBoosts.speed_boost = { amount: effect.amount, duration: effect.duration };
                    effectText = `Speed increased by ${effect.amount}!`;
                } else if (effect.type === 'defense_boost') {
                    if (!battleState.userBoosts) battleState.userBoosts = {};
                    battleState.userBoosts.defense_boost = { amount: effect.amount, duration: effect.duration };
                    effectText = `Defense increased by ${effect.amount}!`;
                }

                await saveUserWithRetry(currentUser);

                // Update battle display with item effect
                const embed = new EmbedBuilder()
                    .setTitle(`Item Used: ${itemName.charAt(0).toUpperCase() + itemName.slice(1)}`)
                    .setDescription(effectText)
                    .setColor(0x2ecc71);

                await itemInteraction.editReply({ embeds: [embed], components: [] });

                // Continue battle
                battleState.turn++;
                await handleEnemyTurn(interaction, currentUser, battleMessage);
            } catch (error) {
                console.error('Error in item use:', error);
                await itemInteraction.followUp({ 
                    content: '❌ Error using item. Please try again.', 
                    ephemeral: true 
                });
            }
        });
    } catch (error) {
        console.error('Error in handleBattleItems:', error);
        return await interaction.followUp({ 
            content: '❌ An error occurred accessing items. Please try exploring again.', 
            ephemeral: true 
        });
    }
}

async function handleEnemyTurn(interaction, user, battleMessage) {
    try {
        // Use the passed-in user first, only refresh if battle state is missing
        let currentUser = user;
        
        // Check if battle state exists in current user
        if (!currentUser.exploreStates || !currentUser.exploreStates.battleState) {
            // Try refreshing from database as fallback
            const freshUser = await User.findOne({ userId: interaction.user.id });
            if (!freshUser || !freshUser.exploreStates || !freshUser.exploreStates.battleState) {
                return await interaction.followUp({ 
                    content: '❌ Battle state lost during enemy turn!', 
                    ephemeral: true 
                });
            }
            currentUser = freshUser;
        }

        const battleState = currentUser.exploreStates.battleState;
        let battleLog = '';

        // Each alive enemy attacks a random team member
        const aliveTeamMembers = battleState.userTeam.filter(card => card.currentHp > 0);
        
        for (const enemy of battleState.enemies) {
            if (enemy.currentHp <= 0 || aliveTeamMembers.length === 0) continue;

            const target = aliveTeamMembers[Math.floor(Math.random() * aliveTeamMembers.length)];
            const damage = calculateDamage(enemy, target);
            
            target.currentHp = Math.max(0, target.currentHp - damage);
            battleLog += `${enemy.name} attacks ${target.name} for ${damage} damage!\n`;

            if (target.currentHp <= 0) {
                battleLog += `${target.name} is defeated!\n`;
                // Remove defeated card from alive members array
                const index = aliveTeamMembers.indexOf(target);
                if (index > -1) aliveTeamMembers.splice(index, 1);
            }

            if (aliveTeamMembers.length === 0) {
                return await handleBattleDefeat(interaction, currentUser, battleMessage, battleLog);
            }
        }

        // Reduce boost durations
        if (battleState.userBoosts) {
            Object.keys(battleState.userBoosts).forEach(key => {
                if (battleState.userBoosts[key].duration) {
                    battleState.userBoosts[key].duration--;
                    if (battleState.userBoosts[key].duration <= 0) {
                        delete battleState.userBoosts[key];
                    }
                }
            });
        }

        await saveUserWithRetry(currentUser);

        // Create enhanced battle log display
        const battleLogDisplay = createBattleLogDisplay([battleLog]);
        
        // Update battle display with enhanced UI
        const embed = new EmbedBuilder()
            .setTitle(`Turn ${battleState.turn} - Enemy Turn`)
            .setColor(0x2b2d31);

        // Enhanced team display
        const aliveTeam = battleState.userTeam.filter(card => card.currentHp > 0);
        if (aliveTeam.length > 0) {
            const teamDisplay = createProfessionalTeamDisplay(aliveTeam, interaction.user.username);
            embed.addFields({
                name: `${interaction.user.username}'s Team`,
                value: teamDisplay,
                inline: false
            });
        }

        // Enhanced enemy display
        const remainingEnemies = battleState.enemies.filter(enemy => enemy.currentHp > 0);
        if (remainingEnemies.length > 0) {
            const enemyDisplay = createEnemyDisplay(remainingEnemies);
            embed.addFields({
                name: `Enemies`,
                value: enemyDisplay,
                inline: false
            });
        }

        // Battle log display
        embed.addFields({
            name: `Recent Actions`,
            value: battleLogDisplay,
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
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('battle_flee')
                .setLabel('Flee')
                .setStyle(ButtonStyle.Secondary)
        ];

        const row = new ActionRowBuilder().addComponents(battleButtons);
        await battleMessage.edit({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('Error in handleEnemyTurn:', error);
        return await interaction.followUp({ 
            content: '❌ An error occurred during enemy turn. Please try exploring again.', 
            ephemeral: true 
        });
    }
}

async function handleBattleFlee(interaction, user, battleMessage) {
    try {
        // Use the passed-in user first, only refresh if needed
        let currentUser = user;
        
        // If no exploreStates, refresh from database
        if (!currentUser.exploreStates) {
            const freshUser = await User.findOne({ userId: interaction.user.id });
            if (!freshUser) {
                return await interaction.followUp({ content: '❌ User data not found!', ephemeral: true });
            }
            currentUser = freshUser;
        }

        // Clean up battle state properly
        currentUser.exploreStates.inBossFight = false;
        currentUser.exploreStates.battleState = null;
        currentUser.exploreStates.currentStage = null;
        
        // Set flee cooldown
        currentUser.exploreStates.defeatCooldown = Date.now() + (30 * 60 * 1000); // 30 minute cooldown for fleeing
        
        await saveUserWithRetry(currentUser);
        
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
    
    // Update quest progress
    try {
        const { updateQuestProgress } = require('../utils/questSystem.js');
        await updateQuestProgress(user, 'explore', 1);
        if (stageData.type === 'boss') {
            await updateQuestProgress(user, 'battle_win', 1);
        }
    } catch (error) {
        // Remove excessive logging - quest system is optional
        // console.log('Quest system not available');
    }
    
    await saveUserWithRetry(user);
    
    const victoryEmbed = new EmbedBuilder()
        .setTitle('🎉 Victory!')
        .setDescription(battleLog + '\n\n✅ **You won the battle!**')
        .setColor(0x2ecc71);
    
    if (stageData.reward) {
        victoryEmbed.addFields({ name: 'Rewards', value: getRewardText(stageData.reward), inline: false });
    }
    
    // Add user level up notifications
    if (user.recentUserLevelUps && user.recentUserLevelUps.length > 0) {
        const { formatLevelUpRewards } = require('../utils/userLevelSystem.js');
        const userLevelUp = user.recentUserLevelUps[user.recentUserLevelUps.length - 1];
        
        if (userLevelUp.leveledUp) {
            const levelUpText = `**🌟 LEVEL UP! 🌟**\n${userLevelUp.oldLevel} → **${userLevelUp.newLevel}**\n${formatLevelUpRewards(userLevelUp.rewards)}`;
            victoryEmbed.addFields({ name: 'Pirate Level Up!', value: levelUpText.trim(), inline: false });
        }
        
        // Clear the level up notification
        user.recentUserLevelUps = [];
    }
    
    // Add card level up notifications
    if (user.recentLevelUps && user.recentLevelUps.length > 0) {
        const cardLevelUpText = user.recentLevelUps.map(change => 
            `**${change.name}** leveled up! (${change.oldLevel} → ${change.newLevel})`
        ).join('\n');
        victoryEmbed.addFields({ name: 'Card Level Ups!', value: cardLevelUpText, inline: false });
        
        // Clear card level up notifications
        user.recentLevelUps = [];
    }
    
    await battleMessage.edit({ embeds: [victoryEmbed], components: [] });
}

async function handleBattleDefeat(interaction, user, battleMessage, battleLog) {
    const stageData = user.exploreStates.currentStage;
    
    // Clean up battle state
    user.exploreStates.inBossFight = false;
    user.exploreStates.battleState = null;
    user.exploreStates.currentStage = null;
    
    // Set defeat cooldown
    user.exploreStates.defeatCooldown = Date.now() + (stageData.loseCooldown || DEFEAT_COOLDOWN);
    
    await saveUserWithRetry(user);
    
    const defeatEmbed = new EmbedBuilder()
        .setTitle('💀 Defeat!')
        .setDescription(battleLog + '\n\n❌ **You were defeated!**')
        .setColor(0xe74c3c);
    
    await battleMessage.edit({ embeds: [defeatEmbed], components: [] });
}

async function applyReward(user, reward) {
    if (!reward) return;
    
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
        const cardToAdd = {
            name: reward.name,
            rank: reward.rank,
            level: 1,
            experience: 0,
            timesUpgraded: 0,
            locked: false
        };
        addCardWithTransformation(user, cardToAdd);
    } else if (reward.type === 'multiple') {
        for (const subReward of reward.rewards) {
            await applyReward(user, subReward);
        }
    } else if (reward.type === 'saga_unlock') {
        if (!user.unlockedSagas) user.unlockedSagas = ['East Blue'];
        if (!user.unlockedSagas.includes(reward.saga)) {
            user.unlockedSagas.push(reward.saga);
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

module.exports = { data, execute };
