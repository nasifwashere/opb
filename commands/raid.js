const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const Crew = require('../db/models/Crew.js');
const { getBaseCardStats } = require('../utils/cardStats.js');
const { calculateBattleStats } = require('../utils/battleSystem.js');
const fs = require('fs');
const path = require('path');

const data = new SlashCommandBuilder()
    .setName('raid')
    .setDescription('Start or manage crew raids');

// Raid storage (in production, this would be in database)
const activeRaids = new Map();

// East Blue raid bosses
const EAST_BLUE_BOSSES = {
    'buggy': {
        name: 'Buggy the Clown',
        hp: 500,
        maxHp: 500,
        attack: 85,
        defense: 60,
        speed: 75,
        image: 'https://files.catbox.moe/p3cyod.png',
        rewards: {
            bounty: 100000,
            beli: 5000,
            items: ['Max Potion', 'Devil Fruit Fragment'],
            xp: 200
        }
    },
    'kuro': {
        name: 'Captain Kuro',
        hp: 500,
        maxHp: 500,
        attack: 95,
        defense: 55,
        speed: 110,
        image: 'https://files.catbox.moe/qqzd49.webp',
        rewards: {
            bounty: 120000,
            beli: 6000,
            items: ['Rare Blade', 'Cat Claw Gauntlets'],
            xp: 250
        }
    },
    'krieg': {
        name: 'Don Krieg',
        hp: 500,
        maxHp: 500,
        attack: 115,
        defense: 90,
        speed: 65,
        image: 'https://files.catbox.moe/vulv8e.webp',
        rewards: {
            bounty: 150000,
            beli: 7500,
            items: ['Battle Armor', 'Explosive Cannon'],
            xp: 300
        }
    },
    'arlong': {
        name: 'Arlong',
        hp: 500,
        maxHp: 500,
        attack: 125,
        defense: 85,
        speed: 80,
        image: 'https://files.catbox.moe/si9a7u.webp',
        rewards: {
            bounty: 200000,
            beli: 10000,
            items: ['Shark Teeth Sword', 'Fishman Strength Potion'],
            xp: 400
        }
    }
};

function normalize(str) {
    return String(str || '').replace(/\s+/g, '').toLowerCase();
}

async function execute(message, args, client) {
    const userId = message.author.id;
    let user = await User.findOne({ userId });

    if (!user) {
        return message.reply('Start your journey with `op start` first!');
    }

    const subcommand = args[0]?.toLowerCase();

    switch (subcommand) {
        case 'add':
            return await handleAddToRaid(message, user, args.slice(1));
        case 'leave':
            return await handleLeaveRaid(message, user);
        case 'start':
            return await handleForceStartRaid(message, user, client);
        case 'cancel':
            return await handleCancelRaid(message, user);
        default:
            // Handle boss name for starting raid
            if (args.length > 0) {
                return await handleStartRaid(message, user, args.join(' '), client);
            }
            return await showRaidHelp(message);
    }
}

async function handleStartRaid(message, user, bossName, client) {
    // Check if user is captain
    if (!user.crewId || user.crewRole !== 'captain') {
        return message.reply('Only crew captains can start raids!');
    }

    // Check if user has raid ticket (robust, normalized)
    const ticketIdx = user.inventory ? user.inventory.findIndex(item => normalize(item) === 'raidticket') : -1;
    if (ticketIdx === -1) {
        return message.reply('You need a Raid Ticket to start a raid! Buy one from the shop for 1,000 Beli.');
    }

    // Check if boss exists
    const boss = EAST_BLUE_BOSSES[bossName.toLowerCase().replace(/\s+/g, '')];
    if (!boss) {
        const availableBosses = Object.keys(EAST_BLUE_BOSSES).join(', ');
        return message.reply(`Unknown boss! Available East Blue bosses: ${availableBosses}`);
    }

    // Check if crew already has an active raid
    const existingRaid = Array.from(activeRaids.values()).find(raid => raid.crewId === user.crewId);
    if (existingRaid) {
        return message.reply('Your crew already has an active raid! Use `op raid cancel` to cancel it first.');
    }

    // Get crew data
    const crew = await Crew.findOne({ id: user.crewId });
    if (!crew) {
        return message.reply('Crew data not found!');
    }

    // Remove raid ticket from inventory (robust, normalized)
    user.inventory.splice(ticketIdx, 1);
    await user.save();

    // Create raid
    const raidId = `raid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const raid = {
        id: raidId,
        crewId: user.crewId,
        crewName: crew.name,
        captain: user.userId,
        boss: { ...boss }, // Copy boss data
        participants: [{ userId: user.userId, selectedCard: null, ready: false }],
        startTime: Date.now() + (5 * 60 * 1000), // 5 minutes from now
        started: false,
        channelId: message.channel.id,
        messageId: null
    };

    activeRaids.set(raidId, raid);

    const embed = new EmbedBuilder()
        .setTitle('Raid Started')
        .setDescription([
            `Captain **${user.username}** has started a raid against **${boss.name}**!`,
            '',
            `Raid starts in: 5 minutes`,
            `Boss: ${boss.name} (${boss.hp} HP)` ,
            `Participants: 1`,
            '',
            'Crew members can join with `op raid add @member`',
            'Select your card for battle and get ready!'
        ].join('\n'))
        .setThumbnail(boss.image)
        .setColor(0x23272a)
        .setFooter({ text: `Raid ID: ${raidId}` });

    const raidMessage = await message.reply({ embeds: [embed] });
    raid.messageId = raidMessage.id;

    // Set timer to auto-start raid
    setTimeout(async () => {
        const currentRaid = activeRaids.get(raidId);
        if (currentRaid && !currentRaid.started) {
            await startRaidBattle(currentRaid, client);
        }
    }, 5 * 60 * 1000);

    return raidMessage;
}

async function handleAddToRaid(message, user, args) {
    // Find active raid for user's crew
    const raid = Array.from(activeRaids.values()).find(r => r.crewId === user.crewId);
    if (!raid) {
        return message.reply('Your crew has no active raid!');
    }

    if (raid.started) {
        return message.reply('The raid has already started!');
    }

    // If a user mention is provided, add that user (captain only)
    const mentionedUser = message.mentions.users.first();
    if (mentionedUser) {
        // Only captain can add others
        if (user.crewRole !== 'captain') {
            return message.reply('Only the crew captain can add members to the raid.');
        }
        // Check if mentioned user is in the crew
        const targetUser = await User.findOne({ userId: mentionedUser.id });
        if (!targetUser || targetUser.crewId !== raid.crewId) {
            return message.reply('That user is not a member of your crew!');
        }
        // Check if already in raid
        if (raid.participants.some(p => p.userId === mentionedUser.id)) {
            return message.reply('That user is already in this raid!');
        }
        // Add mentioned user
        raid.participants.push({ userId: mentionedUser.id, selectedCard: null, ready: false });
        await updateRaidMessage(raid);
        return message.reply(`Added ${mentionedUser.username} to the raid!`);
    }

    // Default: add self
    if (raid.participants.some(p => p.userId === user.userId)) {
        return message.reply('You are already in this raid!');
    }
    if (!user.crewId || user.crewId !== raid.crewId) {
        return message.reply('Only crew members can join this raid!');
    }
    raid.participants.push({ userId: user.userId, selectedCard: null, ready: false });
    await updateRaidMessage(raid);
    return message.reply('You joined the raid! Select your card for battle.');
}

async function handleLeaveRaid(message, user) {
    const raid = Array.from(activeRaids.values()).find(r => 
        r.participants.find(p => p.userId === user.userId)
    );

    if (!raid) {
        return message.reply('You are not in any active raid!');
    }

    if (raid.started) {
        return message.reply('Cannot leave a raid that has already started!');
    }

    // Remove user from raid
    raid.participants = raid.participants.filter(p => p.userId !== user.userId);

    // If captain leaves, cancel raid
    if (raid.captain === user.userId) {
        activeRaids.delete(raid.id);
        return message.reply('Raid cancelled - captain left.');
    }

    await updateRaidMessage(raid);
    return message.reply('<:check:1390838766821965955> You left the raid.');
}

async function handleCancelRaid(message, user) {
    const raid = Array.from(activeRaids.values()).find(r => r.captain === user.userId);
    if (!raid) {
        return message.reply('You are not the captain of any active raid!');
    }

    if (raid.started) {
        return message.reply('Cannot cancel a raid that has already started!');
    }

    activeRaids.delete(raid.id);
    return message.reply('Raid cancelled.');
}

async function handleForceStartRaid(message, user, client) {
    const raid = Array.from(activeRaids.values()).find(r => r.captain === user.userId);
    if (!raid) {
        return message.reply('You are not the captain of any active raid!');
    }

    if (raid.started) {
        return message.reply('The raid has already started!');
    }

    await startRaidBattle(raid, client);
    return message.reply('Raid battle started!');
}

async function startRaidBattle(raid, client) {
    try {
        raid.started = true;
        raid.turn = 1;
        raid.battleLog = [];
        // Get all participants' battle cards using the same logic as duels/sailing
        const battleParticipants = [];
        for (const participant of raid.participants) {
            const user = await User.findOne({ userId: participant.userId });
            if (user && user.team && user.team.length > 0) {
                const teamStats = calculateBattleStats(user);
                if (teamStats && teamStats.length > 0) {
                    // Use the first card in the team for the raid
                    const card = teamStats[0];
                    battleParticipants.push({
                        userId: user.userId,
                        username: user.username,
                        card: {
                            name: card.name,
                            hp: card.health, // Fix: use health for hp
                            maxHp: card.health, // Fix: use health for maxHp
                            attack: card.power,
                            speed: card.speed
                        }
                    });
                }
            }
        }
        if (battleParticipants.length === 0) {
            activeRaids.delete(raid.id);
            return;
        }
        raid.battleParticipants = battleParticipants;
        // Start the battle loop
        await runRaidBattleTurns(raid, client);
    } catch (error) {
        console.error('Error starting raid battle:', error);
    }
}

async function runRaidBattleTurns(raid, client) {
    // Reset boss HP each time
    raid.boss.hp = raid.boss.maxHp;
    let boss = raid.boss;
    let players = raid.battleParticipants;
    let turn = 1;
    let battleLog = [];
    while (boss.hp > 0 && players.some(p => p.card.hp > 0)) {
        let turnLog = [];
        // Players attack boss
        let totalPlayerDmg = 0;
        for (const p of players) {
            if (p.card.hp <= 0) continue;
            const dmg = Math.max(1, p.card.attack - Math.floor(boss.defense / 4));
            boss.hp = Math.max(0, boss.hp - dmg);
            totalPlayerDmg += dmg;
            turnLog.push(`**${p.username}** did a damage of **${dmg}** to Boss **${boss.name}**`);
        }
        // Boss attacks ONE random alive player
        const alivePlayers = players.filter(p => p.card.hp > 0);
        if (alivePlayers.length > 0 && boss.hp > 0) {
            const targetIdx = Math.floor(Math.random() * alivePlayers.length);
            const target = alivePlayers[targetIdx];
            const dmg = Math.max(1, boss.attack - Math.floor(target.card.hp / 20));
            target.card.hp = Math.max(0, target.card.hp - dmg);
            turnLog.push(`Boss **${boss.name}** did a damage of **${dmg}** to **${target.username}**`);
        }
        battleLog.push(...turnLog);
        // Update embed after each turn
        await updateRaidBattleMessage(raid, boss, players, battleLog, turn, false, client);
        // End if boss or all players are dead
        if (boss.hp <= 0 || players.every(p => p.card.hp <= 0)) break;
        turn++;
        // Wait 2 seconds between turns for dramatic effect
        await new Promise(res => setTimeout(res, 2000));
    }
    // Final update
    await updateRaidBattleMessage(raid, boss, players, battleLog, turn, true, client);
    // Announce result and rewards
    if (boss.hp <= 0) {
        await announceRaidResult(raid, true, client);
    } else {
        await announceRaidResult(raid, false, client);
    }
}

async function updateRaidBattleMessage(raid, boss, players, battleLog, turn, finished = false, client) {
    try {
        // Compose battle log (last 5 turns)
        const logText = battleLog.slice(-10).join('\n');
        // Boss stats
        const bossStats = `Boss\n${boss.name}\nHP: ${boss.hp}/${boss.maxHp} | ATK: ${boss.attack} | DEF: ${boss.defense} | SPD: ${boss.speed}`;
        // Player stats
        const playerStats = players.map(p =>
            `**${p.username}**\n${p.card.name}\nHP: ${p.card.hp}/${p.card.maxHp} | ATK: ${p.card.attack} | SPD: ${p.card.speed}`
        ).join('\n\n');
        // Result
        let resultText = '';
        if (finished) {
            if (boss.hp <= 0) {
                resultText = `\n\nBoss Defeated!`;
            } else {
                resultText = `\n\nRaid Failed!`;
            }
        }
        // Build embed
        const embed = new EmbedBuilder()
            .setTitle(`${boss.name} Raid`)
            .setDescription(`Battle Phase\n${logText}${resultText}`)
            .addFields(
                { name: 'Boss', value: bossStats, inline: false },
                { name: 'Raid Team', value: playerStats, inline: false }
            )
            .setColor(0x23272a)
            .setThumbnail(boss.image || null);
        // Update or send message
        // (In production, update the original message. Here, just send a new one for demo)
        await raid.channelId && raid.messageId && raidMessageEdit(raid, embed, client);
    } catch (error) {
        console.error('Error updating raid battle message:', error);
    }
}

// Helper to update the original raid message if possible
async function raidMessageEdit(raid, embed, client) {
    try {
        const channel = await client.channels.fetch(raid.channelId);
        if (!channel) return;
        const msg = await channel.messages.fetch(raid.messageId);
        if (msg) await msg.edit({ embeds: [embed] });
    } catch (e) {
        // fallback: just send a new message
        try {
            const channel = await client.channels.fetch(raid.channelId);
            if (channel) await channel.send({ embeds: [embed] });
        } catch (err) {
            console.error('Failed to send fallback raid message:', err);
        }
    }
}

// Announce raid result and rewards
async function announceRaidResult(raid, won, client) {
    try {
        const channel = await client.channels.fetch(raid.channelId);
        if (!channel) return;
        const boss = raid.boss;
        let text = '';
        if (won) {
            // Cap Beli at 10,000
            const cappedBeli = Math.min(boss.rewards.beli, 10000);
            // Filter out devil fruits/fragments
            const filteredItems = (boss.rewards.items || []).filter(item => !/devil fruit|fragment/i.test(item));
            text = `Raid Victory!\n\nYour crew defeated **${boss.name}**!\n`;
            text += `Rewards:\n`;
            text += `• Bounty: ${boss.rewards.bounty.toLocaleString()}\n`;
            text += `• Beli: ${cappedBeli.toLocaleString()}\n`;
            text += `• Items: ${filteredItems.length > 0 ? filteredItems.join(', ') : 'None'}\n`;
            text += `• XP: ${boss.rewards.xp}`;
            // Actually grant rewards to all participants
            for (const p of raid.battleParticipants) {
                const user = await User.findOne({ userId: p.userId });
                if (user) {
                    user.bounty = (user.bounty || 0) + boss.rewards.bounty;
                    user.beli = (user.beli || 0) + cappedBeli;
                    user.xp = (user.xp || 0) + boss.rewards.xp;
                    // Add items to inventory
                    if (filteredItems.length > 0) {
                        user.inventory = user.inventory || [];
                        for (const item of filteredItems) {
                            user.inventory.push(item);
                        }
                    }
                    await user.save();
                }
            }
        } else {
            text = `Raid Failed.\n\nYour crew was defeated by **${boss.name}**.`;
        }
        await channel.send(text);
    } catch (e) {
        console.error('Failed to announce raid result:', e);
    }
}

async function showRaidHelp(message) {
    const embed = new EmbedBuilder()
        .setTitle('Raid System')
        .setDescription([
            'Fight powerful bosses with your crew!',
            '',
            '**Commands:**',
            '`op raid <boss_name>` - Start a raid (Captain only, requires Raid Ticket)',
            '`op raid add @member` - Add crew member to raid',
            '`op raid leave` - Leave current raid',
            '`op raid start` - Force start raid early (Captain only)',
            '`op raid cancel` - Cancel raid (Captain only)',
            '',
            '**Available East Blue Bosses:**',
            '• Buggy - The Clown Pirate',
            '• Kuro - Captain of the Black Cat Pirates', 
            '• Krieg - Don Krieg, Pirate Fleet Admiral',
            '• Arlong - Fishman Pirate Captain',
            '',
            '**Requirements:**',
            '• Must be crew captain to start raids',
            '• Need a Raid Ticket (1,000 Beli from shop)',
            '• Only crew members can join raids',
            '• Raids auto-start after 5 minutes'
        ].join('\n'))
        .setColor(0x23272a)
        .setFooter({ text: 'Raid System Help' });

    return message.reply({ embeds: [embed] });
}

// Update the raid lobby message (placeholder for now)
async function updateRaidMessage(raid) {
    // In a real implementation, this would update the original raid lobby message with the current participants, etc.
    // For now, this is a no-op to prevent errors.
    return;
}

module.exports = { data, execute, activeRaids, EAST_BLUE_BOSSES };