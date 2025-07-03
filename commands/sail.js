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


// Scaling function for rewards/enemies/items based on sails completed
function getSailEvent(sailsCompleted) {
  // 1–5: 1 Navy Soldier (30 HP), 5–10 Beli, 1–5 XP
  if (sailsCompleted <= 5) {
    return {
      type: 'enemy',
      title: 'Navy Patrol',
      desc: 'A lone Navy Soldier blocks your way.',
      enemies: [{
        name: 'Navy Soldier',
        hp: 30,
        atk: [5, 10],
        spd: 30,
        rank: 'C',
        currentHp: 30,
        maxHp: 30
      }],
      reward: { type: 'multiple', rewards: [
        { type: 'beli', amount: getRandomInt(5, 10) },
        { type: 'xp', amount: getRandomInt(1, 5) }
      ]}
    };
  }
  // 6–10: 1 Stronger Navy (50 HP), 10–50 Beli, 5–10 XP
  if (sailsCompleted <= 10) {
    return {
      type: 'enemy',
      title: 'Stronger Navy',
      desc: 'A stronger Navy officer appears!',
      enemies: [{
        name: 'Navy Officer',
        hp: 50,
        atk: [10, 15],
        spd: 40,
        rank: 'C',
        currentHp: 50,
        maxHp: 50
      }],
      reward: { type: 'multiple', rewards: [
        { type: 'beli', amount: getRandomInt(10, 50) },
        { type: 'xp', amount: getRandomInt(5, 10) }
      ]}
    };
  }
  // 11–20: 1–3 Navy Soldiers (100 HP), 50–100 Beli, 10–15 XP, Common item
  if (sailsCompleted <= 20) {
    const count = getRandomInt(1, 3);
    return {
      type: 'enemy',
      title: 'Navy Squad',
      desc: 'A squad of Navy Soldiers surrounds you!',
      enemies: Array.from({ length: count }, () => ({
        name: 'Navy Soldier',
        hp: 100,
        atk: [15, 20],
        spd: 50,
        rank: 'B',
        currentHp: 100,
        maxHp: 100
      })),
      reward: { type: 'multiple', rewards: [
        { type: 'beli', amount: getRandomInt(50, 100) },
        { type: 'xp', amount: getRandomInt(10, 15) },
        { type: 'item', name: getRandomCommonItem() }
      ]}
    };
  }
  // 21–50: 1–3 Navy (100–300 HP), 100–250 Beli, 10–20 XP, Uncommon item
  if (sailsCompleted <= 50) {
    const count = getRandomInt(1, 3);
    return {
      type: 'enemy',
      title: 'Navy Blockade',
      desc: 'A blockade of Navy ships tries to stop you!',
      enemies: Array.from({ length: count }, () => ({
        name: 'Navy Enforcer',
        hp: getRandomInt(100, 300),
        atk: [20, 30],
        spd: 60,
        rank: 'A',
        currentHp: 200,
        maxHp: 200
      })),
      reward: { type: 'multiple', rewards: [
        { type: 'beli', amount: getRandomInt(100, 250) },
        { type: 'xp', amount: getRandomInt(10, 20) },
        { type: 'item', name: getRandomUncommonItem() }
      ]}
    };
  }
  // 51+: 2–4 Elite Navy (200–500 HP), 250–500 Beli, 15–30 XP, Rare/Epic/Legendary item
  const count = getRandomInt(2, 4);
  const rarities = ['Rare', 'Epic', 'Legendary'];
  return {
    type: 'enemy',
    title: 'Elite Navy Assault',
    desc: 'Elite Navy officers attack with full force!',
    enemies: Array.from({ length: count }, () => ({
      name: NAVY_RANKS[getRandomInt(5, NAVY_RANKS.length-1)],
      hp: getRandomInt(200, 500),
      atk: [30, 50],
      spd: 80,
      rank: ['A','S','UR'][getRandomInt(0,2)],
      currentHp: 400,
      maxHp: 400
    })),
    reward: { type: 'multiple', rewards: [
      { type: 'beli', amount: getRandomInt(250, 500) },
      { type: 'xp', amount: getRandomInt(15, 30) },
      { type: 'item', name: getRandomHighRarityItem(rarities) }
    ]}
  };
}

function getRandomCommonItem() {
  const commons = itemsData.filter(i => i.rarity === 'Common');
  if (!commons.length) return 'Basic Potion';
  return commons[getRandomInt(0, commons.length - 1)].name;
}
function getRandomUncommonItem() {
  const uncommons = itemsData.filter(i => i.rarity === 'Uncommon');
  if (!uncommons.length) return 'Normal Potion';
  return uncommons[getRandomInt(0, uncommons.length - 1)].name;
}
function getRandomHighRarityItem(rarities) {
  const high = itemsData.filter(i => rarities.includes(i.rarity));
  if (!high.length) return 'Rare Potion';
  return high[getRandomInt(0, high.length - 1)].name;
}

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
  const sailsDone = user.sailsCompleted[arc];
  const event = getSailEvent(sailsDone + 1); // Preview next event, but only increment after completion

  // UI helpers
  const { createProfessionalTeamDisplay, createEnemyDisplay, createBattleLogDisplay, createProgressDisplay } = require('../utils/uiHelpers.js');
  const { calculateBattleStats, resetTeamHP } = require('../utils/battleSystem.js');
  const { distributeXPToTeam } = require('../utils/levelSystem.js');

  // Handle event types
  if (event.type === 'enemy') {
    // Use real battle system (multi-enemy support)
    const enemies = event.enemies.map(e => ({ ...e }));
    const battleTeam = calculateBattleStats(user);
    if (!battleTeam || battleTeam.length === 0) {
      return message.reply('❌ Your team is invalid or cards are missing. Please check your team with `op team` and fix any issues.');
    }
    // Initial battle log
    const battleLog = [`${enemies.length > 1 ? 'A group of enemies appear!' : 'A wild enemy appears!'}`];
    // Render battle UI with buttons
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const battleButtons = [
      new ButtonBuilder().setCustomId('sail_attack').setLabel('Attack').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('sail_items').setLabel('Items').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('sail_flee').setLabel('Flee').setStyle(ButtonStyle.Secondary)
    ];
    const row = new ActionRowBuilder().addComponents(battleButtons);
    const embed = new EmbedBuilder()
      .setTitle(`⚔️ ${event.title}`)
      .setDescription(event.desc)
      .addFields(
        { name: 'Your Crew', value: createProfessionalTeamDisplay(battleTeam, 'Your Crew'), inline: false },
        { name: 'Enemy', value: createEnemyDisplay(enemies), inline: false },
        { name: 'Battle Log', value: createBattleLogDisplay(battleLog), inline: false }
      )
      .setColor(0x3498db)
      .setFooter({ text: `Sails completed: ${sailsDone}` });
    const battleMessage = await message.reply({ embeds: [embed], components: [row] });

    // Set up collector for battle actions
    const filter = i => i.user.id === userId && i.customId.startsWith('sail_');
    const collector = battleMessage.createMessageComponentCollector({ filter, time: 120000 });

    // Minimal battle state for this encounter
    let playerTurn = true;
    let enemyArr = enemies.map(e => ({ ...e }));
    let team = battleTeam.map(card => ({ ...card }));
    let log = [...battleLog];
    let battleOver = false;

    async function updateBattleEmbed(extraLog = null) {
      const embed = new EmbedBuilder()
        .setTitle(`⚔️ ${event.title}`)
        .setDescription(event.desc)
        .addFields(
          { name: 'Your Crew', value: createProfessionalTeamDisplay(team, 'Your Crew'), inline: false },
          { name: 'Enemy', value: createEnemyDisplay(enemyArr), inline: false },
          { name: 'Battle Log', value: createBattleLogDisplay(extraLog ? [...log, extraLog] : log), inline: false }
        )
        .setColor(0x3498db)
        .setFooter({ text: `Sails completed: ${sailsDone}` });
      await battleMessage.edit({ embeds: [embed] });
    }

    // --- Items logic copied from explore ---
    async function showItemMenu(interaction) {
      // --- Use explore's item logic for consistency ---
      const { ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require('discord.js');
      const canUseInventoryItem = require('./explore.js').canUseInventoryItem;
      const useInventoryItem = require('./explore.js').useInventoryItem;
      // Only allow usable items (potions, etc)
      const usableItems = ['basicpotion', 'normalpotion', 'maxpotion'];
      const availableItems = usableItems.filter(item => canUseInventoryItem(user, item));
      if (availableItems.length === 0) {
        log.push('You have no usable items!');
        await updateBattleEmbed('You have no usable items!');
        return;
      }
      const itemLabels = {
        'basicpotion': 'Basic Potion',
        'normalpotion': 'Normal Potion',
        'maxpotion': 'Max Potion'
      };
      const itemButtons = availableItems.map(item =>
        new ButtonBuilder()
          .setCustomId(`use_${item}`)
          .setLabel(itemLabels[item] || item)
          .setStyle(ButtonStyle.Primary)
      );
      const itemRow = new ActionRowBuilder().addComponents(itemButtons.slice(0, 5));
      await battleMessage.edit({ components: [itemRow] });
      try {
        const itemFilter = i => i.user.id === userId && i.customId.startsWith('use_');
        const itemInteraction = await battleMessage.awaitMessageComponent({ filter: itemFilter, time: 15000 });
        const itemName = itemInteraction.customId.replace('use_', '');
        const effect = useInventoryItem(user, itemName);
        if (!effect) {
          log.push('Item could not be used!');
          await updateBattleEmbed('Item could not be used!');
          await battleMessage.edit({ components: [row] });
          return;
        }
        let effectText = '';
        // Apply item effects (heal, boosts)
        if (effect.type === 'heal') {
          // Heal the first injured team member
          const injuredCard = team.find(card => card.currentHp < card.maxHp && card.currentHp > 0);
          if (injuredCard) {
            const healAmount = Math.floor(injuredCard.maxHp * (effect.percent / 100));
            const actualHeal = Math.min(healAmount, injuredCard.maxHp - injuredCard.currentHp);
            injuredCard.currentHp += actualHeal;
            effectText = `Healed ${injuredCard.name} for ${actualHeal} HP (${effect.percent}% of max HP)!`;
          } else {
            effectText = `No injured crew members to heal!`;
          }
        } else if (effect.type === 'attack_boost') {
          if (!user.sailBattleBoosts) user.sailBattleBoosts = {};
          user.sailBattleBoosts.attack_boost = { amount: effect.amount, duration: effect.duration };
          effectText = `Attack increased by ${effect.amount}!`;
        } else if (effect.type === 'speed_boost') {
          if (!user.sailBattleBoosts) user.sailBattleBoosts = {};
          user.sailBattleBoosts.speed_boost = { amount: effect.amount, duration: effect.duration };
          effectText = `Speed increased by ${effect.amount}!`;
        } else if (effect.type === 'defense_boost') {
          if (!user.sailBattleBoosts) user.sailBattleBoosts = {};
          user.sailBattleBoosts.defense_boost = { amount: effect.amount, duration: effect.duration };
          effectText = `Defense increased by ${effect.amount}!`;
        }
        await saveUserWithRetry(user);
        await updateBattleEmbed(effectText);
        await battleMessage.edit({ components: [row] });
        // Continue battle (advance turn, enemy turn, etc.)
        // (You may want to add logic here to trigger the enemy turn if needed)
      } catch (e) {
        await battleMessage.edit({ components: [row] });
      }
    }

    collector.on('collect', async interaction => {
      await interaction.deferUpdate();
      if (battleOver) return;
      if (interaction.customId === 'sail_attack') {
        // Find first alive team member
        const attacker = team.find(card => card.currentHp > 0);
        if (!attacker) {
          log.push('All your crew are down!');
          battleOver = true;
          await updateBattleEmbed('All your crew are down!');
          return collector.stop('defeat');
        }
        // Attack first alive enemy
        const targetEnemy = enemyArr.find(e => e.currentHp > 0);
        if (!targetEnemy) {
          log.push('All enemies are down!');
          battleOver = true;
          await updateBattleEmbed('All enemies are down!');
          return collector.stop('victory');
        }
        // Calculate damage
        const { calculateDamage } = require('../utils/battleSystem.js');
        let dmg = calculateDamage(attacker, targetEnemy);
        targetEnemy.currentHp -= dmg;
        log.push(`${attacker.name} attacks ${targetEnemy.name} for ${dmg} damage!`);
        if (targetEnemy.currentHp <= 0) {
          log.push(`${targetEnemy.name} is defeated!`);
        }
        // Check if all enemies are defeated
        if (!enemyArr.some(e => e.currentHp > 0)) {
          log.push('All enemies are defeated!');
          battleOver = true;
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
          // INCREMENT sailsCompleted *after* successful event
          user.sailsCompleted[arc]++;
          await saveUserWithRetry(user);
          await updateBattleEmbed(`All enemies are defeated!\n**Reward:** ${rewardText}`);
          await battleMessage.edit({ components: [] });
          return collector.stop('victory');
        }
        // Enemy turn (simple, each alive enemy attacks)
        for (const enemy of enemyArr.filter(e => e.currentHp > 0)) {
          const target = team.find(card => card.currentHp > 0);
          if (target) {
            let enemyDmg = require('../utils/battleSystem.js').calculateDamage(enemy, target);
            target.currentHp -= enemyDmg;
            log.push(`${enemy.name} attacks ${target.name} for ${enemyDmg} damage!`);
            if (target.currentHp <= 0) {
              log.push(`${target.name} is knocked out!`);
            }
          }
        }
        // Check defeat
        if (!team.some(card => card.currentHp > 0)) {
          log.push('All your crew are down!');
          battleOver = true;
          await updateBattleEmbed('All your crew are down!');
          await battleMessage.edit({ components: [] });
          return collector.stop('defeat');
        }
        await updateBattleEmbed();
      } else if (interaction.customId === 'sail_flee') {
        log.push('You fled the battle!');
        battleOver = true;
        // Only increment sailsCompleted if you want fleeing to count as a completed sail (optional)
        // user.sailsCompleted[arc]++;
        await updateBattleEmbed('You fled the battle!');
        await battleMessage.edit({ components: [] });
        return collector.stop('fled');
      } else if (interaction.customId === 'sail_items') {
        await showItemMenu(interaction);
      }
    });

    collector.on('end', async () => {
      await battleMessage.edit({ components: [] });
    });
    return;
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
    // INCREMENT sailsCompleted *after* successful event
    user.sailsCompleted[arc]++;
    await saveUserWithRetry(user);
    const embed = new EmbedBuilder()
      .setTitle(`🗺️ ${event.title}`)
      .setDescription(event.desc)
      .addFields(
        { name: 'Your Crew', value: createProfessionalTeamDisplay(calculateBattleStats(user), 'Your Crew'), inline: false },
        { name: 'Reward', value: rewardText, inline: false }
      )
      .setColor(0x2ecc71)
      .setFooter({ text: `Sails completed: ${user.sailsCompleted[arc]}` });
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
        // INCREMENT sailsCompleted *after* successful event
        user.sailsCompleted[arc]++;
        await saveUserWithRetry(user);
        const resultEmbed = new EmbedBuilder()
          .setTitle('Result')
          .setDescription(`You chose **${choice}**!`)
          .addFields({ name: 'Reward', value: rewardText, inline: false })
          .setFooter({ text: `Sails completed: ${user.sailsCompleted[arc]}` });
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
