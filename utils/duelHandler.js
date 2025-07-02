const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { calculateDamage } = require('./battleSystem.js');
const { createProfessionalTeamDisplay, createEnemyDisplay, createBattleLogDisplay } = require('./uiHelpers.js');

async function handleDuelAction(interaction, client) {
    try {
        const battleData = client.battles.get(interaction.message.id);
        if (!battleData) {
            return await interaction.reply({ 
                content: '❌ Battle data not found!', 
                ephemeral: true 
            });
        }

        const { player1, player2, currentPlayer, battleLog } = battleData;
        
        // Check if it's the current player's turn
        if (interaction.user.id !== currentPlayer) {
            return await interaction.reply({ 
                content: '❌ It\'s not your turn!', 
                ephemeral: true 
            });
        }

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
            content: '❌ An error occurred during the duel action.', 
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
}

async function handleDuelItems(interaction, battleData, client) {
    return await interaction.followUp({ 
        content: '⚠️ Items are not yet implemented in duels!', 
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
        .setTitle('⚔️ PvP Duel Battle')
        .setDescription(`**Turn ${turn}** • **${currentPlayer === player1.data.id ? player1.data.username : player2.data.username}'s Turn**`)
        .setColor(0x2b2d31);

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

        const User = require('../db/models/User.js');
        const { player1, player2 } = battleData;

        // Update user battle states
        const user1 = await User.findOne({ userId: player1.data.id });
        const user2 = await User.findOne({ userId: player2.data.id });

        if (user1) {
            user1.battleState = { inBattle: false };
            if (winner && winner.id === user1.userId) {
                user1.wins = (user1.wins || 0) + 1;
                user1.beli = (user1.beli || 0) + 100;
            } else if (reason !== 'timeout') {
                user1.losses = (user1.losses || 0) + 1;
            }
            user1.duelCooldown = Date.now() + (10 * 60 * 1000);
            await user1.save();
        }

        if (user2) {
            user2.battleState = { inBattle: false };
            if (winner && winner.id === user2.userId) {
                user2.wins = (user2.wins || 0) + 1;
                user2.beli = (user2.beli || 0) + 100;
            } else if (reason !== 'timeout') {
                user2.losses = (user2.losses || 0) + 1;
            }
            user2.duelCooldown = Date.now() + (10 * 60 * 1000);
            await user2.save();
        }

        // Create final embed
        const finalEmbed = new EmbedBuilder()
            .setTitle('⚔️ Duel Complete!')
            .setColor(winner ? 0x2ecc71 : 0x2b2d31);

        if (winner) {
            finalEmbed.setDescription(`🏆 **${winner.username}** wins the duel!`);
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

    } catch (error) {
        console.error('Error ending duel:', error);
    }
}

module.exports = {
    handleDuelAction,
    updateDuelDisplay,
    endDuel
};