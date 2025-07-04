const { SlashCommandBuilder, EmbedBuilder  } = require('discord.js');
const User = require('../db/models/User.js');
const config = require('../config.json');
const fs = require('fs');
const path = require('path');

// Load devil fruits from shop
const shopPath = path.resolve('data', 'shop.json');
const shopData = JSON.parse(fs.readFileSync(shopPath, 'utf8'));

function getRandomDevilFruit() {
    const devilFruits = shopData.devilFruits || [];
    if (devilFruits.length === 0) return null;
    return devilFruits[Math.floor(Math.random() * devilFruits.length)];
}

function normalize(str) {
    return String(str || '').replace(/\s+/g, '').toLowerCase();
}

const data = new SlashCommandBuilder()
  .setName('start')
  .setDescription('Begin your One Piece adventure!');

async function execute(message, args, client) {
    const userId = message.author.id;
    const username = message.author.username;
    
    let user = await User.findOne({ userId });
    
    if (user) {
        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setDescription('You have already started your adventure!\n\nUse `op explore` to continue your journey.')
            .setFooter({ text: 'Your adventure is already underway' });
        
        return message.reply({ embeds: [embed] });
    }

    // Get a random devil fruit for the new player
    const devilFruit = getRandomDevilFruit();
    
    // Create new user with all required fields
    user = new User({
        userId,
        username,
        beli: config.defaultCurrency || 500,
        xp: 0,
        level: 1,
        stage: 0,
        hp: 100,
        maxHp: 100,
        atk: 15,
        spd: 50,
        def: 10,
        wins: 0,
        losses: 0,
        saga: config.defaultSaga || "East Blue",
        cards: [{
            name: "Monkey D. Luffy",
            rank: "B",
            level: 1,
            experience: 0,
            timesUpgraded: 0,
            locked: false
        }],
        inventory: [normalize("Basic Potion"), normalize("Basic Potion"), normalize("Normal Potion")],
        equipped: {},
        team: [],
        battleState: {
            inBattle: false,
            enemy: null,
            battleHp: 100,
            turnCount: 0,
            battleLog: []
        },
        exploreStates: {
            inBossFight: false,
            battleState: null,
            currentStage: null,
            currentLocation: null,
            defeatCooldown: null
        },
        lastExplore: null,
        lastBattle: null,
        defeatedAt: null,
        questData: {
            progress: new Map(),
            completed: [],
            lastReset: {
                daily: 0,
                weekly: 0
            }
        },
        activeQuests: [],
        completedQuests: [],
        activeBoosts: [],
        createdAt: new Date(),
        lastActive: new Date()
    });

    // Add devil fruit to inventory if available
    if (devilFruit) {
        user.inventory.push(normalize(devilFruit.name));
    }

    try {
        await user.save();
        
        const startingItems = devilFruit 
            ? `**2** Basic Potions\n**1** Normal Potion\n**${devilFruit.name}** 🍎`
            : `**2** Basic Potions\n**1** Normal Potion`;
        
        const embed = new EmbedBuilder()
            .setTitle('Welcome to the Grand Line')
            .setDescription(`**${username}**, your legendary journey begins now!\n\n🎩 You've received **Monkey D. Luffy** (B Rank) to start your crew!`)
            .setColor(0x2b2d31)
            .addFields(
                { 
                    name: 'Starting Resources', 
                    value: `**${config.defaultCurrency}** Beli\n${startingItems}`, 
                    inline: true 
                },
                { 
                    name: 'Starting Card', 
                    value: `**Monkey D. Luffy** (B Rank)`, 
                    inline: true 
                },
                { 
                    name: 'Level', 
                    value: `**${user.level}** (${user.xp} XP)`, 
                    inline: true 
                }
            )
            .setFooter({ text: 'Use op explore to begin your adventure' });

        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error creating user:', error);
        const errorEmbed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setDescription('There was an error starting your adventure. Please try again.')
            .setFooter({ text: 'Please try again' });
            
        await message.reply({ embeds: [errorEmbed] });
    }
}

module.exports = { data, execute };