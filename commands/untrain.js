const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const { stopTraining, getTrainingStatus, fuzzyFindCard } = require('../utils/trainingSystem.js');

const data = new SlashCommandBuilder()
  .setName('untrain')
  .setDescription('Stop training a card and return it to your collection with gained XP');

async function execute(message, args) {
    const userId = message.author.id;
    const username = message.author.username;
    let user = await User.findOne({ userId });

    if (!user) {
        return message.reply('Start your journey with `op start` first!');
    }

    // Ensure username is set if missing
    if (!user.username) {
        user.username = username;
        await user.save();
    }

    if (args.length === 0) {
        // Show current training status if no card specified
        const result = await getTrainingStatus(userId);
        
        if (!result.success) {
            return message.reply(result.message);
        }

        if (result.training.length === 0) {
            return message.reply('You have no cards in training. Use `op train <card name>` to start training a card.');
        }

        let trainingText = '';
        for (const card of result.training) {
            const timeText = card.trainingTime.hours > 0 
                ? `${card.trainingTime.hours}h ${card.trainingTime.minutes}m`
                : `${card.trainingTime.minutes}m`;
            
            trainingText += `• **${card.name || card.cardName}** - ${timeText} (${card.currentAccumulatedXP} XP gained)\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle('Cards in Training')
            .setDescription(`${trainingText}\nUse \`op untrain <card name>\` to stop training a specific card.`)
            .setColor(0x3498db)
            .setFooter({ text: `${result.slotsUsed}/${result.maxSlots} training slots used` });

        return message.reply({ embeds: [embed] });
    }

    const cardName = args.join(' ');
    // Fuzzy match the card name in user's training list before calling stopTraining
    if (user.training && user.training.length > 0) {
        const match = fuzzyFindCard(user.training, cardName);
        if (match) {
            // Use the matched card's name for stopTraining
            const result = await stopTraining(userId, match.name || match.cardName);
            if (!result.success) {
                return message.reply(result.message.replace('You do not have that card in training.', 'You do not have that card in training. Try using partial names like "luffy" or "gear"!'));
            }
            const timeText = result.trainingTime.hours > 0 
                ? `${result.trainingTime.hours}h ${result.trainingTime.minutes}m`
                : `${result.trainingTime.minutes}m`;
            const fields = [
                { name: 'Card', value: `**${result.card.name}** (${result.card.rank})`, inline: true },
                { name: 'Level', value: `${result.card.level}`, inline: true },
                { name: 'Training Time', value: timeText, inline: true },
                { name: 'XP Gained', value: `${result.xpGained}`, inline: true },
                { name: 'Total XP', value: `${result.totalXP}`, inline: true }
            ];
            if (result.duplicatesReturned && result.duplicatesReturned > 0) {
                fields.push({ 
                    name: 'Duplicates Returned', 
                    value: `${result.duplicatesReturned} duplicate card${result.duplicatesReturned > 1 ? 's' : ''} collected during training`, 
                    inline: false 
                });
            }
            const embed = new EmbedBuilder()
                .setTitle('Training Completed!')
                .setDescription(result.message)
                .addFields(fields)
                .setColor(0x2ecc71)
                .setFooter({ text: 'Card has been returned to your collection' });
            return message.reply({ embeds: [embed] });
        }
    }
    // If no fuzzy match, fallback to original logic
    const result = await stopTraining(userId, cardName);
    if (!result.success) {
        return message.reply(result.message.replace('You do not have that card in training.', 'You do not have that card in training. Try using partial names like "luffy" or "gear"!'));
    }
    const timeText = result.trainingTime.hours > 0 
        ? `${result.trainingTime.hours}h ${result.trainingTime.minutes}m`
        : `${result.trainingTime.minutes}m`;
    const fields = [
        { name: 'Card', value: `**${result.card.name}** (${result.card.rank})`, inline: true },
        { name: 'Level', value: `${result.card.level}`, inline: true },
        { name: 'Training Time', value: timeText, inline: true },
        { name: 'XP Gained', value: `${result.xpGained}`, inline: true },
        { name: 'Total XP', value: `${result.totalXP}`, inline: true }
    ];
    if (result.duplicatesReturned && result.duplicatesReturned > 0) {
        fields.push({ 
            name: 'Duplicates Returned', 
            value: `${result.duplicatesReturned} duplicate card${result.duplicatesReturned > 1 ? 's' : ''} collected during training`, 
            inline: false 
        });
    }
    const embed = new EmbedBuilder()
        .setTitle('Training Completed!')
        .setDescription(result.message)
        .addFields(fields)
        .setColor(0x2ecc71)
        .setFooter({ text: 'Card has been returned to your collection' });

    return message.reply({ embeds: [embed] });
}

module.exports = { data, execute };