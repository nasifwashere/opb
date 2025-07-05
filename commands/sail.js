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
    // Base scaling: Each sail adds a small amount to enemy stats
    const baseHpScale = Math.floor(sailsCompleted * 1.5); // +1.5 HP per sail on average
    const baseAtkScale = Math.floor(sailsCompleted * 0.3); // +0.3 ATK per sail on average
    const baseSpdScale = Math.floor(sailsCompleted * 0.2); // +0.2 SPD per sail on average
    
    if (sailsCompleted <= 5) {
        // Sails 1-5: Basic Navy Soldier with progressive scaling
        const baseHp = 25 + baseHpScale; // Start at 25, grow to ~32
        const baseAtk = 6 + baseAtkScale; // Start at 6, grow to ~7
        const baseSpd = 25 + baseSpdScale; // Start at 25, grow to ~26
        
        return {
            type: 'enemy',
            title: `Navy Patrol | Sail ${sailsCompleted}`,
            description: sailsCompleted <= 2 ? 'A rookie Navy Soldier patrols the calm waters.' : 'An experienced Navy Soldier guards these waters.',
            enemies: [{
                name: sailsCompleted <= 2 ? 'Rookie Navy Soldier' : 'Navy Soldier',
                hp: baseHp,
                atk: [baseAtk, baseAtk + 4],
                spd: baseSpd,
                rank: 'C',
                currentHp: baseHp,
                maxHp: baseHp
            }],
            rewards: {
                beli: getRandomInt(3 + sailsCompleted, 8 + sailsCompleted),
                xp: getRandomInt(1 + Math.floor(sailsCompleted/2), 3 + Math.floor(sailsCompleted/2)),
                items: []
            }
        };
    } else if (sailsCompleted <= 10) {
        // Sails 6-10: Navy Officers with progressive scaling
        const baseHp = 40 + baseHpScale; // Start at ~48, grow to ~55
        const baseAtk = 8 + baseAtkScale; // Start at ~9, grow to ~11
        const baseSpd = 30 + baseSpdScale; // Start at ~31, grow to ~32
        
        // Occasionally add a second weaker enemy for variety
        const hasSecondEnemy = sailsCompleted >= 8 && Math.random() < 0.3;
        const enemies = [{
            name: sailsCompleted <= 7 ? 'Navy Officer' : 'Navy Lieutenant',
            hp: baseHp,
            atk: [baseAtk, baseAtk + 6],
            spd: baseSpd,
            rank: 'C',
            currentHp: baseHp,
            maxHp: baseHp
        }];
        
        if (hasSecondEnemy) {
            const secondEnemyHp = Math.floor(baseHp * 0.6);
            enemies.push({
                name: 'Navy Recruit',
                hp: secondEnemyHp,
                atk: [Math.floor(baseAtk * 0.7), Math.floor(baseAtk * 0.7) + 3],
                spd: Math.floor(baseSpd * 0.8),
                rank: 'C',
                currentHp: secondEnemyHp,
                maxHp: secondEnemyHp
            });
        }
        
        return {
            type: 'enemy',
            title: `Navy Officer Patrol | Sail ${sailsCompleted}`,
            description: hasSecondEnemy ? 'A Navy Officer leads a small patrol squad.' : 'A stronger Navy Officer blocks your path.',
            enemies: enemies,
            rewards: {
                beli: getRandomInt(8 + sailsCompleted * 2, 15 + sailsCompleted * 3),
                xp: getRandomInt(4 + Math.floor(sailsCompleted/2), 8 + Math.floor(sailsCompleted/2)),
                items: sailsCompleted >= 9 ? [getRandomItem('Common')] : []
            }
        };
    } else if (sailsCompleted <= 20) {
        // Sails 11-20: Navy Squad with progressive scaling and variety
        const enemyCount = sailsCompleted <= 12 ? 1 : (sailsCompleted <= 16 ? getRandomInt(1, 2) : getRandomInt(2, 3));
        const baseHp = 60 + baseHpScale; // Start at ~75, grow to ~90
        const baseAtk = 10 + baseAtkScale; // Start at ~13, grow to ~16
        const baseSpd = 35 + baseSpdScale; // Start at ~37, grow to ~39
        
                 // Adjust for multiple enemies to equal single enemy total power
         const adjustedHp = enemyCount > 1 ? Math.floor(baseHp / enemyCount) : baseHp;
         const adjustedAtk = enemyCount > 1 ? Math.floor(baseAtk / enemyCount) : baseAtk;
         const adjustedSpd = enemyCount > 1 ? Math.floor(baseSpd / enemyCount) : baseSpd;
        
        const enemyTypes = ['Navy Soldier', 'Navy Gunner', 'Navy Swordsman'];
        const enemies = Array.from({ length: enemyCount }, (_, i) => {
            const enemyType = enemyTypes[i % enemyTypes.length];
            const isLeader = i === 0 && enemyCount > 1;
            const hp = isLeader ? Math.floor(adjustedHp * 1.2) : adjustedHp + getRandomInt(-3, 3);
            
            return {
                name: isLeader ? 'Navy Squad Leader' : (enemyCount > 1 ? `${enemyType} ${i + 1}` : enemyType),
                hp: hp,
                atk: [adjustedAtk, adjustedAtk + 6],
                spd: adjustedSpd,
                rank: isLeader ? 'B' : 'C',
                currentHp: hp,
                maxHp: hp
            };
        });
        
        return {
            type: 'enemy',
            title: `Navy Squad | Sail ${sailsCompleted}`,
            description: enemyCount === 1 ? 'A seasoned Navy soldier stands guard.' : `${enemyCount} Navy soldiers intercept your ship.`,
            enemies: enemies,
            rewards: {
                beli: getRandomInt(25 + sailsCompleted * 3, 50 + sailsCompleted * 4),
                xp: getRandomInt(8 + Math.floor(sailsCompleted/2), 12 + Math.floor(sailsCompleted/2)),
                items: sailsCompleted >= 15 ? [getRandomItem('Common')] : []
            }
        };
    } else if (sailsCompleted <= 50) {
        // Sails 21-50: Navy Forces with consistent progressive scaling
        const enemyCount = getRandomInt(2, 3);
        const baseHp = 80 + sailsCompleted * 2; // Linear scaling: 122 HP at sail 21, 180 HP at sail 50
        const baseAtk = 12 + Math.floor(sailsCompleted * 0.4); // 20 ATK at sail 21, 32 ATK at sail 50
        const baseSpd = 40 + Math.floor(sailsCompleted * 0.3); // 46 SPD at sail 21, 55 SPD at sail 50
        
        // Balance multiple enemies to equal single enemy total power
        const adjustedHp = Math.floor(baseHp / enemyCount);
        const adjustedAtk = Math.floor(baseAtk / enemyCount);
        const adjustedSpd = Math.floor(baseSpd / enemyCount);
        
        const enemyTypes = ['Navy Enforcer', 'Navy Captain', 'Navy Elite', 'Navy Specialist'];
        const enemies = Array.from({ length: enemyCount }, (_, i) => {
            const enemyType = enemyTypes[i % enemyTypes.length];
            const isCommander = i === 0;
            const hp = isCommander ? Math.floor(adjustedHp * 1.3) : adjustedHp + getRandomInt(-5, 5);
            
            return {
                name: isCommander ? 'Navy Commander' : `${enemyType} ${i + 1}`,
                hp: hp,
                atk: [adjustedAtk, adjustedAtk + 8],
                spd: adjustedSpd + (isCommander ? 5 : 0),
                rank: isCommander ? 'A' : 'B',
                currentHp: hp,
                maxHp: hp
            };
        });
        
        return {
            type: 'enemy',
            title: `Navy Blockade | Sail ${sailsCompleted}`,
            description: `${enemyCount} Navy ships form a formidable blockade.`,
            enemies: enemies,
            rewards: {
                beli: getRandomInt(60 + sailsCompleted * 4, 120 + sailsCompleted * 6),
                xp: getRandomInt(12 + Math.floor(sailsCompleted/3), 18 + Math.floor(sailsCompleted/3)),
                items: [getRandomItem(sailsCompleted < 35 ? 'Uncommon' : 'Rare')]
            }
        };
    } else {
        // Sails 51+: Elite Navy with continuous scaling
        const enemyCount = getRandomInt(3, 4);
        const baseHp = 200 + (sailsCompleted - 50) * 3; // Continues scaling beyond sail 50
        const baseAtk = 25 + Math.floor((sailsCompleted - 50) * 0.5);
        const baseSpd = 55 + Math.floor((sailsCompleted - 50) * 0.2);
        const itemRarity = sailsCompleted < 75 ? 'Rare' : (sailsCompleted < 100 ? 'Epic' : 'Legendary');
        
        // Balance multiple enemies to equal single enemy total power
        const adjustedHp = Math.floor(baseHp / enemyCount);
        const adjustedAtk = Math.floor(baseAtk / enemyCount);
        const adjustedSpd = Math.floor(baseSpd / enemyCount);
        
        const eliteTypes = ['Navy Admiral', 'Navy Vice Admiral', 'Navy Commodore', 'Elite Marine'];
        const enemies = Array.from({ length: enemyCount }, (_, i) => {
            const enemyType = eliteTypes[i % eliteTypes.length];
            const isAdmiral = i === 0;
            const hp = isAdmiral ? Math.floor(adjustedHp * 1.4) : adjustedHp + getRandomInt(-8, 8);
            
            return {
                name: isAdmiral ? 'Fleet Admiral' : `${enemyType} ${i}`,
                hp: hp,
                atk: [adjustedAtk, adjustedAtk + 10],
                spd: adjustedSpd + (isAdmiral ? 8 : 0),
                rank: isAdmiral ? 'S' : 'A',
                currentHp: hp,
                maxHp: hp
            };
        });
        
        return {
            type: 'enemy',
            title: `Elite Navy Fleet | Sail ${sailsCompleted}`,
            description: `${enemyCount} elite Navy warships engage in an epic battle.`,
            enemies: enemies,
            rewards: {
                beli: getRandomInt(150 + sailsCompleted * 6, 300 + sailsCompleted * 8),
                xp: getRandomInt(20 + Math.floor(sailsCompleted/4), 35 + Math.floor(sailsCompleted/4)),
                items: [getRandomItem(itemRarity)]
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