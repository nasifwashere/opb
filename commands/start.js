const { SlashCommandBuilder, EmbedBuilder  } = require('discord.js');
const User = require('../db/models/User.js');
const config = require('../config.json');

const data = new SlashCommandBuilder()
  .setName('start')
  .setDescription('Begin your One Piece adventure!');

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
            .setTitle('🏴‍☠️ Welcome to the Grand Line!')
            .setDescription(`**${username}**, your legendary journey begins now!\n\n*"I'm gonna be King of the Pirates!"* - Monkey D. Luffy`)
            .setColor(0xFF6B35)
            .setThumbnail(message.author.displayAvatarURL())
            .addFields(
                { 
                    name: '💰 Starting Resources', 
                    value: `**${config.defaultCurrency}** Beli\n**3** Basic Potions`, 
                    inline: true 
                },
                { 
                    name: '⚔️ Your Stats', 
                    value: `**HP:** ${user.hp}/${user.maxHp}\n**ATK:** ${user.atk}\n**DEF:** ${user.def}\n**SPD:** ${user.spd}`, 
                    inline: true 
                },
                { 
                    name: '📊 Progress', 
                    value: `**Level:** ${user.level}\n**XP:** ${user.xp}`, 
                    inline: true 
                },
                {
                    name: '🗺️ Get Started',
                    value: '• Use `op explore` to begin your adventure\n• Use `op quest` to see available quests\n• Use `op help` for all commands',
                    inline: false
                }
            )
            .setFooter({ text: 'Your adventure awaits in the East Blue!' })
            .setImage('https://i.imgur.com/YourOnePieceImage.png') // You can add a One Piece themed image URL here

        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('Error creating user:', error);
        await message.reply('There was an error starting your adventure. Please try again.');
    }
}

module.exports = { data, execute };