const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const { startTraining, stopTraining, getTrainingStatus } = require('../utils/trainingSystem.js');

const data = new SlashCommandBuilder()
  .setName('train')
  .setDescription('Train your cards to gain experience while you\'re away');

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

    // If no arguments, show training status
    if (args.length === 0) {
        const result = await getTrainingStatus(userId);
        
        if (!result.success) {
            return message.reply(result.message);
        }

        if (result.training.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('Training Center')
                .setDescription('No cards are currently in training.')
                .addFields(
                    { name: 'How to Train', value: '`op train <card name>` - Start training a card\n`op untrain <card name>` - Stop training a card', inline: false },
                    { name: 'Training Info', value: '• 1 XP per minute\n• 3 cards max at once\n• Auto-untrain after 1 week', inline: false }
                )
                .setColor(0x3498db)
                .setFooter({ text: `Training slots: ${result.slotsUsed}/${result.maxSlots}` });

            return message.reply({ embeds: [embed] });
        }

        // Show current training status
        let trainingText = '';
        for (const card of result.training) {
            const timeText = card.trainingTime.hours > 0 
                ? `${card.trainingTime.hours}h ${card.trainingTime.minutes}m`
                : `${card.trainingTime.minutes}m`;
            const duplicatesText = card.duplicates > 0 ? `\nDuplicates: ${card.duplicates}` : '';
            // Always use .name for display
            trainingText += `**${card.name}** (${card.rank})\n`;
            trainingText += `\`\`\`Training time: ${timeText}\nXP gained: ${card.currentAccumulatedXP}\nTotal XP: ${card.currentTotalXP}${duplicatesText}\`\`\`\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle('Training Center')
            .setDescription(trainingText)
            .setColor(0x3498db)
            .setFooter({ text: `Training slots: ${result.slotsUsed}/${result.maxSlots} • Cards gain 1 XP per minute` });

        return message.reply({ embeds: [embed] });
    }

    // Fuzzy recognition for card name
    const cardName = args.join(' ');
    // Start training the specified card
    const result = await startTraining(userId, cardName);
    if (!result.success) {
        return message.reply(result.message);
    }
    const embed = new EmbedBuilder()
        .setTitle('Training Started!')
        .setDescription(result.message)
        .addFields(
            { name: 'Card', value: `**${result.card.name}** (${result.card.rank})`, inline: true },
            { name: 'Current XP', value: `${result.card.experience || 0}`, inline: true },
            { name: 'Rate', value: '1 XP per minute', inline: true }
        )
        .setColor(0x2ecc71)
        .setFooter({ text: 'Use "op untrain <card name>" to stop training and get your card back' });
    return message.reply({ embeds: [embed] });
}

module.exports = { data, execute };