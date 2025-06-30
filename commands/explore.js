
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');

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
    if (!user.inventory.map(normalizeItemName).includes(normItem)) {
        user.inventory.push(normItem);
    }
}

function addXP(user, amount) {
    const xpBoost = user.activeBoosts?.find(boost => 
        boost.type === 'double_xp' && boost.expiresAt > Date.now()
    );
    const finalAmount = xpBoost ? amount * 2 : amount;
    user.xp = (user.xp || 0) + finalAmount;
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

// Calculate equipped item bonuses
function calculateEquippedBonuses(user) {
    const bonuses = { hp: 0, atk: 0, spd: 0, def: 0 };
    
    if (!user.equipped) return bonuses;
    
    // Item stat bonuses - normalized item names
    const itemBonuses = {
        'strawhat': { hp: 10, atk: 5, spd: 5 },
        'marinesword': { atk: 15, spd: 5 },
        'townmap': { spd: 10 },
        'battlebanner': { hp: 20, atk: 10 },
        'speedboostfood': { spd: 25 }
    };
    
    // Handle both Map and Object types for equipped items
    const equippedEntries = user.equipped instanceof Map ? 
        Array.from(user.equipped.entries()) : 
        Object.entries(user.equipped);
    
    for (const [cardName, itemName] of equippedEntries) {
        // Ensure itemName is a string before normalizing
        if (itemName && typeof itemName === 'string') {
            const normalizedItem = normalizeItemName(itemName);
            if (itemBonuses[normalizedItem]) {
                const bonus = itemBonuses[normalizedItem];
                bonuses.hp += bonus.hp || 0;
                bonuses.atk += bonus.atk || 0;
                bonuses.spd += bonus.spd || 0;
                bonuses.def += bonus.def || 0;
            }
        }
    }
    
    return bonuses;
}

// Get user's battle stats including equipped item bonuses
function getUserBattleStats(user) {
    const baseStats = {
        hp: 100 + (user.level || 1) * 10,
        atk: 15 + (user.level || 1) * 2,
        spd: 50 + (user.level || 1) * 3
    };
    
    const equipped = calculateEquippedBonuses(user);
    
    return {
        hp: baseStats.hp + equipped.hp,
        atk: baseStats.atk + equipped.atk,
        spd: baseStats.spd + equipped.spd,
        def: equipped.def
    };
}

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
        'healthpotion': { type: 'heal', amount: 50 },
        'strengthpotion': { type: 'attack_boost', amount: 20, duration: 3 },
        'speedboostfood': { type: 'speed_boost', amount: 15, duration: 3 },
        'defensepotion': { type: 'defense_boost', amount: 15, duration: 3 }
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
    
    if (!locationData || localStage >= locationData.length) {
        return message.reply('❌ No more stages available in this location!');
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
        console.log('Quest system not available');
    }
    
    await user.save();
    
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
                console.log('Quest system not available');
            }
            
            await user.save();
            
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
    // Initialize battle state
    const userStats = getUserBattleStats(user);
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

    const battleState = {
        userHp: userStats.hp,
        userMaxHp: userStats.hp,
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
    
    await user.save();

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
        await user.save();
        return message.reply('❌ Battle state corrupted. Please try exploring again.');
    }

    const embed = new EmbedBuilder()
        .setTitle(`⚔️ ${stageData.title}`)
        .setDescription(stageData.desc)
        .setColor(battleState.isBossFight ? 0xe74c3c : 0xf39c12);

    // User HP bar
    const userHpBar = createHpBar(battleState.userHp, battleState.userMaxHp);
    embed.addFields({
        name: `${message.author.username} (You)`,
        value: `❤️ ${battleState.userHp}/${battleState.userMaxHp} ${userHpBar}`,
        inline: false
    });

    // Enemy HP bars
    battleState.enemies.forEach((enemy, index) => {
        if (enemy.currentHp > 0) {
            const enemyHpBar = createHpBar(enemy.currentHp, enemy.maxHp);
            embed.addFields({
                name: `${enemy.name}`,
                value: `💀 ${enemy.currentHp}/${enemy.maxHp} ${enemyHpBar}`,
                inline: true
            });
        }
    });

    // Create battle buttons
    const battleButtons = [
        new ButtonBuilder()
            .setCustomId('battle_attack')
            .setLabel('Attack')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('battle_items')
            .setLabel('Use Item')
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
                await user.save();
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
    const battleState = user.exploreStates.battleState;
    const userStats = getUserBattleStats(user);
    
    // User attacks first enemy alive
    const targetEnemy = battleState.enemies.find(e => e.currentHp > 0);
    if (!targetEnemy) return;

    let attackDamage = Math.floor(Math.random() * (userStats.atk - 10) + 10);
    
    // Apply user boosts
    if (battleState.userBoosts.attack_boost) {
        attackDamage += battleState.userBoosts.attack_boost.amount;
        battleState.userBoosts.attack_boost.duration--;
        if (battleState.userBoosts.attack_boost.duration <= 0) {
            delete battleState.userBoosts.attack_boost;
        }
    }
    
    targetEnemy.currentHp = Math.max(0, targetEnemy.currentHp - attackDamage);
    
    let battleLog = `⚔️ You attack ${targetEnemy.name} for ${attackDamage} damage!`;
    
    if (targetEnemy.currentHp <= 0) {
        battleLog += `\n💀 ${targetEnemy.name} is defeated!`;
    }

    // Check if all enemies defeated
    if (battleState.enemies.every(e => e.currentHp <= 0)) {
        return await handleBattleVictory(interaction, user, battleMessage, battleLog);
    }

    // Enemy attacks back
    const aliveEnemies = battleState.enemies.filter(e => e.currentHp > 0);
    for (const enemy of aliveEnemies) {
        const enemyAttack = Array.isArray(enemy.atk) ? 
            Math.floor(Math.random() * (enemy.atk[1] - enemy.atk[0] + 1)) + enemy.atk[0] :
            enemy.atk;
        
        let damage = enemyAttack;
        
        // Apply defense from equipment
        if (userStats.def > 0) {
            damage = Math.max(1, damage - userStats.def);
        }
        
        battleState.userHp = Math.max(0, battleState.userHp - damage);
        battleLog += `\n💥 ${enemy.name} attacks you for ${damage} damage!`;
        
        if (battleState.userHp <= 0) {
            return await handleBattleDefeat(interaction, user, battleMessage, battleLog);
        }
    }

    battleState.turn++;
    user.exploreStates.battleState = battleState;
    await user.save();

    // Update battle display
    const embed = new EmbedBuilder()
        .setTitle(`⚔️ Turn ${battleState.turn}`)
        .setDescription(battleLog)
        .setColor(0xf39c12);

    // User HP
    const userHpBar = createHpBar(battleState.userHp, battleState.userMaxHp);
    embed.addFields({
        name: `${interaction.user.username} (You)`,
        value: `❤️ ${battleState.userHp}/${battleState.userMaxHp} ${userHpBar}`,
        inline: false
    });

    // Enemy HP
    battleState.enemies.forEach(enemy => {
        if (enemy.currentHp > 0) {
            const enemyHpBar = createHpBar(enemy.currentHp, enemy.maxHp);
            embed.addFields({
                name: enemy.name,
                value: `💀 ${enemy.currentHp}/${enemy.maxHp} ${enemyHpBar}`,
                inline: true
            });
        }
    });

    const battleButtons = [
        new ButtonBuilder()
            .setCustomId('battle_attack')
            .setLabel('Attack')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('battle_items')
            .setLabel('Use Item')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('battle_flee')
            .setLabel('Flee')
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

        // Apply item effects
        if (effect.type === 'heal') {
            const healAmount = Math.min(effect.amount, battleState.userMaxHp - battleState.userHp);
            battleState.userHp += healAmount;
            effectText = `Healed ${healAmount} HP!`;
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
    const userStats = getUserBattleStats(user);
    let battleLog = '';

    // Each alive enemy attacks
    for (const enemy of battleState.enemies) {
        if (enemy.currentHp <= 0) continue;

        const enemyDamage = Array.isArray(enemy.atk) 
            ? Math.floor(Math.random() * (enemy.atk[1] - enemy.atk[0] + 1)) + enemy.atk[0]
            : enemy.atk;

        const userDefense = battleState.userBoosts?.defense_boost?.amount || 0;
        const finalDamage = Math.max(1, enemyDamage - userDefense);
        
        battleState.userHp = Math.max(0, battleState.userHp - finalDamage);
        battleLog += `${enemy.name} attacks for ${finalDamage} damage!\n`;

        if (battleState.userHp <= 0) {
            return await handleBattleDefeat(interaction, user, battleMessage, battleLog);
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

    await user.save();

    // Update battle display
    const embed = new EmbedBuilder()
        .setTitle(`Turn ${battleState.turn}`)
        .setDescription(battleLog)
        .setColor(0xf39c12);

    // User HP
    const userHpBar = createHpBar(battleState.userHp, battleState.userMaxHp);
    embed.addFields({
        name: `${interaction.user.username} (You)`,
        value: `❤️ ${battleState.userHp}/${battleState.userMaxHp} ${userHpBar}`,
        inline: false
    });

    // Enemy HP
    battleState.enemies.forEach(enemy => {
        if (enemy.currentHp > 0) {
            const enemyHpBar = createHpBar(enemy.currentHp, enemy.maxHp);
            embed.addFields({
                name: enemy.name,
                value: `💀 ${enemy.currentHp}/${enemy.maxHp} ${enemyHpBar}`,
                inline: true
            });
        }
    });

    const battleButtons = [
        new ButtonBuilder()
            .setCustomId('battle_attack')
            .setLabel('Attack')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('battle_items')
            .setLabel('Use Item')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('battle_flee')
            .setLabel('Flee')
            .setStyle(ButtonStyle.Secondary)
    ];

    const row = new ActionRowBuilder().addComponents(battleButtons);
    await battleMessage.edit({ embeds: [embed], components: [row] });
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
    
    // Update quest progress
    try {
        const { updateQuestProgress } = require('../utils/questSystem.js');
        await updateQuestProgress(user, 'explore', 1);
        if (stageData.type === 'boss') {
            await updateQuestProgress(user, 'battle_win', 1);
        }
    } catch (error) {
        console.log('Quest system not available');
    }
    
    await user.save();
    
    const victoryEmbed = new EmbedBuilder()
        .setTitle('🎉 Victory!')
        .setDescription(battleLog + '\n\n✅ **You won the battle!**')
        .setColor(0x2ecc71);
    
    if (stageData.reward) {
        victoryEmbed.addFields({ name: 'Rewards', value: getRewardText(stageData.reward), inline: false });
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
    
    await user.save();
    
    const defeatEmbed = new EmbedBuilder()
        .setTitle('💀 Defeat!')
        .setDescription(battleLog + '\n\n❌ **You were defeated!**')
        .setColor(0xe74c3c);
    
    await battleMessage.edit({ embeds: [defeatEmbed], components: [] });
}

async function applyReward(user, reward) {
    if (!reward) return;
    
    if (reward.type === 'xp') {
        addXP(user, reward.amount);
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
