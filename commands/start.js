const { EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const config = require('../config.json');

const data = {
    name: 'start',
    description: "Begin your One Piece adventure!"
};

async function execute(message, args, client) {
    const userId = message.author.id;
    const username = message.author.username;
    
    let user = await User.findOne({ userId });
    
    if (user) {
        return message.reply('You have already started your adventure! Use `op explore` to continue.');
    }

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
        cards: [],
        inventory: ["Basic Potion", "Basic Potion", "Basic Potion"],
        equipped: new Map(),
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
        activeBoosts: [],
        createdAt: new Date(),
        lastActive: new Date()
    });

    try {
        await user.save();
        
        const embed = new EmbedBuilder()
            .setTitle('Welcome to the Grand Line!')
            .setDescription(`${username}, your journey begins now! You've received:\n\n💰 ${config.defaultCurrency} Beli\n🧪 3 Basic Potions\n\nUse \`op explore\` to start your adventure!\nUse \`op quest\` to see available quests!`)
            .setColor(0x3498db)
            .setThumbnail(message.author.displayAvatarURL())
            .addFields(
                { name: 'Stats', value: `HP: ${user.hp}/${user.maxHp}\nATK: ${user.atk}\nDEF: ${user.def}\nSPD: ${user.spd}`, inline: true },
                { name: 'Level', value: `${user.level} (${user.xp} XP)`, inline: true }
            );

        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error creating user:', error);
        await message.reply('There was an error starting your adventure. Please try again.');
    }
}

module.exports = { data, execute };