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
    if (sailsCompleted <= 5) {
        // 1-5 sails: Basic Navy Soldier
        return {
            type: 'enemy',
            title: 'Navy Patrol',
            description: 'A lone Navy Soldier blocks your way on the seas of East Blue!',
            enemies: [{
                name: 'Navy Soldier',
                hp: 30,
                atk: [5, 10],
                spd: 25,
                rank: 'C',
                currentHp: 30,
                maxHp: 30
            }],
            rewards: {
                beli: getRandomInt(5, 10),
                xp: getRandomInt(1, 5),
                items: []
            }
        };
    } else if (sailsCompleted <= 10) {
        // 6-10 sails: Stronger Navy
        return {
            type: 'enemy',
            title: 'Navy Officer Patrol',
            description: 'A stronger Navy Officer appears to challenge you!',
            enemies: [{
                name: 'Navy Officer',
                hp: 50,
                atk: [8, 15],
                spd: 35,
                rank: 'C',
                currentHp: 50,
                maxHp: 50
            }],
            rewards: {
                beli: getRandomInt(10, 50),
                xp: getRandomInt(5, 10),
                items: []
            }
        };
    } else if (sailsCompleted <= 20) {
        // 11-20 sails: Multiple Navy Soldiers + Common items
        const enemyCount = getRandomInt(1, 3);
        return {
            type: 'enemy',
            title: 'Navy Squad',
            description: `A squad of ${enemyCount} Navy Soldiers surrounds your ship!`,
            enemies: Array.from({ length: enemyCount }, () => ({
                name: 'Navy Soldier',
                hp: 100,
                atk: [12, 20],
                spd: 40,
                rank: 'B',
                currentHp: 100,
                maxHp: 100
            })),
            rewards: {
                beli: getRandomInt(50, 100),
                xp: getRandomInt(10, 15),
                items: [getRandomItem('Common')]
            }
        };
    } else if (sailsCompleted <= 50) {
        // 21-50 sails: Stronger Navy + Uncommon items
        const enemyCount = getRandomInt(1, 3);
        return {
            type: 'enemy',
            title: 'Navy Blockade',
            description: `A Navy blockade of ${enemyCount} ships tries to stop you!`,
            enemies: Array.from({ length: enemyCount }, () => ({
                name: 'Navy Enforcer',
                hp: getRandomInt(100, 300),
                atk: [15, 25],
                spd: 50,
                rank: 'A',
                currentHp: getRandomInt(100, 300),
                maxHp: getRandomInt(100, 300)
            })),
            rewards: {
                beli: getRandomInt(100, 250),
                xp: getRandomInt(10, 20),
                items: [getRandomItem('Uncommon')]
            }
        };
    } else {
        // 51+ sails: Elite Navy + Rare+ items
        const enemyCount = getRandomInt(2, 4);
        const rarities = ['Rare', 'Epic', 'Legendary'];
        const selectedRarity = rarities[getRandomInt(0, rarities.length - 1)];
        
        return {
            type: 'enemy',
            title: 'Elite Navy Assault',
            description: `An elite Navy force of ${enemyCount} ships launches a full assault!`,
            enemies: Array.from({ length: enemyCount }, () => ({
                name: 'Elite Navy Officer',
                hp: getRandomInt(200, 500),
                atk: [25, 40],
                spd: 60,
                rank: 'S',
                currentHp: getRandomInt(200, 500),
                maxHp: getRandomInt(200, 500)
            })),
            rewards: {
                beli: getRandomInt(250, 500),
                xp: getRandomInt(15, 30),
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
    if (!user.sailsCompleted) user.sailsCompleted = {};
    if (!user.sailsCompleted[arcName]) user.sailsCompleted[arcName] = 0;
    
    const currentSails = user.sailsCompleted[arcName];
    
    // Generate sailing event
    const event = generateSailEvent(arcName, currentSails + 1);
    
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
        .setFooter({ text: `Sailing in ${arcName} | Sail #${((user.sailsCompleted && user.sailsCompleted[arcName]) || 0) + 1}` });
    
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
    user.sailsCompleted[battleState.arcName] = user.sailsCompleted[battleState.arcName] + 1;
    
    await saveUserWithRetry(user);
    
    // Create victory embed
    let rewardText = `💰 **${rewards.beli} Beli**\n⭐ **${rewards.xp} XP**`;
    if (rewards.items && rewards.items.length > 0) {
        rewardText += `\n🎁 **${rewards.items.join(', ')}**`;
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
                name: '📊 Progress',
                value: `Sails completed in ${battleState.arcName}: **${user.sailsCompleted[battleState.arcName] || 0}**`,
                inline: false
            }
        )
        .setColor(0x2ecc71)
        .setFooter({ text: `Continue sailing for more adventures!` });
    
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
                const newEvent = generateSailEvent(battleState.arcName, newSailCount + 1);
                
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
        .setFooter({ text: `Sailing in ${arcName} | Sail #${((user.sailsCompleted && user.sailsCompleted[arcName]) || 0) + 1}` });
    
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