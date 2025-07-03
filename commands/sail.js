const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');
const { getRandomInt } = require('../utils/uiHelpers.js');
const { saveUserWithRetry } = require('../utils/saveWithRetry.js');
const itemsData = require('../data/shop.json');

const SAIL_UNLOCK_SAGA = 'East Blue';
const SAIL_SAGA_LIST = ['East Blue']; // Expandable for future sagas


// Navy ranks for variety
const NAVY_RANKS = [
  'Navy Recruit', 'Navy Seaman', 'Navy Petty Officer', 'Navy Chief Petty Officer',
  'Navy Ensign', 'Navy Lieutenant', 'Navy Commander', 'Navy Captain', 'Navy Commodore', 'Navy Vice Admiral', 'Navy Admiral'
];

// SAIL_EVENTS: a mix of battle, narrative, and choice events
const SAIL_EVENTS = [
  // Battle event
  () => ({
    type: 'enemy',
    title: 'Navy Ambush!',
    desc: 'A group of Navy officers block your path at sea.',
    enemy: {
      name: NAVY_RANKS[getRandomInt(0, NAVY_RANKS.length-1)],
      hp: getRandomInt(80, 180),
      atk: [getRandomInt(10, 20), getRandomInt(21, 35)],
      spd: getRandomInt(40, 80),
      rank: ['C','B','A'][getRandomInt(0,2)]
    },
    reward: { type: 'multiple', rewards: [
      { type: 'beli', amount: getRandomInt(50, 200) },
      { type: 'xp', amount: getRandomInt(10, 40) }
    ]}
  }),
  // Narrative event
  () => ({
    type: 'narrative',
    title: 'Calm Waters',
    desc: 'The sea is calm. Your crew shares stories and enjoys a peaceful moment.',
    reward: { type: 'xp', amount: getRandomInt(5, 15) }
  }),
  // Choice event
  () => ({
    type: 'choice',
    title: 'Mysterious Crate',
    desc: 'You spot a floating crate. Do you want to open it?',
    choice: {
      yes: { type: 'item', name: 'Basic Potion' },
      no: { type: 'beli', amount: 20 }
    }
  }),
  // Battle event (stronger)
  () => ({
    type: 'enemy',
    title: 'Elite Navy Challenge',
    desc: 'A high-ranking Navy officer challenges you to a duel!',
    enemy: {
      name: NAVY_RANKS[getRandomInt(5, NAVY_RANKS.length-1)],
      hp: getRandomInt(150, 300),
      atk: [getRandomInt(20, 30), getRandomInt(31, 50)],
      spd: getRandomInt(60, 100),
      rank: ['A','S'][getRandomInt(0,1)]
    },
    reward: { type: 'multiple', rewards: [
      { type: 'beli', amount: getRandomInt(150, 400) },
      { type: 'xp', amount: getRandomInt(30, 70) }
    ]}
  }),
  // Narrative event (rare)
  () => ({
    type: 'narrative',
    title: 'Treasure Map',
    desc: 'You find a tattered map hinting at hidden treasure. Your crew is excited!',
    reward: { type: 'beli', amount: getRandomInt(100, 300) }
  })
];

const data = new SlashCommandBuilder()
  .setName('sail')
  .setDescription('Infinite grind mode: Sail an arc for endless rewards!')
  .addStringOption(option =>
    option.setName('arc')
      .setDescription('Arc/Saga to sail (e.g., east blue)')
      .setRequired(true)
  );

console.log('[SAIL] sail.js loaded');

async function execute(message, args, client) {
  console.log('[SAIL] execute called', { args, user: message.author?.id || message.user?.id });
  const userId = message.author.id;
  let user = await User.findOne({ userId });
  if (!user) return message.reply('Start your journey with `op start` first!');

  // Parse arc name (fuzzy)
  const arcInput = args.join(' ').trim().toLowerCase();
  const arc = SAIL_SAGA_LIST.find(s => s.toLowerCase().includes(arcInput));
  if (!arc) return message.reply('Unknown arc. Try: `op sail east blue`');

  // Unlock check: allow if saga completed OR user has reached/passed global stage 42 (end of East Blue)
  if (!user.completedSagas || !user.completedSagas.includes(SAIL_UNLOCK_SAGA)) {
    if (typeof user.stage !== 'number' || user.stage < 42) {
      return message.reply('You must complete the full saga (e.g., defeat Arlong in East Blue) to unlock infinite sail mode!');
    } else {
      // Auto-fix: add saga to completedSagas for legacy users
      if (!user.completedSagas) user.completedSagas = [];
      user.completedSagas.push(SAIL_UNLOCK_SAGA);
      await saveUserWithRetry(user);
    }
  }


  // Progress tracking
  if (!user.sailsCompleted) user.sailsCompleted = {};
  if (!user.sailsCompleted[arc]) user.sailsCompleted[arc] = 0;
  user.sailsCompleted[arc]++;
  const sailsDone = user.sailsCompleted[arc];

  // Pick event for this sail (cycle through, or random)
  const eventFn = SAIL_EVENTS[(sailsDone - 1) % SAIL_EVENTS.length];
  const event = eventFn();

  // UI helpers
  const { createProfessionalTeamDisplay, createEnemyDisplay, createBattleLogDisplay, createProgressDisplay } = require('../utils/uiHelpers.js');
  const { calculateBattleStats, resetTeamHP } = require('../utils/battleSystem.js');
  const { distributeXPToTeam } = require('../utils/levelSystem.js');

  // Handle event types
  if (event.type === 'enemy') {
    // Use real battle system (single enemy)
    // Prepare enemy as array for compatibility
    const enemyObj = {
      ...event.enemy,
      currentHp: event.enemy.hp,
      maxHp: event.enemy.hp
    };
    const battleTeam = calculateBattleStats(user);
    if (!battleTeam || battleTeam.length === 0) {
      return message.reply('❌ Your team is invalid or cards are missing. Please check your team with `op team` and fix any issues.');
    }
    // Simulate a simple battle (one round, user always wins for now)
    // TODO: Replace with full turn-based system if needed
    const battleLog = [`Your crew defeats the ${enemyObj.name}!`];
    // Award rewards
    let rewardText = '';
    if (event.reward) {
      if (event.reward.type === 'multiple') {
        for (const r of event.reward.rewards) {
          if (r.type === 'beli') user.beli = (user.beli || 0) + r.amount;
          if (r.type === 'xp') distributeXPToTeam(user, r.amount);
          if (r.type === 'item') user.inventory = [...(user.inventory || []), r.name];
        }
        rewardText = event.reward.rewards.map(r => `${r.type === 'beli' ? '💰' : r.type === 'xp' ? '⭐' : '🎁'} ${r.amount || r.name}`).join('  ');
      } else if (event.reward.type === 'beli') {
        user.beli = (user.beli || 0) + event.reward.amount;
        rewardText = `💰 ${event.reward.amount}`;
      } else if (event.reward.type === 'xp') {
        distributeXPToTeam(user, event.reward.amount);
        rewardText = `⭐ ${event.reward.amount}`;
      } else if (event.reward.type === 'item') {
        user.inventory = [...(user.inventory || []), event.reward.name];
        rewardText = `🎁 ${event.reward.name}`;
      }
    }
    await saveUserWithRetry(user);
    const embed = new EmbedBuilder()
      .setTitle(`⚔️ ${event.title}`)
      .setDescription(event.desc)
      .addFields(
        { name: 'Your Crew', value: createProfessionalTeamDisplay(battleTeam, 'Your Crew'), inline: false },
        { name: 'Enemy', value: createEnemyDisplay([enemyObj]), inline: false },
        { name: 'Battle Log', value: createBattleLogDisplay(battleLog), inline: false },
        { name: 'Reward', value: rewardText, inline: false }
      )
      .setColor(0x3498db)
      .setFooter({ text: `Sails completed: ${sailsDone}` });
    return message.reply({ embeds: [embed] });
  } else if (event.type === 'narrative') {
    // Narrative event UI
    let rewardText = '';
    if (event.reward) {
      if (event.reward.type === 'beli') {
        user.beli = (user.beli || 0) + event.reward.amount;
        rewardText = `💰 ${event.reward.amount}`;
      } else if (event.reward.type === 'xp') {
        distributeXPToTeam(user, event.reward.amount);
        rewardText = `⭐ ${event.reward.amount}`;
      } else if (event.reward.type === 'item') {
        user.inventory = [...(user.inventory || []), event.reward.name];
        rewardText = `🎁 ${event.reward.name}`;
      }
    }
    await saveUserWithRetry(user);
    const embed = new EmbedBuilder()
      .setTitle(`🗺️ ${event.title}`)
      .setDescription(event.desc)
      .addFields(
        { name: 'Your Crew', value: createProfessionalTeamDisplay(calculateBattleStats(user), 'Your Crew'), inline: false },
        { name: 'Reward', value: rewardText, inline: false }
      )
      .setColor(0x2ecc71)
      .setFooter({ text: `Sails completed: ${sailsDone}` });
    return message.reply({ embeds: [embed] });
  } else if (event.type === 'choice') {
    // Choice event UI (simple yes/no)
    const row = require('discord.js').ActionRowBuilder ? new (require('discord.js').ActionRowBuilder)().addComponents(
      new (require('discord.js').ButtonBuilder)()
        .setCustomId('sail_choice_yes')
        .setLabel('Yes')
        .setStyle(require('discord.js').ButtonStyle.Success),
      new (require('discord.js').ButtonBuilder)()
        .setCustomId('sail_choice_no')
        .setLabel('No')
        .setStyle(require('discord.js').ButtonStyle.Secondary)
    ) : null;
    const embed = new EmbedBuilder()
      .setTitle(`❓ ${event.title}`)
      .setDescription(event.desc)
      .setColor(0xf1c40f)
      .setFooter({ text: `Sails completed: ${sailsDone}` });
    if (row) {
      const sent = await message.reply({ embeds: [embed], components: [row] });
      // Wait for button interaction (simple version)
      const filter = i => i.user.id === userId && i.customId.startsWith('sail_choice_');
      try {
        const collected = await sent.awaitMessageComponent({ filter, time: 15000 });
        let choice = collected.customId.endsWith('yes') ? 'yes' : 'no';
        let reward = event.choice[choice];
        let rewardText = '';
        if (reward.type === 'beli') {
          user.beli = (user.beli || 0) + reward.amount;
          rewardText = `💰 ${reward.amount}`;
        } else if (reward.type === 'xp') {
          distributeXPToTeam(user, reward.amount);
          rewardText = `⭐ ${reward.amount}`;
        } else if (reward.type === 'item') {
          user.inventory = [...(user.inventory || []), reward.name];
          rewardText = `🎁 ${reward.name}`;
        }
        await saveUserWithRetry(user);
        const resultEmbed = new EmbedBuilder()
          .setTitle('Result')
          .setDescription(`You chose **${choice}**!`)
          .addFields({ name: 'Reward', value: rewardText, inline: false })
          .setFooter({ text: `Sails completed: ${sailsDone}` });
        return collected.update({ embeds: [resultEmbed], components: [] });
      } catch (e) {
        // Timeout or error
        return sent.edit({ content: 'No choice made. The opportunity passes.', components: [], embeds: [embed] });
      }
    } else {
      // Fallback: no buttons
      return message.reply({ embeds: [embed] });
    }
  }
}

module.exports = { data, execute };
