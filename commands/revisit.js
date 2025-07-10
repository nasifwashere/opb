const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

const sagaStages = {
    'east blue': 0,
    'arabasta': 44
};

const LOG_POSE_COST = 10000;

const data = new SlashCommandBuilder()
    .setName('revisit')
    .setDescription('Revisit a completed saga (requires Log Pose, costs 10,000 Beli)')
    .addStringOption(option =>
        option.setName('saga')
            .setDescription('Saga name to revisit (East Blue or Arabasta)')
            .setRequired(true)
    );

function fuzzySagaMatch(input) {
    if (!input) return null;
    input = input.toLowerCase();
    for (const saga of Object.keys(sagaStages)) {
        if (saga.startsWith(input) || saga.replace(/\s+/g, '').startsWith(input.replace(/\s+/g, ''))) {
            return saga;
        }
    }
    for (const saga of Object.keys(sagaStages)) {
        if (saga.includes(input) || saga.replace(/\s+/g, '').includes(input.replace(/\s+/g, ''))) {
            return saga;
        }
    }
    return null;
}

async function unlockEastBlueContent(user) {
    // Placeholder: implement logic to unlock all East Blue cards/items for the user
    // Example: user.unlockedCards = [...new Set([...(user.unlockedCards || []), ...EAST_BLUE_CARDS])];
    // await user.save();
}

async function execute(interaction) {
    const userObj = interaction.user || interaction.author;
    if (!userObj || !userObj.id) {
        return interaction.reply({ content: 'User information is missing. Please try again.', ephemeral: true });
    }
    const userId = userObj.id;
    let user = await User.findOne({ userId });
    if (!user) {
        return interaction.reply({ content: 'Start your journey with `op start` first!', ephemeral: true });
    }
    // Check for Log Pose in inventory
    const hasLogPose = user.inventory && user.inventory.some(item => item.toLowerCase().replace(/\s+/g, '') === 'logpose');
    if (!hasLogPose) {
        return interaction.reply({ content: 'You need a **Log Pose** in your inventory to use this command!', ephemeral: true });
    }
    // Check for enough Beli
    if ((user.beli || 0) < LOG_POSE_COST) {
        return interaction.reply({ content: `You need at least ${LOG_POSE_COST.toLocaleString()} Beli to use the Log Pose!`, ephemeral: true });
    }
    // Get saga name from slash command or message
    let sagaName;
    if (interaction.options && typeof interaction.options.getString === 'function') {
        sagaName = interaction.options.getString('saga');
    } else if (interaction.content) {
        const parts = interaction.content.trim().split(/\s+/);
        const revisitIdx = parts.findIndex(p => p.toLowerCase() === 'revisit');
        if (revisitIdx !== -1 && parts.length > revisitIdx + 1) {
            sagaName = parts.slice(revisitIdx + 1).join(' ');
        }
    }
    if (!sagaName) {
        return interaction.reply({ content: 'Please specify a saga name to revisit.', ephemeral: true });
    }
    sagaName = sagaName.trim().toLowerCase();
    const matchedSaga = fuzzySagaMatch(sagaName);
    if (!matchedSaga) {
        return interaction.reply({ content: 'Unknown saga. Valid options: East Blue, Arabasta', ephemeral: true });
    }
    // Only allow revisit if user has completed the saga
    const sagaStart = sagaStages[matchedSaga];
    const nextSaga = Object.values(sagaStages).find(s => s > sagaStart) || 999;
    if (user.stage < nextSaga) {
        return interaction.reply({ content: 'You can only revisit sagas you have already completed!', ephemeral: true });
    }
    // Deduct Beli and remove Log Pose
    user.beli -= LOG_POSE_COST;
    const logPoseIdx = user.inventory.findIndex(item => item.toLowerCase().replace(/\s+/g, '') === 'logpose');
    if (logPoseIdx !== -1) user.inventory.splice(logPoseIdx, 1);
    user.stage = sagaStart;
    // Unlock East Blue content if user is at or past Reverse Mountain (stage 43)
    if (user.stage >= 43) {
        await unlockEastBlueContent(user);
    }
    await user.save();
    // Modern embed UI
    const embed = new EmbedBuilder()
        .setTitle('Saga Revisited')
        .setDescription(`You have revisited **${matchedSaga.replace(/\b\w/g, l => l.toUpperCase())}**!\nUse /explore to replay this saga.`)
        .addFields(
            { name: 'Log Pose Used', value: 'Yes', inline: true },
            { name: 'Beli Spent', value: `${LOG_POSE_COST.toLocaleString()}`, inline: true },
            { name: 'Current Beli', value: `${user.beli.toLocaleString()}`, inline: true }
        )
        .setColor(0x3498db)
        .setFooter({ text: 'Adventure awaits!' });
    return interaction.reply({ embeds: [embed], ephemeral: false });
}

module.exports = { data, execute };
