const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { calculateBattleStats, calculateDamage } = require('../utils/battleSystem.js');
const { distributeXPToTeam } = require('../utils/levelSystem.js');
const { saveUserWithRetry } = require('../utils/saveWithRetry.js');
const { createProfessionalTeamDisplay, createEnemyDisplay, createBattleLogDisplay } = require('../utils/uiHelpers.js');

// Available arcs for sailing
const AVAILABLE_ARCS = {
    'east blue': 'East Blue',
    'eastblue': 'East Blue'
};

// Unlock requirements
const SAGA_UNLOCK_REQUIREMENTS = {
    'East Blue': 42 // Must complete stage 42 (defeat Arlong)
};

// Bounty rewards for different enemy ranks
function getBountyForRank(rank) {
    const bountyMap = {
        'C': 10000,
        'B': 100000,
        'A': 300000,
        'S': 1000000
    };
    return bountyMap[rank] || 0;
}

const data = {
    name: 'sail',
    description: 'Infinite grind mode: Sail an arc for endless rewards!'
};

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomItem(rarity) {
    // Map rarity levels to shop items based on category/price
    const rarityMapping = {
        'Common': ['Basic Potion', 'Leather Vest'],
        'Uncommon': ['Normal Potion', 'Rusty Cutlass', 'Flintlock Pistol'],
        'Rare': ['Max Potion', 'Marine Saber', 'Marine Rifle', 'Marine Coat'],
        'Epic': ['Wado Ichimonji', 'Clima-Tact'],
        'Legendary': ['Pirate King\'s Coat', 'Raid Ticket']
    };
    
    const items = rarityMapping[rarity];
    if (!items || items.length === 0) {
        // Fallback to basic items
        return 'Basic Potion';
    }
    
    return items[getRandomInt(0, items.length - 1)];
}

function generateSailEvent(arcName, sailsCompleted) {
    if (arcName === 'East Blue') {
        return generateEastBlueEvent(sailsCompleted);
    }
    
    // Default fallback event
    return {
        type: 'enemy',
        title: 'Navy Patrol',
        description: 'A Navy patrol blocks your path!',
        enemies: [{ 
            name: 'Navy Soldier', 
            hp: 50, 
            atk: [10, 15], 
            spd: 30, 
            rank: 'C',
            currentHp: 50,
            maxHp: 50 
        }],
        rewards: {
            beli: getRandomInt(10, 20),
            xp: getRandomInt(3, 8),
            items: []
        }
    };
}

function generateEastBlueEvent(sailsCompleted) {
    // Add unique variation to each sail
    const sailVariation = sailsCompleted;
    
    if (sailsCompleted <= 10) {
        // Sails 1-10: ~10 power, ~50 HP total
        const totalHp = Math.floor(40 + sailsCompleted * 1.5 + sailVariation % 3); // 41-56 HP
        const totalPower = Math.floor(8 + sailsCompleted * 0.3 + sailVariation % 2); // 8-13 power
        const enemyCount = sailsCompleted <= 5 ? 1 : getRandomInt(1, 2);
        
        const enemies = Array.from({ length: enemyCount }, (_, i) => {
            const hp = enemyCount === 1 ? totalHp : Math.floor(totalHp / enemyCount) + (i === 0 ? totalHp % enemyCount : 0);
            const atk = enemyCount === 1 ? totalPower : Math.floor(totalPower / enemyCount) + (i === 0 ? totalPower % enemyCount : 0);
            
            return {
                name: enemyCount === 1 ? 'Navy Soldier' : `Navy Soldier ${i + 1}`,
                hp: hp,
                atk: [atk, atk + 3],
                spd: 25 + Math.floor(sailsCompleted * 0.5),
                rank: 'C',
                currentHp: hp,
                maxHp: hp
            };
        });
        
        return {
            type: 'enemy',
            title: `Navy Patrol | Sail ${sailsCompleted}`,
            description: enemyCount === 1 ? 'A Navy soldier patrols these waters.' : `${enemyCount} Navy soldiers block your path.`,
            enemies: enemies,
            rewards: {
                beli: getRandomInt(5 + sailsCompleted, 10 + sailsCompleted * 2),
                xp: getRandomInt(2 + Math.floor(sailsCompleted/3), 4 + Math.floor(sailsCompleted/2)),
                items: sailsCompleted >= 8 ? [getRandomItem('Common')] : []
            }
        };
    } else if (sailsCompleted <= 20) {
        // Sails 11-20: ~20 power, ~70 HP, C ranks
        const totalHp = Math.floor(60 + (sailsCompleted - 10) * 1.5 + sailVariation % 4); // 61-84 HP
        const totalPower = Math.floor(18 + (sailsCompleted - 10) * 0.4 + sailVariation % 3); // 18-26 power
        const enemyCount = getRandomInt(1, 2);
        
        const enemies = Array.from({ length: enemyCount }, (_, i) => {
            const hp = enemyCount === 1 ? totalHp : Math.floor(totalHp / enemyCount) + (i === 0 ? totalHp % enemyCount : 0);
            const atk = enemyCount === 1 ? totalPower : Math.floor(totalPower / enemyCount) + (i === 0 ? totalPower % enemyCount : 0);
            
            return {
                name: enemyCount === 1 ? 'Navy Officer' : `Navy Officer ${i + 1}`,
                hp: hp,
                atk: [atk, atk + 4],
                spd: 30 + Math.floor((sailsCompleted - 10) * 0.8),
                rank: 'C',
                currentHp: hp,
                maxHp: hp
            };
        });
        
        return {
            type: 'enemy',
            title: `Navy Squad | Sail ${sailsCompleted}`,
            description: enemyCount === 1 ? 'A Navy Officer stands guard.' : `${enemyCount} Navy Officers coordinate their attack.`,
            enemies: enemies,
            rewards: {
                beli: getRandomInt(15 + sailsCompleted * 2, 25 + sailsCompleted * 3),
                xp: getRandomInt(5 + Math.floor(sailsCompleted/3), 8 + Math.floor(sailsCompleted/2)),
                items: sailsCompleted >= 15 ? [getRandomItem('Common')] : []
            }
        };
    } else if (sailsCompleted <= 30) {
        // Sails 21-30: ~30 power, ~100 HP, C ranks + C rank bosses + B ranks
        const totalHp = Math.floor(90 + (sailsCompleted - 20) * 1.5 + sailVariation % 5); // 91-115 HP
        const totalPower = Math.floor(28 + (sailsCompleted - 20) * 0.5 + sailVariation % 3); // 28-37 power
        const enemyCount = getRandomInt(2, 3);
        
        const enemies = Array.from({ length: enemyCount }, (_, i) => {
            const hp = Math.floor(totalHp / enemyCount) + (i === 0 ? totalHp % enemyCount : 0);
            const atk = Math.floor(totalPower / enemyCount) + (i === 0 ? totalPower % enemyCount : 0);
            const isBoss = i === 0 && sailsCompleted >= 25;
            const rank = isBoss ? 'B' : 'C';
            
            return {
                name: isBoss ? 'Navy Lieutenant Commander' : `Navy Lieutenant ${i + 1}`,
                hp: hp,
                atk: [atk, atk + 5],
                spd: 35 + Math.floor((sailsCompleted - 20) * 0.7),
                rank: rank,
                currentHp: hp,
                maxHp: hp
            };
        });
        
        return {
            type: 'enemy',
            title: `Navy Force | Sail ${sailsCompleted}`,
            description: `${enemyCount} Navy Lieutenants form a tactical formation.`,
            enemies: enemies,
            rewards: {
                beli: getRandomInt(25 + sailsCompleted * 3, 40 + sailsCompleted * 4),
                xp: getRandomInt(8 + Math.floor(sailsCompleted/3), 12 + Math.floor(sailsCompleted/2)),
                items: [getRandomItem('Uncommon')]
            }
        };
    } else if (sailsCompleted <= 40) {
        // Sails 31-40: ~50 power, ~150 HP, B ranks + B rank bosses
        const totalHp = Math.floor(140 + (sailsCompleted - 30) * 1.5 + sailVariation % 6); // 141-165 HP
        const totalPower = Math.floor(48 + (sailsCompleted - 30) * 0.4 + sailVariation % 3); // 48-57 power
        const enemyCount = getRandomInt(2, 3);
        
        const enemies = Array.from({ length: enemyCount }, (_, i) => {
            const hp = Math.floor(totalHp / enemyCount) + (i === 0 ? totalHp % enemyCount : 0);
            const atk = Math.floor(totalPower / enemyCount) + (i === 0 ? totalPower % enemyCount : 0);
            const isBoss = i === 0;
            
            return {
                name: isBoss ? 'Navy Commander' : `Navy Captain ${i + 1}`,
                hp: hp,
                atk: [atk, atk + 6],
                spd: 40 + Math.floor((sailsCompleted - 30) * 0.8),
                rank: 'B',
                currentHp: hp,
                maxHp: hp
            };
        });
        
        return {
            type: 'enemy',
            title: `Navy Battalion | Sail ${sailsCompleted}`,
            description: `${enemyCount} Navy Captains lead a skilled battalion.`,
            enemies: enemies,
            rewards: {
                beli: getRandomInt(40 + sailsCompleted * 4, 60 + sailsCompleted * 5),
                xp: getRandomInt(12 + Math.floor(sailsCompleted/3), 16 + Math.floor(sailsCompleted/2)),
                items: [getRandomItem('Uncommon')]
            }
        };
    } else if (sailsCompleted <= 50) {
        // Sails 41-50: ~55 power, ~180 HP, B ranks + B rank bosses + A ranks
        const totalHp = Math.floor(170 + (sailsCompleted - 40) * 1.5 + sailVariation % 7); // 171-195 HP
        const totalPower = Math.floor(53 + (sailsCompleted - 40) * 0.4 + sailVariation % 3); // 53-62 power
        const enemyCount = getRandomInt(2, 3);
        
        const enemies = Array.from({ length: enemyCount }, (_, i) => {
            const hp = Math.floor(totalHp / enemyCount) + (i === 0 ? totalHp % enemyCount : 0);
            const atk = Math.floor(totalPower / enemyCount) + (i === 0 ? totalPower % enemyCount : 0);
            const isBoss = i === 0;
            const hasARank = sailsCompleted >= 45 && i === 0;
            const rank = hasARank ? 'A' : 'B';
            
            return {
                name: hasARank ? 'Navy Commodore' : (isBoss ? 'Navy Major' : `Navy Captain ${i + 1}`),
                hp: hp,
                atk: [atk, atk + 7],
                spd: 45 + Math.floor((sailsCompleted - 40) * 0.9),
                rank: rank,
                currentHp: hp,
                maxHp: hp
            };
        });
        
        return {
            type: 'enemy',
            title: `Navy Regiment | Sail ${sailsCompleted}`,
            description: `${enemyCount} elite Navy officers command a powerful regiment.`,
            enemies: enemies,
            rewards: {
                beli: getRandomInt(60 + sailsCompleted * 5, 80 + sailsCompleted * 6),
                xp: getRandomInt(16 + Math.floor(sailsCompleted/3), 20 + Math.floor(sailsCompleted/2)),
                items: [getRandomItem('Rare')]
            }
        };
    } else if (sailsCompleted <= 60) {
        // Sails 51-60: ~70 power, ~200 HP, A ranks + A rank bosses + S ranks
        const totalHp = Math.floor(190 + (sailsCompleted - 50) * 1.5 + sailVariation % 8); // 191-215 HP
        const totalPower = Math.floor(68 + (sailsCompleted - 50) * 0.4 + sailVariation % 3); // 68-77 power
        const enemyCount = getRandomInt(2, 4);
        
        const enemies = Array.from({ length: enemyCount }, (_, i) => {
            const hp = Math.floor(totalHp / enemyCount) + (i === 0 ? totalHp % enemyCount : 0);
            const atk = Math.floor(totalPower / enemyCount) + (i === 0 ? totalPower % enemyCount : 0);
            const isBoss = i === 0;
            const hasSRank = sailsCompleted >= 55 && i === 0;
            const rank = hasSRank ? 'S' : 'A';
            
            return {
                name: hasSRank ? 'Navy Rear Admiral' : (isBoss ? 'Navy Brigadier' : `Navy Colonel ${i + 1}`),
                hp: hp,
                atk: [atk, atk + 8],
                spd: 50 + Math.floor((sailsCompleted - 50) * 1.0),
                rank: rank,
                currentHp: hp,
                maxHp: hp
            };
        });
        
        return {
            type: 'enemy',
            title: `Navy Division | Sail ${sailsCompleted}`,
            description: `${enemyCount} high-ranking Navy officials lead a formidable division.`,
            enemies: enemies,
            rewards: {
                beli: getRandomInt(80 + sailsCompleted * 6, 120 + sailsCompleted * 7),
                xp: getRandomInt(20 + Math.floor(sailsCompleted/3), 25 + Math.floor(sailsCompleted/2)),
                items: [getRandomItem('Rare')]
            }
        };
    } else if (sailsCompleted <= 70) {
        // Sails 61-70: ~80 power, ~220 HP, S ranks + S rank bosses
        const totalHp = Math.floor(210 + (sailsCompleted - 60) * 1.5 + sailVariation % 9); // 211-235 HP
        const totalPower = Math.floor(78 + (sailsCompleted - 60) * 0.4 + sailVariation % 3); // 78-87 power
        const enemyCount = getRandomInt(3, 4);
        
        const enemies = Array.from({ length: enemyCount }, (_, i) => {
            const hp = Math.floor(totalHp / enemyCount) + (i === 0 ? totalHp % enemyCount : 0);
            const atk = Math.floor(totalPower / enemyCount) + (i === 0 ? totalPower % enemyCount : 0);
            const isBoss = i === 0;
            
            return {
                name: isBoss ? 'Navy Vice Admiral' : `Navy Admiral ${i + 1}`,
                hp: hp,
                atk: [atk, atk + 9],
                spd: 55 + Math.floor((sailsCompleted - 60) * 1.1),
                rank: 'S',
                currentHp: hp,
                maxHp: hp
            };
        });
        
        return {
            type: 'enemy',
            title: `Navy Admiral Fleet | Sail ${sailsCompleted}`,
            description: `${enemyCount} Navy Admirals command an unstoppable fleet.`,
            enemies: enemies,
            rewards: {
                beli: getRandomInt(120 + sailsCompleted * 7, 160 + sailsCompleted * 8),
                xp: getRandomInt(25 + Math.floor(sailsCompleted/3), 30 + Math.floor(sailsCompleted/2)),
                items: [getRandomItem('Epic')]
            }
        };
    } else if (sailsCompleted <= 80) {
        // Sails 71-80: ~90 power, ~250 HP, S ranks + S rank bosses + UR ranks
        const totalHp = Math.floor(240 + (sailsCompleted - 70) * 1.5 + sailVariation % 10); // 241-265 HP
        const totalPower = Math.floor(88 + (sailsCompleted - 70) * 0.4 + sailVariation % 3); // 88-97 power
        const enemyCount = getRandomInt(3, 4);
        
        const enemies = Array.from({ length: enemyCount }, (_, i) => {
            const hp = Math.floor(totalHp / enemyCount) + (i === 0 ? totalHp % enemyCount : 0);
            const atk = Math.floor(totalPower / enemyCount) + (i === 0 ? totalPower % enemyCount : 0);
            const isBoss = i === 0;
            const hasURRank = sailsCompleted >= 75 && i === 0;
            const rank = hasURRank ? 'UR' : 'S';
            
            return {
                name: hasURRank ? 'Fleet Admiral' : (isBoss ? 'Navy Admiral Supreme' : `Navy Vice Admiral ${i + 1}`),
                hp: hp,
                atk: [atk, atk + 10],
                spd: 60 + Math.floor((sailsCompleted - 70) * 1.2),
                rank: rank,
                currentHp: hp,
                maxHp: hp
            };
        });
        
        return {
            type: 'enemy',
            title: `Elite Admiral Force | Sail ${sailsCompleted}`,
            description: `${enemyCount} legendary Navy leaders unite in battle.`,
            enemies: enemies,
            rewards: {
                beli: getRandomInt(160 + sailsCompleted * 8, 200 + sailsCompleted * 9),
                xp: getRandomInt(30 + Math.floor(sailsCompleted/3), 35 + Math.floor(sailsCompleted/2)),
                items: [getRandomItem('Epic')]
            }
        };
    } else if (sailsCompleted <= 90) {
        // Sails 81-90: ~100 power, ~280 HP, S rank bosses + UR ranks
        const totalHp = Math.floor(270 + (sailsCompleted - 80) * 1.5 + sailVariation % 11); // 271-295 HP
        const totalPower = Math.floor(98 + (sailsCompleted - 80) * 0.4 + sailVariation % 3); // 98-107 power
        const enemyCount = getRandomInt(3, 4);
        
        const enemies = Array.from({ length: enemyCount }, (_, i) => {
            const hp = Math.floor(totalHp / enemyCount) + (i === 0 ? totalHp % enemyCount : 0);
            const atk = Math.floor(totalPower / enemyCount) + (i === 0 ? totalPower % enemyCount : 0);
            const isBoss = i === 0;
            const rank = isBoss ? 'UR' : (Math.random() < 0.5 ? 'UR' : 'S');
            
            return {
                name: rank === 'UR' ? (isBoss ? 'World Government Admiral' : `Fleet Admiral ${i + 1}`) : `Navy Admiral Supreme ${i + 1}`,
                hp: hp,
                atk: [atk, atk + 11],
                spd: 65 + Math.floor((sailsCompleted - 80) * 1.3),
                rank: rank,
                currentHp: hp,
                maxHp: hp
            };
        });
        
        return {
            type: 'enemy',
            title: `Legendary Naval Force | Sail ${sailsCompleted}`,
            description: `${enemyCount} legendary warriors represent the pinnacle of Naval power.`,
            enemies: enemies,
            rewards: {
                beli: getRandomInt(200 + sailsCompleted * 9, 250 + sailsCompleted * 10),
                xp: getRandomInt(35 + Math.floor(sailsCompleted/3), 40 + Math.floor(sailsCompleted/2)),
                items: [getRandomItem('Legendary')]
            }
        };
    } else if (sailsCompleted <= 100) {
        // Sails 91-100: ~120 power, ~300 HP, UR ranks + UR rank bosses
        const totalHp = Math.floor(290 + (sailsCompleted - 90) * 1.5 + sailVariation % 12); // 291-315 HP
        const totalPower = Math.floor(118 + (sailsCompleted - 90) * 0.4 + sailVariation % 3); // 118-127 power
        const enemyCount = getRandomInt(3, 5);
        
        const enemies = Array.from({ length: enemyCount }, (_, i) => {
            const hp = Math.floor(totalHp / enemyCount) + (i === 0 ? totalHp % enemyCount : 0);
            const atk = Math.floor(totalPower / enemyCount) + (i === 0 ? totalPower % enemyCount : 0);
            const isBoss = i === 0;
            
            return {
                name: isBoss ? 'Supreme Fleet Admiral' : `World Government Admiral ${i + 1}`,
                hp: hp,
                atk: [atk, atk + 12],
                spd: 70 + Math.floor((sailsCompleted - 90) * 1.4),
                rank: 'UR',
                currentHp: hp,
                maxHp: hp
            };
        });
        
        return {
            type: 'enemy',
            title: `Supreme Naval Command | Sail ${sailsCompleted}`,
            description: `${enemyCount} supreme commanders of the World Government Navy.`,
            enemies: enemies,
            rewards: {
                beli: getRandomInt(250 + sailsCompleted * 10, 300 + sailsCompleted * 12),
                xp: getRandomInt(40 + Math.floor(sailsCompleted/3), 45 + Math.floor(sailsCompleted/2)),
                items: [getRandomItem('Legendary')]
            }
        };
    } else {
        // Sails 100+: 120+ power, 300+ HP, ALL UR rank bosses
        const totalHp = Math.floor(300 + (sailsCompleted - 100) * 2 + sailVariation % 15); // 300+ HP, scaling
        const totalPower = Math.floor(120 + (sailsCompleted - 100) * 0.5 + sailVariation % 5); // 120+ power, scaling
        const enemyCount = getRandomInt(4, 5);
        
        const enemies = Array.from({ length: enemyCount }, (_, i) => {
            const hp = Math.floor(totalHp / enemyCount) + (i === 0 ? totalHp % enemyCount : 0);
            const atk = Math.floor(totalPower / enemyCount) + (i === 0 ? totalPower % enemyCount : 0);
            const isBoss = i === 0;
            
            return {
                name: isBoss ? 'Absolute Fleet Admiral' : `Divine Admiral ${i + 1}`,
                hp: hp,
                atk: [atk, atk + 15],
                spd: 75 + Math.floor((sailsCompleted - 100) * 1.5),
                rank: 'UR',
                currentHp: hp,
                maxHp: hp
            };
        });
        
        return {
            type: 'enemy',
            title: `Divine Naval Authority | Sail ${sailsCompleted}`,
            description: `${enemyCount} divine admirals wielding absolute power over the seas.`,
            enemies: enemies,
            rewards: {
                beli: getRandomInt(300 + sailsCompleted * 12, 400 + sailsCompleted * 15),
                xp: getRandomInt(45 + Math.floor(sailsCompleted/3), 50 + Math.floor(sailsCompleted/2)),
                items: [getRandomItem('Legendary')]
            }
        };
    }
}

function canUseItem(user, itemName) {
    if (!user.inventory || !user.inventory.length) return false;
    const normalized = itemName.toLowerCase().replace(/\s+/g, '');
    return user.inventory.some(item => item.toLowerCase().replace(/\s+/g, '') === normalized);
}

function useItem(user, itemName) {
    if (!canUseItem(user, itemName)) return null;
    
    const normalized = itemName.toLowerCase().replace(/\s+/g, '');
    const itemIndex = user.inventory.findIndex(item => 
        item.toLowerCase().replace(/\s+/g, '') === normalized
    );
    
    if (itemIndex === -1) return null;
    
    // Remove item from inventory
    user.inventory.splice(itemIndex, 1);
    
    // Return item effects
    const effects = {
        'basicpotion': { type: 'heal', percent: 10, name: 'Basic Potion' },
        'normalpotion': { type: 'heal', percent: 20, name: 'Normal Potion' },
        'maxpotion': { type: 'heal', percent: 30, name: 'Max Potion' }
    };
    
    return effects[normalized] || null;
}

async function execute(message, args, client) {
    const userId = message.author.id;
    let user = await User.findOne({ userId });
    
    if (!user) {
        return message.reply('Start your pirate journey with `op start` first!');
    }
    
    // Parse arc name from arguments
    let arcName = 'East Blue'; // Default arc
    if (args.length > 0) {
        const inputArc = args.join(' ').toLowerCase();
        if (AVAILABLE_ARCS[inputArc]) {
            arcName = AVAILABLE_ARCS[inputArc];
        } else {
            return message.reply(`Unknown arc "${args.join(' ')}". Available arcs: ${Object.values(AVAILABLE_ARCS).join(', ')}`);
        }
    }
    
    // Check unlock requirements
    const requiredStage = SAGA_UNLOCK_REQUIREMENTS[arcName];
    if (requiredStage && (!user.stage || user.stage < requiredStage)) {
        return message.reply(`You must complete stage ${requiredStage} to unlock sailing in ${arcName}!`);
    }
    
    // Check if user has completed the saga
    if (!user.completedSagas || !user.completedSagas.includes(arcName)) {
        if (user.stage >= requiredStage) {
            // Auto-complete the saga if they've reached the required stage
            if (!user.completedSagas) user.completedSagas = [];
            user.completedSagas.push(arcName);
            user.markModified('completedSagas');
            await saveUserWithRetry(user);
        } else {
            return message.reply(`You must complete the ${arcName} saga to unlock infinite sailing!`);
        }
    }
    
    // Validate team
    if (!user.team || user.team.length === 0) {
        return message.reply('You need to set up your team first! Use `op team add <card>` to add cards.');
    }
    
    if (!user.cards || user.cards.length === 0) {
        return message.reply('You don\'t have any cards! Pull some cards first with `op pull`.');
    }
    
    // Calculate battle stats
    const battleTeam = calculateBattleStats(user);
    if (!battleTeam || battleTeam.length === 0) {
        return message.reply('Your team is invalid. Please check your team with `op team` and fix any issues.');
    }
    
    // Ensure all team members have proper HP
    battleTeam.forEach(card => {
        if (!card.currentHp || card.currentHp <= 0) {
            card.currentHp = card.hp || card.maxHp || 100;
        }
        if (!card.maxHp) {
            card.maxHp = card.hp || 100;
        }
    });
    
    // Check if team has any health
    if (battleTeam.every(card => card.currentHp <= 0)) {
        return message.reply('Your team has no health! Rest or heal your cards before sailing.');
    }
    
    // Initialize sailing progress
    if (!user.sailsCompleted) {
        user.sailsCompleted = {};
        user.markModified('sailsCompleted');
    }
    if (!user.sailsCompleted[arcName]) {
        user.sailsCompleted[arcName] = 0;
        user.markModified('sailsCompleted');
    }
    
    const currentSails = user.sailsCompleted[arcName];
    
    // Generate sailing event
    const nextSailNumber = currentSails + 1;
    console.log(`🚀 Starting sail #${nextSailNumber} for ${arcName} (completed: ${currentSails})`);
    const event = generateSailEvent(arcName, nextSailNumber);
    console.log(`📋 Generated event: ${event.title} with enemy: ${event.enemies[0].name}`);
    
    // Start battle
    await startSailBattle(message, user, battleTeam, event, arcName, client);
}

async function startSailBattle(message, user, battleTeam, event, arcName, client) {
    // Create battle embed
    const embed = new EmbedBuilder()
        .setTitle(event.title)
        .setDescription(event.description)
        .setColor(0x1E40AF)
        .addFields(
            {
                name: 'Your Crew',
                value: createProfessionalTeamDisplay(battleTeam, message.author.username),
                inline: false
            },
            {
                name: 'Enemies',
                value: createEnemyDisplay(event.enemies),
                inline: false
            },
            {
                name: 'Battle Log',
                value: 'Battle begins!',
                inline: false
            }
        )
        .setFooter({ text: `Sailing in ${arcName} | Sail #${((user.sailsCompleted && user.sailsCompleted[arcName]) || 0) + 1}` });
    
    // Create action buttons
    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('sail_attack')
                .setLabel('Attack')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('sail_items')
                .setLabel('Items')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('sail_flee')
                .setLabel('Flee')
                .setStyle(ButtonStyle.Secondary)
        );
    
    const battleMessage = await message.reply({
        embeds: [embed],
        components: [actionRow]
    });
    
    // Battle state
    const battleState = {
        userTeam: battleTeam,
        enemies: event.enemies,
        battleLog: ['Battle begins!'],
        event: event,
        arcName: arcName,
        collector: null // Store collector reference for cleanup
    };
    
    // Create collector for button interactions
    const collector = battleMessage.createMessageComponentCollector({
        filter: i => i.user.id === message.author.id && (i.customId.startsWith('sail_') && !i.customId.startsWith('sail_continue') && !i.customId.startsWith('sail_stop')),
        time: 300000 // 5 minutes
    });
    
    battleState.collector = collector; // Store reference
    
    collector.on('collect', async (interaction) => {
        await handleBattleAction(interaction, battleMessage, user, battleState, client);
    });
    
    collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            const timeoutEmbed = EmbedBuilder.from(embed)
                .setColor(0x95a5a6)
                .setDescription('Battle timed out. You fled from the encounter.');
            
            await battleMessage.edit({
                embeds: [timeoutEmbed],
                components: []
            });
        }
    });
}

async function handleBattleAction(interaction, battleMessage, user, battleState, client) {
    await interaction.deferUpdate();
    
    // Refresh user data
    const freshUser = await User.findOne({ userId: user.userId });
    if (!freshUser) return;
    
    if (interaction.customId === 'sail_attack') {
        await handleAttack(interaction, battleMessage, freshUser, battleState);
    } else if (interaction.customId === 'sail_items') {
        await handleItems(interaction, battleMessage, freshUser, battleState);
    } else if (interaction.customId === 'sail_flee') {
        await handleFlee(interaction, battleMessage, freshUser, battleState);
    } else if (interaction.customId === 'sail_back_to_battle') {
        await updateBattleDisplay(battleMessage, battleState);
    } else if (interaction.customId.startsWith('sail_use_')) {
        const itemName = interaction.customId.replace('sail_use_', '');
        
        // Convert item name back to readable format
        const itemMap = {
            'basicpotion': 'Basic Potion',
            'normalpotion': 'Normal Potion',
            'maxpotion': 'Max Potion'
        };
        
        const fullItemName = itemMap[itemName] || itemName;
        const effect = useItem(freshUser, fullItemName);
        
        if (effect && effect.type === 'heal') {
            const injuredCard = battleState.userTeam.find(card => 
                card.currentHp > 0 && card.currentHp < card.maxHp
            );
            
            if (injuredCard) {
                const healAmount = Math.floor(injuredCard.maxHp * (effect.percent / 100));
                const actualHeal = Math.min(healAmount, injuredCard.maxHp - injuredCard.currentHp);
                injuredCard.currentHp += actualHeal;
                
                battleState.battleLog.push(`Used ${effect.name}! ${injuredCard.name} healed for ${actualHeal} HP!`);
                await saveUserWithRetry(freshUser);
            } else {
                battleState.battleLog.push('No injured crew members to heal!');
            }
        } else {
            battleState.battleLog.push('Failed to use item!');
        }
        
        await updateBattleDisplay(battleMessage, battleState);
    }
}

async function handleAttack(interaction, battleMessage, user, battleState) {
    // Player's turn
    const attacker = battleState.userTeam.find(card => card.currentHp > 0);
    const target = battleState.enemies.find(enemy => enemy.currentHp > 0);
    
    if (!attacker || !target) return;
    
    const damage = calculateDamage(attacker, target);
    target.currentHp = Math.max(0, target.currentHp - damage);
    
    battleState.battleLog.push(`${attacker.name} attacks ${target.name} for ${damage} damage!`);
    
    if (target.currentHp <= 0) {
        battleState.battleLog.push(`${target.name} is defeated!`);
    }
    
    // Check for victory
    if (battleState.enemies.every(enemy => enemy.currentHp <= 0)) {
        await handleVictory(interaction, battleMessage, user, battleState);
        return;
    }
    
    // Enemy turn
    for (const enemy of battleState.enemies.filter(e => e.currentHp > 0)) {
        const playerTarget = battleState.userTeam.find(card => card.currentHp > 0);
        if (!playerTarget) break;
        
        const enemyDamage = calculateDamage(enemy, playerTarget);
        playerTarget.currentHp = Math.max(0, playerTarget.currentHp - enemyDamage);
        
        battleState.battleLog.push(`${enemy.name} attacks ${playerTarget.name} for ${enemyDamage} damage!`);
        
        if (playerTarget.currentHp <= 0) {
            battleState.battleLog.push(`${playerTarget.name} is knocked out!`);
        }
    }
    
    // Check for defeat
    if (battleState.userTeam.every(card => card.currentHp <= 0)) {
        await handleDefeat(interaction, battleMessage, user, battleState);
        return;
    }
    
    // Update battle display
    await updateBattleDisplay(battleMessage, battleState);
}

async function handleItems(interaction, battleMessage, user, battleState) {
    const usableItems = ['Basic Potion', 'Normal Potion', 'Max Potion'];
    const availableItems = usableItems.filter(item => canUseItem(user, item));
    
    if (availableItems.length === 0) {
        battleState.battleLog.push('No usable healing items available!');
        await updateBattleDisplay(battleMessage, battleState);
        return;
    }
    
    // Create item selection buttons
    const itemButtons = availableItems.map(item => 
        new ButtonBuilder()
            .setCustomId(`sail_use_${item.toLowerCase().replace(/\s+/g, '')}`)
            .setLabel(item)
            .setStyle(ButtonStyle.Success)
    );
    
    itemButtons.push(
        new ButtonBuilder()
            .setCustomId('sail_back_to_battle')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
    );
    
    const itemRow = new ActionRowBuilder().addComponents(itemButtons.slice(0, 5));
    
    await battleMessage.edit({ components: [itemRow] });
}

async function handleFlee(interaction, battleMessage, user, battleState) {
    // Stop the battle collector
    if (battleState.collector && !battleState.collector.ended) {
        battleState.collector.stop('flee');
    }
    
    const fleeEmbed = new EmbedBuilder()
        .setTitle('Fled from Battle')
        .setDescription('You successfully escaped from the encounter.')
        .setColor(0x95a5a6)
        .setFooter({ text: `Sailing in ${battleState.arcName}` });
    
    await battleMessage.edit({
        embeds: [fleeEmbed],
        components: []
    });
}

async function handleVictory(interaction, battleMessage, user, battleState) {
    const rewards = battleState.event.rewards;
    
    // Stop the old battle collector to prevent conflicts
    if (battleState.collector && !battleState.collector.ended) {
        battleState.collector.stop('victory');
    }
    
    // Award rewards
    user.beli = (user.beli || 0) + rewards.beli;
    
    // Award XP to both user and team
    const xpBoost = user.activeBoosts?.find(boost => 
        boost.type === 'double_xp' && boost.expiresAt > Date.now()
    );
    const finalXP = xpBoost ? rewards.xp * 2 : rewards.xp;

    // Award XP to user with new leveling system
    const { awardUserXP } = require('../utils/userLevelSystem.js');
    const userLevelResult = awardUserXP(user, finalXP);

    // Store user level up information for display
    if (userLevelResult.leveledUp) {
        if (!user.recentUserLevelUps) user.recentUserLevelUps = [];
        user.recentUserLevelUps.push(userLevelResult);
    }

    // Award XP to team
    distributeXPToTeam(user, finalXP);
    
    // Award items
    if (rewards.items && rewards.items.length > 0) {
        if (!user.inventory) user.inventory = [];
        rewards.items.forEach(item => user.inventory.push(item));
    }
    
    // Check for additional item rewards from reward system
    let bonusItemReward = null;
    try {
        const { getSailingReward, addItemToInventory } = require('../utils/rewardSystem.js');
        bonusItemReward = getSailingReward(battleState.arcName);
        if (bonusItemReward) {
            addItemToInventory(user, bonusItemReward);
        }
    } catch (error) {
        // Item rewards are optional
        console.log('Reward system not available');
    }
    
    // Award bounty for defeating enemies based on their rank
    let totalBounty = 0;
    battleState.enemies.forEach(enemy => {
        if (enemy.rank) {
            const bountyReward = getBountyForRank(enemy.rank);
            if (bountyReward > 0) {
                totalBounty += bountyReward;
            }
        }
    });
    
    if (totalBounty > 0) {
        user.bounty = (user.bounty || 0) + totalBounty;
    }
    
    // Initialize sailing progress if needed
    if (!user.sailsCompleted) user.sailsCompleted = {};
    if (!user.sailsCompleted[battleState.arcName]) user.sailsCompleted[battleState.arcName] = 0;
    
    // Increment sail count
    const oldCount = user.sailsCompleted[battleState.arcName];
    user.sailsCompleted[battleState.arcName] = user.sailsCompleted[battleState.arcName] + 1;
    const newCount = user.sailsCompleted[battleState.arcName];
    console.log(`Sail completed! ${battleState.arcName}: ${oldCount} → ${newCount}`);
    
    // Mark the field as modified so Mongoose saves it
    user.markModified('sailsCompleted');
    
    try {
        await saveUserWithRetry(user);
        console.log(`Successfully saved sail count ${newCount} for ${battleState.arcName}`);
    } catch (error) {
        console.error(`Failed to save sail count:`, error);
    }
    
    // Create victory embed with progression indicators
    let rewardText = `**${rewards.beli} Beli**\n**${rewards.xp} XP**`;
    if (rewards.items && rewards.items.length > 0) {
        rewardText += `\n**${rewards.items.join(', ')}**`;
    }
    if (totalBounty > 0) {
        rewardText += `\n**+${totalBounty.toLocaleString()} Bounty**`;
    }
    
    // Add bonus item reward from reward system
    if (bonusItemReward) {
        try {
            const { formatItemReward } = require('../utils/rewardSystem.js');
            rewardText += `\n${formatItemReward(bonusItemReward)}`;
        } catch (error) {
            // Fallback format
            rewardText += `\n**${bonusItemReward.name}** obtained!`;
        }
    }
    
    const currentSailCount = user.sailsCompleted[battleState.arcName] || 0;
    const nextSailCount = currentSailCount + 1;
    
    // Generate preview of next encounter for progression teaser
    let progressionHint = '';
    if (nextSailCount <= 5) {
        progressionHint = '**Next**: Navy Patrol (Tutorial)';
    } else if (nextSailCount <= 10) {
        progressionHint = '**Next**: Navy Officer Patrol';
    } else if (nextSailCount <= 20) {
        progressionHint = '**Next**: Navy Squad (Multiple enemies)';
    } else if (nextSailCount <= 50) {
        progressionHint = '**Next**: Navy Blockade (Strong forces)';
    } else {
        progressionHint = '**Next**: Elite Navy Fleet (Legendary encounters)';
    }
    
    const victoryEmbed = new EmbedBuilder()
        .setTitle('Victory!')
        .setDescription('All enemies have been defeated!')
        .addFields(
            {
                name: 'Rewards',
                value: rewardText,
                inline: false
            },
            {
                name: 'Sailing Progress',
                value: `**Completed**: Sail #${currentSailCount} in ${battleState.arcName}\n${progressionHint}`,
                inline: false
            }
        )
        .setColor(0x2ecc71)
        .setFooter({ text: `Each sail gets progressively harder with better rewards!` });
    
    // Create continue sailing buttons
    const continueRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('sail_continue')
                .setLabel('Continue Sailing')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('sail_stop')
                .setLabel('Return to Port')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await battleMessage.edit({
        embeds: [victoryEmbed],
        components: [continueRow]
    });
    
    // Set up collector for continue/stop buttons only
    const continueCollector = battleMessage.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && (i.customId === 'sail_continue' || i.customId === 'sail_stop'),
        time: 300000 // 5 minutes
    });
    
    continueCollector.on('collect', async (continueInteraction) => {
        try {
            if (continueInteraction.customId === 'sail_continue') {
                await continueInteraction.deferUpdate();
                
                // Stop this collector before starting new battle
                continueCollector.stop('continue');
                
                // Refresh user data and start new sailing encounter
                const freshUser = await User.findOne({ userId: user.userId });
                if (!freshUser) {
                    await continueInteraction.followUp({ content: 'User data not found!', ephemeral: true });
                    return;
                }
                
                // Debug fresh user sail count
                const freshSailCount = (freshUser.sailsCompleted && freshUser.sailsCompleted[battleState.arcName]) || 0;
                console.log(`Refreshed user data: ${battleState.arcName} sail count = ${freshSailCount}`);
                
                // Heal team slightly between battles (like explore does)
                const battleTeam = calculateBattleStats(freshUser);
                battleTeam.forEach(card => {
                    // Ensure maxHp is set
                    if (!card.maxHp) {
                        card.maxHp = card.hp || 100;
                    }
                    // Ensure currentHp is set
                    if (!card.currentHp) {
                        card.currentHp = card.maxHp;
                    }
                    
                    const healAmount = Math.floor(card.maxHp * 0.1); // Heal 10% between battles
                    card.currentHp = Math.min(card.maxHp, card.currentHp + healAmount);
                });
                
                // Check if team is still viable
                if (battleTeam.every(card => card.currentHp <= 0)) {
                    const healEmbed = new EmbedBuilder()
                        .setTitle('Team Defeated!')
                        .setDescription('Your crew has no health remaining! Rest and heal before continuing to sail.')
                        .setColor(0xe74c3c);
                    
                    await battleMessage.edit({
                        embeds: [healEmbed],
                        components: []
                    });
                    return;
                }
                
                // Initialize sailing progress if needed
                if (!freshUser.sailsCompleted) freshUser.sailsCompleted = {};
                if (!freshUser.sailsCompleted[battleState.arcName]) freshUser.sailsCompleted[battleState.arcName] = 0;
                
                // Generate new sailing event
                const newSailCount = freshUser.sailsCompleted[battleState.arcName];
                const nextSailNumber = newSailCount + 1;
                console.log(`Continue Sailing: Generating sail #${nextSailNumber} for ${battleState.arcName} (completed: ${newSailCount})`);
                const newEvent = generateSailEvent(battleState.arcName, nextSailNumber);
                console.log(`Continue event: ${newEvent.title} with enemy: ${newEvent.enemies[0].name}`);
                
                // Start new battle
                await startNewSailBattle(battleMessage, freshUser, battleTeam, newEvent, battleState.arcName, interaction.user.id);
                
            } else if (continueInteraction.customId === 'sail_stop') {
                await continueInteraction.deferUpdate();
                
                // Stop this collector
                continueCollector.stop('stop');
                
                const stopEmbed = new EmbedBuilder()
                    .setTitle('Returned to Port')
                    .setDescription('You return to port with your treasures. The seas await your next adventure!')
                    .setColor(0x95a5a6)
                    .setFooter({ text: `Use 'op sail ${battleState.arcName.toLowerCase()}' to sail again anytime!` });
                
                await battleMessage.edit({
                    embeds: [stopEmbed],
                    components: []
                });
            }
        } catch (error) {
            console.error('Error in continue collector:', error);
            // If there's an error, stop the collector to prevent further issues
            if (!continueCollector.ended) {
                continueCollector.stop('error');
            }
        }
    });
    
    continueCollector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            const timeoutEmbed = new EmbedBuilder()
                .setTitle('Sailing Session Ended')
                .setDescription('Your sailing session has timed out. You return to port with your rewards.')
                .setColor(0x95a5a6);
            
            try {
                await battleMessage.edit({
                    embeds: [timeoutEmbed],
                    components: []
                });
            } catch (error) {
                console.error('Error updating message on timeout:', error);
            }
        }
    });
}

async function handleDefeat(interaction, battleMessage, user, battleState) {
    // Stop the battle collector
    if (battleState.collector && !battleState.collector.ended) {
        battleState.collector.stop('defeat');
    }
    
    const defeatEmbed = new EmbedBuilder()
        .setTitle('Defeat!')
        .setDescription('Your crew has been defeated! Rest and try again.')
        .setColor(0xe74c3c)
        .setFooter({ text: `Sailing in ${battleState.arcName}` });
    
    await battleMessage.edit({
        embeds: [defeatEmbed],
        components: []
    });
}

async function startNewSailBattle(battleMessage, user, battleTeam, event, arcName, userId) {
    // Create battle embed
    const embed = new EmbedBuilder()
        .setTitle(event.title)
        .setDescription(event.description)
        .setColor(0x1E40AF)
        .addFields(
            {
                name: 'Your Crew',
                value: createProfessionalTeamDisplay(battleTeam, user.username || 'Captain'),
                inline: false
            },
            {
                name: 'Enemies',
                value: createEnemyDisplay(event.enemies),
                inline: false
            },
            {
                name: 'Battle Log',
                value: 'A new encounter begins!',
                inline: false
            }
        )
        .setFooter({ text: `Sailing in ${arcName} | Sail #${((user.sailsCompleted && user.sailsCompleted[arcName]) || 0) + 1}` });
    
    // Create action buttons
    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('sail_attack')
                .setLabel('Attack')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('sail_items')
                .setLabel('Items')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('sail_flee')
                .setLabel('Flee')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await battleMessage.edit({
        embeds: [embed],
        components: [actionRow]
    });
    
    // Battle state
    const battleState = {
        userTeam: battleTeam,
        enemies: event.enemies,
        battleLog: ['A new encounter begins!'],
        event: event,
        arcName: arcName,
        collector: null // Store collector reference for cleanup
    };
    
    // Create collector for button interactions with proper filter
    const collector = battleMessage.createMessageComponentCollector({
        filter: i => i.user.id === userId && (i.customId.startsWith('sail_') && !i.customId.startsWith('sail_continue') && !i.customId.startsWith('sail_stop')),
        time: 300000 // 5 minutes
    });
    
    battleState.collector = collector; // Store reference
    
    collector.on('collect', async (interaction) => {
        try {
            await handleBattleAction(interaction, battleMessage, user, battleState, null);
        } catch (error) {
            console.error('Error in battle action:', error);
        }
    });
    
    collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            const timeoutEmbed = EmbedBuilder.from(embed)
                .setColor(0x95a5a6)
                .setDescription('Battle timed out. You fled from the encounter.');
            
            try {
                await battleMessage.edit({
                    embeds: [timeoutEmbed],
                    components: []
                });
            } catch (error) {
                console.error('Error updating message on timeout:', error);
            }
        }
    });
}

async function updateBattleDisplay(battleMessage, battleState) {
    const embed = new EmbedBuilder()
        .setTitle(battleState.event.title)
        .setDescription(battleState.event.description)
        .setColor(0x1E40AF)
        .addFields(
            {
                name: 'Your Crew',
                value: createProfessionalTeamDisplay(battleState.userTeam, 'Captain'),
                inline: false
            },
            {
                name: 'Enemies',
                value: createEnemyDisplay(battleState.enemies),
                inline: false
            },
            {
                name: 'Battle Log',
                value: createBattleLogDisplay(battleState.battleLog.slice(-3)),
                inline: false
            }
        )
        .setFooter({ text: `Sailing in ${battleState.arcName}` });
    
    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('sail_attack')
                .setLabel('Attack')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('sail_items')
                .setLabel('Items')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('sail_flee')
                .setLabel('Flee')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await battleMessage.edit({
        embeds: [embed],
        components: [actionRow]
    });
}

module.exports = { data, execute };