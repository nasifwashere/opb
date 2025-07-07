const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { calculateDamage } = require('./battleSystem.js');
const { createProfessionalTeamDisplay, createEnemyDisplay, createBattleLogDisplay } = require('./uiHelpers.js');

// Turn timeout duration (2 minutes)
const TURN_TIMEOUT = 2 * 60 * 1000;

async function handleDuelAction(interaction, client) {
    try {
        const battleData = client.battles.get(interaction.message.id);
        if (!battleData) {
            return await interaction.reply({ 
                content: 'Battle data not found!', 
                ephemeral: true 
            });
        }

        const { player1, player2, currentPlayer, battleLog } = battleData;
        
        // Check if it's the current player's turn
        if (interaction.user.id !== currentPlayer) {
            return await interaction.reply({ 
                content: 'It\'s not your turn!', 
                ephemeral: true 
            });
        }

        // Clear the current turn timeout since player took action
        clearTurnTimeout(battleData);

        await interaction.deferUpdate();

        if (interaction.customId === 'duel_attack') {
            await handleDuelAttack(interaction, battleData, client);
        } else if (interaction.customId === 'duel_defend') {
            await handleDuelDefend(interaction, battleData, client);
        } else if (interaction.customId === 'duel_inventory') {
            await handleDuelItems(interaction, battleData, client);
        } else if (interaction.customId === 'duel_forfeit') {
            await handleDuelForfeit(interaction, battleData, client);
        }

    } catch (error) {
        console.error('Error in handleDuelAction:', error);
        await interaction.followUp({ 
            content: 'An error occurred during the duel action.', 
            ephemeral: true 
        });
    }
}

async function handleDuelAttack(interaction, battleData, client) {
    const { player1, player2, currentPlayer } = battleData;
    const isPlayer1Turn = currentPlayer === player1.data.id;
    
    const attackingTeam = isPlayer1Turn ? player1.team : player2.team;
    const defendingTeam = isPlayer1Turn ? player2.team : player1.team;
    
    // Find first alive attacker
    const attacker = attackingTeam.find(card => card.currentHp > 0);
    if (!attacker) {
        return await endDuel(interaction.message.id, client, 'defeat', isPlayer1Turn ? player2.data : player1.data);
    }
    
    // Find first alive defender
    const target = defendingTeam.find(card => card.currentHp > 0);
    if (!target) {
        return await endDuel(interaction.message.id, client, 'victory', isPlayer1Turn ? player1.data : player2.data);
    }
    
    // Calculate and apply damage
    const damage = calculateDamage(attacker, target);
    target.currentHp = Math.max(0, target.currentHp - damage);
    
    const actionText = `${attacker.name} attacks ${target.name} for ${damage} damage!`;
    battleData.battleLog.push(actionText);
    
    if (target.currentHp <= 0) {
        battleData.battleLog.push(`${target.name} is defeated!`);
    }
    
    // Check for victory
    if (defendingTeam.every(card => card.currentHp <= 0)) {
        return await endDuel(interaction.message.id, client, 'victory', isPlayer1Turn ? player1.data : player2.data);
    }
    
    // Switch turns
    battleData.currentPlayer = isPlayer1Turn ? player2.data.id : player1.data.id;
    battleData.turn++;
    
    await updateDuelDisplay(interaction, battleData, client);
    
    // Set up timeout for the new current player
    setupTurnTimeout(battleData, client);
}

async function handleDuelDefend(interaction, battleData, client) {
    const { player1, player2, currentPlayer } = battleData;
    const isPlayer1Turn = currentPlayer === player1.data.id;
    
    const defendingPlayerName = isPlayer1Turn ? player1.data.username : player2.data.username;
    const actionText = `${defendingPlayerName} takes a defensive stance!`;
    battleData.battleLog.push(actionText);
    
    // Switch turns
    battleData.currentPlayer = isPlayer1Turn ? player2.data.id : player1.data.id;
    battleData.turn++;
    
    await updateDuelDisplay(interaction, battleData, client);
    
    // Set up timeout for the new current player
    setupTurnTimeout(battleData, client);
}

async function handleDuelItems(interaction, battleData, client) {
    return await interaction.followUp({ 
        content: 'Items are not yet implemented in duels!', 
        ephemeral: true 
    });
}

async function handleDuelForfeit(interaction, battleData, client) {
    const { player1, player2, currentPlayer } = battleData;
    const isPlayer1Turn = currentPlayer === player1.data.id;
    const winner = isPlayer1Turn ? player2.data : player1.data;
    
    await endDuel(interaction.message.id, client, 'forfeit', winner);
}

async function updateDuelDisplay(interaction, battleData, client) {
    const { player1, player2, battleLog, turn, currentPlayer } = battleData;
    
    // Create modern battle embed
    const embed = new EmbedBuilder()
        .setTitle('PvP Duel Battle')
        .setDescription(`**Turn ${turn}** • **${currentPlayer === player1.data.id ? player1.data.username : player2.data.username}'s Turn**`)
        .setColor(0x2b2d31)
        .setFooter({ text: '⏰ You have 2 minutes per turn or you forfeit!' });

    // Enhanced team displays using the same style as explore
    const team1Display = createProfessionalTeamDisplay(
        player1.team.filter(card => card.currentHp > 0), 
        player1.data.username
    );
    const team2Display = createProfessionalTeamDisplay(
        player2.team.filter(card => card.currentHp > 0), 
        player2.data.username
    );

    embed.addFields(
        {
            name: `${player1.data.username}'s Team`,
            value: team1Display || 'No active cards',
            inline: false
        },
        {
            name: `${player2.data.username}'s Team`,
            value: team2Display || 'No active cards',
            inline: false
        }
    );

    // Battle log
    if (battleLog.length > 0) {
        const recentLog = battleLog.slice(-3).join('\n');
        embed.addFields({
            name: 'Recent Actions',
            value: recentLog,
            inline: false
        });
    }

    // Modern battle buttons
    const battleButtons = [
        new ButtonBuilder()
            .setCustomId('duel_attack')
            .setLabel('Attack')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('duel_defend')
            .setLabel('Defend')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('duel_inventory')
            .setLabel('Items')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('duel_forfeit')
            .setLabel('Forfeit')
            .setStyle(ButtonStyle.Secondary)
    ];

    const row = new ActionRowBuilder().addComponents(battleButtons);

    try {
        await interaction.message.edit({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('Error updating duel display:', error);
    }
}

async function endDuel(messageId, client, reason, winner = null) {
    try {
        const battleData = client.battles.get(messageId);
        if (!battleData) return;

        // Clear any active timeout
        clearTurnTimeout(battleData);

        const User = require('../db/models/User.js');
        const { player1, player2 } = battleData;

        // Update user battle states
        const user1 = await User.findOne({ userId: player1.data.id });
        const user2 = await User.findOne({ userId: player2.data.id });

        if (user1 && user2) {
            // Initialize bounty and victory tracking if missing
            if (typeof user1.bounty !== 'number') user1.bounty = 0;
            if (typeof user2.bounty !== 'number') user2.bounty = 0;
            if (!user1.bountyVictories) user1.bountyVictories = {};
            if (!user2.bountyVictories) user2.bountyVictories = {};

            // Update battle states
            user1.battleState = { inBattle: false };
            user2.battleState = { inBattle: false };

            let bountyMessage = '';
            let isBountyTarget = false;

            if (winner) {
                const winnerUser = winner.id === user1.userId ? user1 : user2;
                const loserUser = winner.id === user1.userId ? user2 : user1;

                // Update win/loss records
                winnerUser.wins = (winnerUser.wins || 0) + 1;
                loserUser.losses = (loserUser.losses || 0) + 1;

                // Update quest progress for battle win
                try {
                    const { updateQuestProgress } = require('./questSystem.js');
                    await updateQuestProgress(winnerUser, 'battle_win', 1);
                } catch (error) {
                    console.error('Error updating quest progress in duel:', error);
                }

                // Check if this is a bounty target victory
                if (winnerUser.bountyTarget?.isActive && winnerUser.bountyTarget.userId === loserUser.userId) {
                    isBountyTarget = true;
                    // Reset bounty target cooldown when target is defeated
                    winnerUser.bountyTarget.isActive = false;
                    winnerUser.bountyTarget.cooldownUntil = Date.now(); // Reset cooldown
                }

                // Calculate bounty exchange based on percentage system
                const loserBounty = Math.max(loserUser.bounty, 0);
                const winnerKey = `${loserUser.userId}`;
                const loserKey = `${winnerUser.userId}`;

                // Check how many times winner has beaten loser
                const victoriesAgainstLoser = winnerUser.bountyVictories[winnerKey] || 0;

                if (victoriesAgainstLoser < 3) {
                    // Calculate bounty transfer (10% of loser's bounty)
                    const bountyTransfer = Math.floor(loserBounty * 0.1);
                    const multiplier = isBountyTarget ? 5 : 1;
                    const actualBountyGain = bountyTransfer * multiplier;

                    if (bountyTransfer > 0) {
                        // Winner gains bounty, loser loses bounty
                        winnerUser.bounty += actualBountyGain;
                        loserUser.bounty = Math.max(0, loserUser.bounty - bountyTransfer);

                        // Update victory count
                        winnerUser.bountyVictories[winnerKey] = victoriesAgainstLoser + 1;

                        bountyMessage = `\n\n**Bounty Exchange:**\n` +
                                      `${winner.username} gained ${actualBountyGain.toLocaleString()} bounty${isBountyTarget ? ' (5x Bounty Target bonus!)' : ''}\n` +
                                      `${loserUser.username} lost ${bountyTransfer.toLocaleString()} bounty\n` +
                                      `Victories against ${loserUser.username}: ${victoriesAgainstLoser + 1}/3`;
                    }
                } else {
                    bountyMessage = `\n\n**Bounty Exchange:**\nNo bounty exchanged (3 victory limit reached against ${loserUser.username})`;
                }

                // Base rewards
                winnerUser.beli = (winnerUser.beli || 0) + 100;
            }

            // Set cooldowns
            user1.duelCooldown = Date.now() + (10 * 60 * 1000);
            user2.duelCooldown = Date.now() + (10 * 60 * 1000);

            await user1.save();
            await user2.save();

            // Create final embed with bounty information
            const finalEmbed = new EmbedBuilder()
                .setTitle('Duel Complete!')
                .setColor(winner ? 0x2ecc71 : 0x2b2d31);

            if (winner) {
                const winType = reason === 'timeout' ? ' by timeout' : '';
                finalEmbed.setDescription(`**${winner.username}** wins the duel${winType}!${bountyMessage}`);
            } else {
                finalEmbed.setDescription('The duel has ended.');
            }

            // Clean up battle data
            client.battles.delete(messageId);

            // Update final message
            const channel = client.channels.cache.get(battleData.channelId);
            if (channel) {
                const message = await channel.messages.fetch(messageId).catch(() => null);
                if (message) {
                    await message.edit({ embeds: [finalEmbed], components: [] }).catch(() => {});
                }
            }
        }

    } catch (error) {
        console.error('Error ending duel:', error);
    }
}

// Set up turn timeout for inactive players
function setupTurnTimeout(battleData, client) {
    // Clear any existing timeout
    clearTurnTimeout(battleData);
    
    console.log(`[DUEL TIMEOUT] Setting up 2-minute timeout for ${getCurrentPlayerName(battleData)}`);
    
    battleData.turnTimeout = setTimeout(async () => {
        console.log(`[DUEL TIMEOUT] Player ${getCurrentPlayerName(battleData)} timed out!`);
        
        // Determine winner (the player who DIDN'T timeout)
        const { player1, player2, currentPlayer } = battleData;
        const winner = currentPlayer === player1.data.id ? player2.data : player1.data;
        const loser = currentPlayer === player1.data.id ? player1.data : player2.data;
        
        // Add timeout message to battle log
        battleData.battleLog.push(`⏰ ${loser.username} failed to respond within 2 minutes and forfeits!`);
        
        // End the duel with timeout reason
        await endDuel(battleData.messageId, client, 'timeout', winner);
    }, TURN_TIMEOUT);
}

// Clear existing turn timeout
function clearTurnTimeout(battleData) {
    if (battleData.turnTimeout) {
        clearTimeout(battleData.turnTimeout);
        battleData.turnTimeout = null;
    }
}

// Get current player name for logging
function getCurrentPlayerName(battleData) {
    const { player1, player2, currentPlayer } = battleData;
    return currentPlayer === player1.data.id ? player1.data.username : player2.data.username;
}

module.exports = {
    handleDuelAction,
    updateDuelDisplay,
    endDuel,
    setupTurnTimeout,
    clearTurnTimeout
};