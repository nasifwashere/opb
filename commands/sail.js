const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { calculateBattleStats, calculateDamage } = require('../utils/battleSystem.js');
const { distributeXPToTeam } = require('../utils/levelSystem.js');
const { saveUserWithRetry } = require('../utils/saveWithRetry.js');
const { createProfessionalTeamDisplay, createEnemyDisplay, createBattleLogDisplay } = require('../utils/uiHelpers.js');
const itemsData = require('../data/shop.json');

// Available arcs for sailing
const AVAILABLE_ARCS = {
    'east blue': 'East Blue',
    'eastblue': 'East Blue'
};

// Unlock requirements
const SAGA_UNLOCK_REQUIREMENTS = {
    'East Blue': 42 // Must complete stage 42 (defeat Arlong)
};

const data = {
    name: 'sail',
    description: '🌊 Infinite grind mode: Sail an arc for endless rewards!'
};

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomItem(rarity) {
    const items = itemsData.filter(item => item.rarity === rarity);
    if (!items.length) {
        // Fallback items if shop.json doesn't have items of this rarity
        const fallbacks = {
            'Common': 'Basic Potion',
            'Uncommon': 'Normal Potion',
            'Rare': 'Max Potion',
            'Epic': 'Epic Potion',
            'Legendary': 'Legendary Potion'
        };
        return fallbacks[rarity] || 'Basic Potion';
    }
    return items[getRandomInt(0, items.length - 1)].name;
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
    // More granular progression with scaling rewards and difficulty
    const baseDifficulty = Math.min(sailsCompleted, 100); // Cap at sail 100 for balance
    
    if (sailsCompleted <= 3) {
        // Sails 1-3: Tutorial level
        return {
            type: 'enemy',
            title: `⚓ Navy Patrol (Sail ${sailsCompleted})`,
            description: 'A lone Navy Soldier patrols the calm waters of East Blue.',
            enemies: [{
                name: 'Navy Recruit',
                hp: 20 + (sailsCompleted * 5),
                atk: [3 + sailsCompleted, 8 + sailsCompleted],
                spd: 20 + (sailsCompleted * 2),
                rank: 'D',
                currentHp: 20 + (sailsCompleted * 5),
                maxHp: 20 + (sailsCompleted * 5)
            }],
            rewards: {
                beli: getRandomInt(5 + sailsCompleted, 10 + (sailsCompleted * 2)),
                xp: getRandomInt(2 + sailsCompleted, 5 + sailsCompleted),
                items: []
            }
        };
    } else if (sailsCompleted <= 8) {
        // Sails 4-8: Building up
        return {
            type: 'enemy',
            title: `⚔️ Navy Officer Patrol (Sail ${sailsCompleted})`,
            description: 'A Navy Officer with combat experience challenges your crew!',
            enemies: [{
                name: `Navy Officer Lv.${sailsCompleted}`,
                hp: 35 + (sailsCompleted * 8),
                atk: [6 + sailsCompleted, 12 + (sailsCompleted * 2)],
                spd: 25 + (sailsCompleted * 3),
                rank: 'C',
                currentHp: 35 + (sailsCompleted * 8),
                maxHp: 35 + (sailsCompleted * 8)
            }],
            rewards: {
                beli: getRandomInt(8 + (sailsCompleted * 2), 15 + (sailsCompleted * 4)),
                xp: getRandomInt(4 + sailsCompleted, 8 + (sailsCompleted * 2)),
                items: sailsCompleted >= 6 ? [getRandomItem('Common')] : []
            }
        };
    } else if (sailsCompleted <= 15) {
        // Sails 9-15: Squad encounters
        const enemyCount = sailsCompleted <= 10 ? 1 : getRandomInt(1, 2);
        return {
            type: 'enemy',
            title: `🚢 Navy Squad (Sail ${sailsCompleted})`,
            description: `A squad of ${enemyCount} Navy Soldiers intercepts your ship!`,
            enemies: Array.from({ length: enemyCount }, (_, i) => ({
                name: `Navy Soldier Lv.${sailsCompleted}${enemyCount > 1 ? ` #${i + 1}` : ''}`,
                hp: 50 + (sailsCompleted * 10),
                atk: [8 + sailsCompleted, 16 + (sailsCompleted * 2)],
                spd: 30 + (sailsCompleted * 3),
                rank: 'C',
                currentHp: 50 + (sailsCompleted * 10),
                maxHp: 50 + (sailsCompleted * 10)
            })),
            rewards: {
                beli: getRandomInt(15 + (sailsCompleted * 3), 30 + (sailsCompleted * 6)),
                xp: getRandomInt(6 + sailsCompleted, 12 + (sailsCompleted * 2)),
                items: [getRandomItem('Common')]
            }
        };
    } else if (sailsCompleted <= 25) {
        // Sails 16-25: Elite encounters
        const enemyCount = getRandomInt(1, 3);
        return {
            type: 'enemy',
            title: `⚡ Elite Navy Squad (Sail ${sailsCompleted})`,
            description: `${enemyCount} elite Navy Enforcers form a battle formation!`,
            enemies: Array.from({ length: enemyCount }, (_, i) => ({
                name: `Navy Enforcer Lv.${sailsCompleted}${enemyCount > 1 ? ` #${i + 1}` : ''}`,
                hp: 80 + (sailsCompleted * 12),
                atk: [12 + sailsCompleted, 20 + (sailsCompleted * 2)],
                spd: 35 + (sailsCompleted * 3),
                rank: 'B',
                currentHp: 80 + (sailsCompleted * 12),
                maxHp: 80 + (sailsCompleted * 12)
            })),
            rewards: {
                beli: getRandomInt(25 + (sailsCompleted * 4), 50 + (sailsCompleted * 8)),
                xp: getRandomInt(8 + sailsCompleted, 16 + (sailsCompleted * 2)),
                items: [getRandomItem(sailsCompleted >= 20 ? 'Uncommon' : 'Common')]
            }
        };
    } else if (sailsCompleted <= 50) {
        // Sails 26-50: Navy Blockades
        const enemyCount = getRandomInt(2, 4);
        const hp = 120 + (sailsCompleted * 15);
        return {
            type: 'enemy',
            title: `🛡️ Navy Blockade (Sail ${sailsCompleted})`,
            description: `A massive Navy blockade of ${enemyCount} warships blocks your path!`,
            enemies: Array.from({ length: enemyCount }, (_, i) => ({
                name: `Navy Warship Lv.${sailsCompleted} #${i + 1}`,
                hp: hp,
                atk: [15 + sailsCompleted, 25 + (sailsCompleted * 2)],
                spd: 40 + (sailsCompleted * 2),
                rank: 'A',
                currentHp: hp,
                maxHp: hp
            })),
            rewards: {
                beli: getRandomInt(40 + (sailsCompleted * 5), 80 + (sailsCompleted * 10)),
                xp: getRandomInt(12 + sailsCompleted, 20 + (sailsCompleted * 2)),
                items: [getRandomItem('Uncommon')]
            }
        };
    } else {
        // Sails 51+: Legendary encounters
        const enemyCount = getRandomInt(3, 5);
        const hp = 200 + (sailsCompleted * 20);
        const rarities = ['Uncommon', 'Rare', 'Epic', 'Legendary'];
        const rarityIndex = Math.min(Math.floor((sailsCompleted - 50) / 15), 3);
        const selectedRarity = rarities[rarityIndex];
        
        return {
            type: 'enemy',
            title: `👑 Admiral Fleet (Sail ${sailsCompleted})`,
            description: `An Admiral leads ${enemyCount} elite Navy flagships in an all-out assault!`,
            enemies: Array.from({ length: enemyCount }, (_, i) => ({
                name: i === 0 ? `Admiral's Flagship Lv.${sailsCompleted}` : `Elite Flagship Lv.${sailsCompleted} #${i}`,
                hp: hp + (i === 0 ? hp * 0.5 : 0), // Admiral ship has more HP
                atk: [20 + sailsCompleted, 35 + (sailsCompleted * 2)],
                spd: 45 + (sailsCompleted * 2),
                rank: i === 0 ? 'S' : 'A',
                currentHp: hp + (i === 0 ? hp * 0.5 : 0),
                maxHp: hp + (i === 0 ? hp * 0.5 : 0)
            })),
            rewards: {
                beli: getRandomInt(60 + (sailsCompleted * 8), 120 + (sailsCompleted * 15)),
                xp: getRandomInt(15 + sailsCompleted, 30 + (sailsCompleted * 3)),
                items: [getRandomItem(selectedRarity)]
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
        return message.reply('🏴‍☠️ Start your pirate journey with `op start` first!');
    }
    
    // Parse arc name from arguments
    let arcName = 'East Blue'; // Default arc
    if (args.length > 0) {
        const inputArc = args.join(' ').toLowerCase();
        if (AVAILABLE_ARCS[inputArc]) {
            arcName = AVAILABLE_ARCS[inputArc];
        } else {
            return message.reply(`❌ Unknown arc "${args.join(' ')}". Available arcs: ${Object.values(AVAILABLE_ARCS).join(', ')}`);
        }
    }
    
    // Check unlock requirements
    const requiredStage = SAGA_UNLOCK_REQUIREMENTS[arcName];
    if (requiredStage && (!user.stage || user.stage < requiredStage)) {
        return message.reply(`🔒 You must complete stage ${requiredStage} to unlock sailing in ${arcName}!`);
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
            return message.reply(`🔒 You must complete the ${arcName} saga to unlock infinite sailing!`);
        }
    }
    
    // Validate team
    if (!user.team || user.team.length === 0) {
        return message.reply('❌ You need to set up your team first! Use `op team add <card>` to add cards.');
    }
    
    if (!user.cards || user.cards.length === 0) {
        return message.reply('❌ You don\'t have any cards! Pull some cards first with `op pull`.');
    }
    
    // Calculate battle stats
    const battleTeam = calculateBattleStats(user);
    if (!battleTeam || battleTeam.length === 0) {
        return message.reply('❌ Your team is invalid. Please check your team with `op team` and fix any issues.');
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
        return message.reply('❌ Your team has no health! Rest or heal your cards before sailing.');
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
        .setTitle(`⚔️ ${event.title}`)
        .setDescription(event.description)
        .setColor(0x3498db)
        .addFields(
            {
                name: '🏴‍☠️ Your Crew',
                value: createProfessionalTeamDisplay(battleTeam, message.author.username),
                inline: false
            },
            {
                name: '⚔️ Enemies',
                value: createEnemyDisplay(event.enemies),
                inline: false
            },
            {
                name: '📜 Battle Log',
                value: '⚔️ Battle begins!',
                inline: false
            }
        )
        .setFooter({ text: `Sailing in ${arcName} | Currently on Sail #${((user.sailsCompleted && user.sailsCompleted[arcName]) || 0) + 1}` });
    
    // Create action buttons
    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('sail_attack')
                .setLabel('⚔️ Attack')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('sail_items')
                .setLabel('🎒 Items')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('sail_flee')
                .setLabel('🏃 Flee')
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
        battleLog: ['⚔️ Battle begins!'],
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
                .setDescription('⏰ Battle timed out. You fled from the encounter.');
            
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
                
                battleState.battleLog.push(`💚 Used ${effect.name}! ${injuredCard.name} healed for ${actualHeal} HP!`);
                await saveUserWithRetry(freshUser);
            } else {
                battleState.battleLog.push('❌ No injured crew members to heal!');
            }
        } else {
            battleState.battleLog.push('❌ Failed to use item!');
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
    
    battleState.battleLog.push(`💥 ${attacker.name} attacks ${target.name} for ${damage} damage!`);
    
    if (target.currentHp <= 0) {
        battleState.battleLog.push(`💀 ${target.name} is defeated!`);
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
        
        battleState.battleLog.push(`💥 ${enemy.name} attacks ${playerTarget.name} for ${enemyDamage} damage!`);
        
        if (playerTarget.currentHp <= 0) {
            battleState.battleLog.push(`💀 ${playerTarget.name} is knocked out!`);
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
        battleState.battleLog.push('❌ No usable healing items available!');
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
            .setLabel('🔙 Back')
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
        .setTitle('🏃‍♂️ Fled from Battle!')
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
    
    // Award XP to team
    distributeXPToTeam(user, rewards.xp);
    
    // Award items
    if (rewards.items && rewards.items.length > 0) {
        if (!user.inventory) user.inventory = [];
        rewards.items.forEach(item => user.inventory.push(item));
    }
    
    // Initialize sailing progress if needed
    if (!user.sailsCompleted) user.sailsCompleted = {};
    if (!user.sailsCompleted[battleState.arcName]) user.sailsCompleted[battleState.arcName] = 0;
    
    // Increment sail count
    const oldCount = user.sailsCompleted[battleState.arcName];
    user.sailsCompleted[battleState.arcName] = user.sailsCompleted[battleState.arcName] + 1;
    const newCount = user.sailsCompleted[battleState.arcName];
    console.log(`⚔️ Sail completed! ${battleState.arcName}: ${oldCount} → ${newCount}`);
    
    // Mark the field as modified so Mongoose saves it
    user.markModified('sailsCompleted');
    
    try {
        await saveUserWithRetry(user);
        console.log(`💾 Successfully saved sail count ${newCount} for ${battleState.arcName}`);
    } catch (error) {
        console.error(`❌ Failed to save sail count:`, error);
    }
    
    // Create victory embed with progression indicators
    let rewardText = `💰 **${rewards.beli} Beli**\n⭐ **${rewards.xp} XP**`;
    if (rewards.items && rewards.items.length > 0) {
        rewardText += `\n🎁 **${rewards.items.join(', ')}**`;
    }
    
    const currentSailCount = user.sailsCompleted[battleState.arcName] || 0;
    const nextSailCount = currentSailCount + 1;
    
    // Generate preview of next encounter for progression teaser
    let progressionHint = '';
    if (nextSailCount <= 3) {
        progressionHint = '⚓ **Next**: Navy Patrol (Tutorial)';
    } else if (nextSailCount <= 8) {
        progressionHint = '⚔️ **Next**: Navy Officer Patrol (Building up)';
    } else if (nextSailCount <= 15) {
        progressionHint = '🚢 **Next**: Navy Squad (Multiple enemies)';
    } else if (nextSailCount <= 25) {
        progressionHint = '⚡ **Next**: Elite Navy Squad (Stronger enemies)';
    } else if (nextSailCount <= 50) {
        progressionHint = '🛡️ **Next**: Navy Blockade (Warship fleets)';
    } else {
        progressionHint = '👑 **Next**: Admiral Fleet (Legendary encounters)';
    }
    
    const victoryEmbed = new EmbedBuilder()
        .setTitle('🎉 Victory!')
        .setDescription('All enemies have been defeated!')
        .addFields(
            {
                name: '🏆 Rewards',
                value: rewardText,
                inline: false
            },
            {
                name: '📊 Sailing Progress',
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
                .setLabel('⛵ Continue Sailing')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('sail_stop')
                .setLabel('🏃 Return to Port')
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
                    await continueInteraction.followUp({ content: '❌ User data not found!', ephemeral: true });
                    return;
                }
                
                // Debug fresh user sail count
                const freshSailCount = (freshUser.sailsCompleted && freshUser.sailsCompleted[battleState.arcName]) || 0;
                console.log(`🔄 Refreshed user data: ${battleState.arcName} sail count = ${freshSailCount}`);
                
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
                        .setTitle('💀 Team Defeated!')
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
                console.log(`🌊 Continue Sailing: Generating sail #${nextSailNumber} for ${battleState.arcName} (completed: ${newSailCount})`);
                const newEvent = generateSailEvent(battleState.arcName, nextSailNumber);
                console.log(`📋 Continue event: ${newEvent.title} with enemy: ${newEvent.enemies[0].name}`);
                
                // Start new battle
                await startNewSailBattle(battleMessage, freshUser, battleTeam, newEvent, battleState.arcName, interaction.user.id);
                
            } else if (continueInteraction.customId === 'sail_stop') {
                await continueInteraction.deferUpdate();
                
                // Stop this collector
                continueCollector.stop('stop');
                
                const stopEmbed = new EmbedBuilder()
                    .setTitle('🏴‍☠️ Returned to Port')
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
                .setTitle('⏰ Sailing Session Ended')
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
        .setTitle('💀 Defeat!')
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
        .setTitle(`⚔️ ${event.title}`)
        .setDescription(event.description)
        .setColor(0x3498db)
        .addFields(
            {
                name: '🏴‍☠️ Your Crew',
                value: createProfessionalTeamDisplay(battleTeam, user.username || 'Captain'),
                inline: false
            },
            {
                name: '⚔️ Enemies',
                value: createEnemyDisplay(event.enemies),
                inline: false
            },
            {
                name: '📜 Battle Log',
                value: '⚔️ A new encounter begins!',
                inline: false
            }
        )
        .setFooter({ text: `Sailing in ${arcName} | Currently on Sail #${((user.sailsCompleted && user.sailsCompleted[arcName]) || 0) + 1}` });
    
    // Create action buttons
    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('sail_attack')
                .setLabel('⚔️ Attack')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('sail_items')
                .setLabel('🎒 Items')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('sail_flee')
                .setLabel('🏃 Flee')
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
        battleLog: ['⚔️ A new encounter begins!'],
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
                .setDescription('⏰ Battle timed out. You fled from the encounter.');
            
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
        .setTitle(`⚔️ ${battleState.event.title}`)
        .setDescription(battleState.event.description)
        .setColor(0x3498db)
        .addFields(
            {
                name: '🏴‍☠️ Your Crew',
                value: createProfessionalTeamDisplay(battleState.userTeam, 'Captain'),
                inline: false
            },
            {
                name: '⚔️ Enemies',
                value: createEnemyDisplay(battleState.enemies),
                inline: false
            },
            {
                name: '📜 Battle Log',
                value: createBattleLogDisplay(battleState.battleLog.slice(-3)),
                inline: false
            }
        )
        .setFooter({ text: `Sailing in ${battleState.arcName}` });
    
    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('sail_attack')
                .setLabel('⚔️ Attack')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('sail_items')
                .setLabel('🎒 Items')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('sail_flee')
                .setLabel('🏃 Flee')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await battleMessage.edit({
        embeds: [embed],
        components: [actionRow]
    });
}

module.exports = { data, execute };