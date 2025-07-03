const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { crews } = require('./crew.js');
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
        image: 'https://files.catbox.moe/n4x2q8.webp',
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

async function execute(message, args) {
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
            return await handleForceStartRaid(message, user);
        case 'cancel':
            return await handleCancelRaid(message, user);
        default:
            // Handle boss name for starting raid
            if (args.length > 0) {
                return await handleStartRaid(message, user, args.join(' '));
            }
            return await showRaidHelp(message);
    }
}

async function handleStartRaid(message, user, bossName) {
    // Check if user is captain
    if (!user.crewId || user.crewRole !== 'captain') {
        return message.reply('❌ Only crew captains can start raids!');
    }

    // Check if user has raid ticket
    if (!user.inventory || !user.inventory.includes('raidticket')) {
        return message.reply('❌ You need a Raid Ticket to start a raid! Buy one from the shop for 1,000 Beli.');
    }

    // Check if boss exists
    const boss = EAST_BLUE_BOSSES[bossName.toLowerCase().replace(/\s+/g, '')];
    if (!boss) {
        const availableBosses = Object.keys(EAST_BLUE_BOSSES).join(', ');
        return message.reply(`❌ Unknown boss! Available East Blue bosses: ${availableBosses}`);
    }

    // Check if crew already has an active raid
    const existingRaid = Array.from(activeRaids.values()).find(raid => raid.crewId === user.crewId);
    if (existingRaid) {
        return message.reply('❌ Your crew already has an active raid! Use `op raid cancel` to cancel it first.');
    }

    // Get crew data
    const crew = crews.get(user.crewId);
    if (!crew) {
        return message.reply('❌ Crew data not found!');
    }

    // Remove raid ticket from inventory
    const ticketIndex = user.inventory.indexOf('raidticket');
    user.inventory.splice(ticketIndex, 1);
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
        .setTitle('🏴‍☠️ Raid Started!')
        .setDescription([
            `**Captain ${user.username}** has started a raid against **${boss.name}**!`,
            '',
            `⏰ **Raid starts in:** 5 minutes`,
            `🏴‍☠️ **Boss:** ${boss.name} (${boss.hp} HP)`,
            `👥 **Participants:** 1`,
            '',
            'Crew members can join with `op raid add @member`',
            'Select your card for battle and get ready!'
        ].join('\n'))
        .setThumbnail(boss.image)
        .setColor(0xdc143c)
        .setFooter({ text: `Raid ID: ${raidId}` });

    const raidMessage = await message.reply({ embeds: [embed] });
    raid.messageId = raidMessage.id;

    // Set timer to auto-start raid
    setTimeout(async () => {
        const currentRaid = activeRaids.get(raidId);
        if (currentRaid && !currentRaid.started) {
            await startRaidBattle(currentRaid);
        }
    }, 5 * 60 * 1000);

    return raidMessage;
}

async function handleAddToRaid(message, user, args) {
    // Find active raid for user's crew
    const raid = Array.from(activeRaids.values()).find(r => r.crewId === user.crewId);
    if (!raid) {
        return message.reply('❌ Your crew has no active raid!');
    }

    if (raid.started) {
        return message.reply('❌ The raid has already started!');
    }

    // Check if user is already in raid
    if (raid.participants.find(p => p.userId === user.userId)) {
        return message.reply('❌ You are already in this raid!');
    }

    // Check if user has crew permissions
    if (!user.crewId || user.crewId !== raid.crewId) {
        return message.reply('❌ Only crew members can join this raid!');
    }

    // Add user to raid
    raid.participants.push({ userId: user.userId, selectedCard: null, ready: false });

    await updateRaidMessage(raid);

    return message.reply('✅ You joined the raid! Select your card for battle.');
}

async function handleLeaveRaid(message, user) {
    const raid = Array.from(activeRaids.values()).find(r => 
        r.participants.find(p => p.userId === user.userId)
    );

    if (!raid) {
        return message.reply('❌ You are not in any active raid!');
    }

    if (raid.started) {
        return message.reply('❌ Cannot leave a raid that has already started!');
    }

    // Remove user from raid
    raid.participants = raid.participants.filter(p => p.userId !== user.userId);

    // If captain leaves, cancel raid
    if (raid.captain === user.userId) {
        activeRaids.delete(raid.id);
        return message.reply('🚫 Raid cancelled - captain left.');
    }

    await updateRaidMessage(raid);
    return message.reply('✅ You left the raid.');
}

async function handleCancelRaid(message, user) {
    const raid = Array.from(activeRaids.values()).find(r => r.captain === user.userId);
    if (!raid) {
        return message.reply('❌ You are not the captain of any active raid!');
    }

    if (raid.started) {
        return message.reply('❌ Cannot cancel a raid that has already started!');
    }

    activeRaids.delete(raid.id);
    return message.reply('🚫 Raid cancelled.');
}

async function handleForceStartRaid(message, user) {
    const raid = Array.from(activeRaids.values()).find(r => r.captain === user.userId);
    if (!raid) {
        return message.reply('❌ You are not the captain of any active raid!');
    }

    if (raid.started) {
        return message.reply('❌ The raid has already started!');
    }

    await startRaidBattle(raid);
    return message.reply('⚔️ Raid battle started!');
}

async function startRaidBattle(raid) {
    try {
        // Mark raid as started
        raid.started = true;
        raid.turn = 1;
        raid.battleLog = [];

        // Get all participants' battle cards
        const battleParticipants = [];
        for (const participant of raid.participants) {
            const user = await User.findOne({ userId: participant.userId });
            if (user && user.team && user.team.length > 0) {
                // Use first card from team for now (in full implementation, they'd select)
                const cardName = user.team[0];
                const card = user.cards.find(c => c.name === cardName);
                if (card) {
                    battleParticipants.push({
                        userId: user.userId,
                        username: user.username,
                        card: {
                            name: card.name,
                            hp: calculateCardHP(card),
                            maxHp: calculateCardHP(card),
                            attack: calculateCardAttack(card),
                            speed: calculateCardSpeed(card)
                        }
                    });
                }
            }
        }

        if (battleParticipants.length === 0) {
            // No valid participants, cancel raid
            activeRaids.delete(raid.id);
            return;
        }

        raid.battleParticipants = battleParticipants;

        await updateRaidBattleMessage(raid);
    } catch (error) {
        console.error('Error starting raid battle:', error);
    }
}

async function updateRaidMessage(raid) {
    try {
        // Implementation would update the raid message
        console.log(`Updating raid ${raid.id} with ${raid.participants.length} participants`);
    } catch (error) {
        console.error('Error updating raid message:', error);
    }
}

async function updateRaidBattleMessage(raid) {
    try {
        // Implementation would show battle interface
        console.log(`Starting raid battle for ${raid.id}`);
    } catch (error) {
        console.error('Error updating raid battle message:', error);
    }
}

function calculateCardHP(card) {
    return Math.floor((50 + (card.level || 1) * 10) * (1 + (card.timesUpgraded || 0) * 0.1));
}

function calculateCardAttack(card) {
    return Math.floor((20 + (card.level || 1) * 5) * (1 + (card.timesUpgraded || 0) * 0.1));
}

function calculateCardSpeed(card) {
    return Math.floor((30 + (card.level || 1) * 3) * (1 + (card.timesUpgraded || 0) * 0.05));
}

async function showRaidHelp(message) {
    const embed = new EmbedBuilder()
        .setTitle('🏴‍☠️ Raid System')
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
        .setColor(0xdc143c)
        .setFooter({ text: 'Raid System Help' });

    return message.reply({ embeds: [embed] });
}

module.exports = { data, execute, activeRaids, EAST_BLUE_BOSSES };