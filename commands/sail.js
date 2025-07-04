const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');
const { calculateBattleStats, calculateDamage } = require('../utils/battleSystem.js');
const { distributeXPToTeam } = require('../utils/levelSystem.js');
const { saveUserWithRetry } = require('../utils/saveWithRetry.js');
const { createProfessionalTeamDisplay, createEnemyDisplay, createBattleLogDisplay } = require('../utils/uiHelpers.js');
const itemsData = require('../data/shop.json');

const SAIL_UNLOCK_SAGA = 'East Blue';
const SAIL_SAGA_LIST = ['East Blue'];

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
function getRandomHighRarityItem() {
  const high = itemsData.filter(i => ['Rare', 'Epic', 'Legendary'].includes(i.rarity));
  if (!high.length) return 'Rare Potion';
  return high[getRandomInt(0, high.length - 1)].name;
}

function getSailEvent(sailsCompleted) {
  if (sailsCompleted <= 5) {
    return {
      type: 'enemy',
      title: 'Navy Patrol',
      desc: 'A lone Navy Soldier blocks your way.',
      enemies: [{ name: 'Navy Soldier', hp: 30, atk: [5, 10], spd: 30, rank: 'C', currentHp: 30, maxHp: 30 }],
      reward: { type: 'multiple', rewards: [ { type: 'beli', amount: getRandomInt(5, 10) }, { type: 'xp', amount: getRandomInt(1, 5) } ] }
    };
  }
  if (sailsCompleted <= 10) {
    return {
      type: 'enemy',
      title: 'Stronger Navy',
      desc: 'A stronger Navy officer appears!',
      enemies: [{ name: 'Navy Officer', hp: 50, atk: [10, 15], spd: 40, rank: 'C', currentHp: 50, maxHp: 50 }],
      reward: { type: 'multiple', rewards: [ { type: 'beli', amount: getRandomInt(10, 50) }, { type: 'xp', amount: getRandomInt(5, 10) } ] }
    };
  }
  if (sailsCompleted <= 20) {
    const count = getRandomInt(1, 3);
    return {
      type: 'enemy',
      title: 'Navy Squad',
      desc: 'A squad of Navy Soldiers surrounds you!',
      enemies: Array.from({ length: count }, () => ({ name: 'Navy Soldier', hp: 100, atk: [15, 20], spd: 50, rank: 'B', currentHp: 100, maxHp: 100 })),
      reward: { type: 'multiple', rewards: [ { type: 'beli', amount: getRandomInt(50, 100) }, { type: 'xp', amount: getRandomInt(10, 15) }, { type: 'item', name: getRandomCommonItem() } ] }
    };
  }
  if (sailsCompleted <= 50) {
    const count = getRandomInt(1, 3);
    return {
      type: 'enemy',
      title: 'Navy Blockade',
      desc: 'A blockade of Navy ships tries to stop you!',
      enemies: Array.from({ length: count }, () => ({ name: 'Navy Enforcer', hp: getRandomInt(100, 300), atk: [20, 30], spd: 60, rank: 'A', currentHp: 200, maxHp: 200 })),
      reward: { type: 'multiple', rewards: [ { type: 'beli', amount: getRandomInt(100, 250) }, { type: 'xp', amount: getRandomInt(10, 20) }, { type: 'item', name: getRandomUncommonItem() } ] }
    };
  }
  const count = getRandomInt(2, 4);
  return {
    type: 'enemy',
    title: 'Elite Navy Assault',
    desc: 'Elite Navy officers attack with full force!',
    enemies: Array.from({ length: count }, () => ({ name: 'Elite Navy', hp: getRandomInt(200, 500), atk: [30, 50], spd: 80, rank: 'S', currentHp: 400, maxHp: 400 })),
    reward: { type: 'multiple', rewards: [ { type: 'beli', amount: getRandomInt(250, 500) }, { type: 'xp', amount: getRandomInt(15, 30) }, { type: 'item', name: getRandomHighRarityItem() } ] }
  };
}

function canUseInventoryItem(user, itemName) {
  if (!user.inventory) return false;
  const normalized = itemName.replace(/\s+/g, '').toLowerCase();
  return user.inventory.some(item => item.replace(/\s+/g, '').toLowerCase() === normalized);
}
function useInventoryItem(user, itemName) {
  if (!canUseInventoryItem(user, itemName)) return null;
  const normalized = itemName.replace(/\s+/g, '').toLowerCase();
  const idx = user.inventory.findIndex(item => item.replace(/\s+/g, '').toLowerCase() === normalized);
  if (idx === -1) return null;
  user.inventory.splice(idx, 1);
  const effects = {
    'basicpotion': { type: 'heal', percent: 10 },
    'normalpotion': { type: 'heal', percent: 20 },
    'maxpotion': { type: 'heal', percent: 30 }
  };
  return effects[normalized] || null;
}

const data = {
  name: 'sail',
  description: 'Infinite grind mode: Sail an arc for endless rewards!'
};

async function execute(message, args, client) {
  const userId = message.author.id;
  let user = await User.findOne({ userId });
  if (!user) return message.reply('Start your journey with `op start`!');
  if (!user.completedSagas || !user.completedSagas.includes(SAIL_UNLOCK_SAGA)) {
    if (typeof user.stage !== 'number' || user.stage < 42) {
      return message.reply('You must complete the full saga (defeat Arlong in East Blue) to unlock infinite sail mode!');
    } else {
      if (!user.completedSagas) user.completedSagas = [];
      user.completedSagas.push(SAIL_UNLOCK_SAGA);
      user = await saveUserWithRetry(user);
    }
  }
  // Progress tracking
  if (!user.sailsCompleted) user.sailsCompleted = {};
  const arc = SAIL_SAGA_LIST[0];
  if (!user.sailsCompleted[arc]) user.sailsCompleted[arc] = 0;
  const sailsDone = user.sailsCompleted[arc];
  // Team validation
  if (!user.team || user.team.length === 0) return message.reply('❌ You need to set up your team first! Use `op team add <card>` to add cards to your team.');
  if (!user.cards || user.cards.length === 0) return message.reply('❌ You don\'t have any cards! Pull some cards first with `op pull`.');
  let battleTeam = calculateBattleStats(user);
  if (!battleTeam || battleTeam.length === 0) return message.reply('❌ Your team is invalid or cards are missing. Please check your team with `op team` and fix any issues.');
  // Ensure team HP
  battleTeam.forEach(card => {
    if (!card.currentHp || card.currentHp <= 0) card.currentHp = card.hp || card.maxHp || 100;
    if (!card.maxHp) card.maxHp = card.hp || 100;
  });
  if (battleTeam.every(card => card.currentHp <= 0)) return message.reply('❌ Your team has no health! Please check your cards or try again.');
  // Stateful battle logic
  if (!user.sailStates) user.sailStates = {};
  if (user.sailStates.inBattle && user.sailStates.battleState) {
    return await displaySailBattle(message, user, client);
  }
  // Start new event
  const event = getSailEvent(sailsDone + 1);
  const enemies = event.enemies.map(e => ({ ...e }));
  user.sailStates.battleState = {
    userTeam: battleTeam,
    enemies: enemies,
    turn: 1,
    userBoosts: {},
    event
  };
  user.sailStates.inBattle = true;
  await saveUserWithRetry(user);
  return await displaySailBattle(message, user, client);
}

async function displaySailBattle(message, user, client) {
  const battleState = user.sailStates.battleState;
  if (!battleState) {
    user.sailStates.inBattle = false;
    user.sailStates.battleState = null;
    await saveUserWithRetry(user);
    return message.reply('❌ Battle state corrupted. Please try sailing again.');
  }
  const embed = new EmbedBuilder()
    .setTitle(battleState.event.title)
    .setDescription(battleState.event.desc)
    .setColor(0x2b2d31)
    .addFields(
      { name: 'Your Crew', value: createProfessionalTeamDisplay(battleState.userTeam, message.author.username), inline: false },
      { name: 'Enemies', value: createEnemyDisplay(battleState.enemies), inline: false },
      { name: 'Battle Log', value: createBattleLogDisplay([]), inline: false }
    );
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sail_attack').setLabel('Attack').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('sail_items').setLabel('Items').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sail_flee').setLabel('Flee').setStyle(ButtonStyle.Secondary)
  );
  // Always send a new message for the initial battle, and only update it after
  const battleMessage = await message.reply({ embeds: [embed], components: [row] });
  const filter = i => i.user.id === message.author.id;
  const collector = battleMessage.createMessageComponentCollector({ filter, time: 300000 });
  let battleLog = [];
  collector.on('collect', async interaction => {
    await interaction.deferUpdate();
    let freshUser = await User.findOne({ userId: message.author.id });
    if (!freshUser || !freshUser.sailStates || !freshUser.sailStates.battleState) return;
    let state = freshUser.sailStates.battleState;
    if (interaction.customId === 'sail_attack') {
      // Player attacks
      const attacker = state.userTeam.find(card => card.currentHp > 0);
      const targetEnemy = state.enemies.find(e => e.currentHp > 0);
      if (!attacker || !targetEnemy) return;
      let dmg = calculateDamage(attacker, targetEnemy);
      targetEnemy.currentHp = Math.max(0, targetEnemy.currentHp - dmg);
      battleLog.push(`${attacker.name} attacks ${targetEnemy.name} for ${dmg} damage!`);
      if (targetEnemy.currentHp <= 0) battleLog.push(`${targetEnemy.name} is defeated!`);
      // Check victory
      if (state.enemies.every(e => e.currentHp <= 0)) {
        battleLog.push('All enemies are defeated!');
        // Rewards
        let rewardText = '';
        if (state.event.reward) {
          if (state.event.reward.type === 'multiple') {
            for (const r of state.event.reward.rewards) {
              if (r.type === 'beli') freshUser.beli = (freshUser.beli || 0) + r.amount;
              if (r.type === 'xp') distributeXPToTeam(freshUser, r.amount);
              if (r.type === 'item') {
                if (!freshUser.inventory) freshUser.inventory = [];
                freshUser.inventory.push(r.name);
              }
            }
            rewardText = state.event.reward.rewards.map(r => `${r.type === 'beli' ? '💰' : r.type === 'xp' ? '⭐' : '🎁'} ${r.amount || r.name}`).join('  ');
          }
        }
        if (!freshUser.sailsCompleted) freshUser.sailsCompleted = {};
        freshUser.sailsCompleted[SAIL_SAGA_LIST[0]] = (freshUser.sailsCompleted[SAIL_SAGA_LIST[0]] || 0) + 1;
        freshUser.sailStates.inBattle = false;
        freshUser.sailStates.battleState = null;
        await saveUserWithRetry(freshUser);
        await battleMessage.edit({ embeds: [embed.setDescription('All enemies are defeated!\n**Reward:** ' + rewardText)], components: [] });
        return collector.stop('victory');
      }
      // Enemy turn
      for (const enemy of state.enemies.filter(e => e.currentHp > 0)) {
        const target = state.userTeam.find(card => card.currentHp > 0);
        if (target) {
          let enemyDmg = calculateDamage(enemy, target);
          target.currentHp = Math.max(0, target.currentHp - enemyDmg);
          battleLog.push(`${enemy.name} attacks ${target.name} for ${enemyDmg} damage!`);
          if (target.currentHp <= 0) battleLog.push(`${target.name} is knocked out!`);
        }
      }
      await saveUserWithRetry(freshUser);
      const updatedEmbed = new EmbedBuilder()
        .setTitle(state.event.title)
        .setDescription(state.event.desc)
        .setColor(0x2b2d31)
        .addFields(
          { name: 'Your Crew', value: createProfessionalTeamDisplay(state.userTeam, message.author.username), inline: false },
          { name: 'Enemies', value: createEnemyDisplay(state.enemies), inline: false },
          { name: 'Battle Log', value: createBattleLogDisplay(battleLog.slice(-5)), inline: false }
        );
      await battleMessage.edit({ embeds: [updatedEmbed], components: [row] });
    } else if (interaction.customId === 'sail_items') {
      const usableItems = ['basicpotion', 'normalpotion', 'maxpotion'];
      const availableItems = usableItems.filter(item => canUseInventoryItem(freshUser, item));
      if (availableItems.length === 0) {
        await battleMessage.edit({ components: [row] });
        return;
      }
      const itemLabels = {
        'basicpotion': 'Basic Potion',
        'normalpotion': 'Normal Potion',
        'maxpotion': 'Max Potion'
      };
      const itemButtons = availableItems.map(item =>
        new ButtonBuilder().setCustomId(`use_${item}`).setLabel(itemLabels[item] || item).setStyle(ButtonStyle.Primary)
      );
      const itemRow = new ActionRowBuilder().addComponents(itemButtons.slice(0, 5));
      await battleMessage.edit({ components: [itemRow] });
      try {
        const itemFilter = i => i.user.id === message.author.id && i.customId.startsWith('use_');
        const itemInteraction = await battleMessage.awaitMessageComponent({ filter: itemFilter, time: 15000 });
        const itemName = itemInteraction.customId.replace('use_', '');
        const effect = useInventoryItem(freshUser, itemName);
        let effectText = '';
        if (effect && effect.type === 'heal') {
          const injuredCard = state.userTeam.find(card => card.currentHp < card.maxHp && card.currentHp > 0);
          if (injuredCard) {
            const healAmount = Math.floor(injuredCard.maxHp * (effect.percent / 100));
            const actualHeal = Math.min(healAmount, injuredCard.maxHp - injuredCard.currentHp);
            injuredCard.currentHp += actualHeal;
            effectText = `Healed ${injuredCard.name} for ${actualHeal} HP (${effect.percent}% of max HP)!`;
          } else {
            effectText = `No injured crew members to heal!`;
          }
        } else {
          effectText = 'Item could not be used!';
        }
        await saveUserWithRetry(freshUser);
        const updatedEmbed = new EmbedBuilder()
          .setTitle(state.event.title)
          .setDescription(state.event.desc)
          .setColor(0x2b2d31)
          .addFields(
            { name: 'Your Crew', value: createProfessionalTeamDisplay(state.userTeam, message.author.username), inline: false },
            { name: 'Enemies', value: createEnemyDisplay(state.enemies), inline: false },
            { name: 'Battle Log', value: createBattleLogDisplay([effectText]), inline: false }
          );
        await battleMessage.edit({ embeds: [updatedEmbed], components: [row] });
      } catch (e) {
        await battleMessage.edit({ components: [row] });
      }
    } else if (interaction.customId === 'sail_flee') {
      freshUser.sailStates.inBattle = false;
      freshUser.sailStates.battleState = null;
      await saveUserWithRetry(freshUser);
      const fleeEmbed = new EmbedBuilder()
        .setTitle('🏃‍♂️ Fled from Battle!')
        .setDescription('You successfully escaped from the battle.')
        .setColor(0x95a5a6);
      await battleMessage.edit({ embeds: [fleeEmbed], components: [] });
      return collector.stop('fled');
    }
  });
  collector.on('end', async (_collected, reason) => {
    if (reason !== 'victory' && reason !== 'fled') {
      await battleMessage.edit({ components: [] });
      let freshUser = await User.findOne({ userId: message.author.id });
      if (freshUser && freshUser.sailStates && freshUser.sailStates.inBattle) {
        freshUser.sailStates.inBattle = false;
        freshUser.sailStates.battleState = null;
        await saveUserWithRetry(freshUser);
      }
    }
  });
}

module.exports = { data, execute };
