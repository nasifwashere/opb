const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');

// Updated: Use "strawhat" (no spaces) as the item name!
const ROMANCE_DAWN_STAGES = [
  { type: "narrative", title: "Start of the Grand Adventure", desc: "You set sail for the first time and land at Romance Dawn. The sea breeze tastes like freedom. Your journey begins!" },
  { type: "item", title: "You Received the Strawhat!", desc: "A mysterious hat is gifted to you. All Luffy cards gain +30% stats!", effect: "strawhat" },
  { type: "random", pool: [
      "You find a pouch of **50 Beli** hidden under a barrel.",
      "A villager shares a rumor about a treasure chest on the beach.",
      "You stumble upon an old map fragment (it crumbles to dust...).",
      "You help a child find their cat and gain goodwill.",
      "You discover a rare seashell. It's pretty, but not valuable.",
    ],
    rewards: [
      { type: "beli", amount: 50 },
      { type: "none" },
      { type: "none" },
      { type: "none" },
      { type: "none" },
      { type: "none" },
    ],
  },
  { type: "card", title: "Recruit: Coby", desc: "You meet and recruit **Coby**! He's now part of your crew.", card: { name: "Coby", rank: "C" } },
  { type: "boss", title: "Boss Battle: Pirate Captain Alvida", desc: "Alvida appears! Prepare for battle.", boss: { name: "Alvida", hp: 180, atk: [18, 32], spd: 70, rank: "B" }, reward: { type: "beli", amount: 150, xp: 75 }, loseCooldown: 60 * 60 * 1000 },
  { type: "narrative", title: "Sail to Shell Town", desc: "Your crew sails to Shell Town. On the way you experience random events.", pool: [
      "A friendly dolphin follows your ship.",
      "You find a floating bottle with an unreadable message.",
      "You share stories with your crew under the stars.",
      "A sudden rainstorm washes the deck clean.",
    ],
  },
  { type: "card", title: "Recruit: Zoro", desc: "The swordsman **Zoro** joins your team! His presence inspires confidence.", card: { name: "Zoro", rank: "C" } },
  { type: "boss", title: "Boss Battle: Captain Morgan", desc: "Axe-Hand Morgan blocks your path!", boss: { name: "Captain Morgan", hp: 220, atk: [22, 38], spd: 75, rank: "B" }, reward: { type: "beli", amount: 200, xp: 100 }, loseCooldown: 45 * 60 * 1000 },
  { type: "random", pool: [
      "You gain **25 XP** after a training session.",
      "You find **20 Beli** in a hidden drawer.",
      "A merchant gifts you a lucky charm.",
      "A crewmate gives you a high five.",
    ],
    rewards: [
      { type: "xp", amount: 25 },
      { type: "beli", amount: 20 },
      { type: "item", name: "Lucky Charm" },
      { type: "none" },
    ],
  },
  { type: "card", title: "Recruit: Nami", desc: "The navigator **Nami** joins your crew! Her map skills will be invaluable.", card: { name: "Nami", rank: "C" } },
  { type: "boss", title: "Boss Battle: Captain Kuro", desc: "The cunning Captain Kuro emerges from the shadows!", boss: { name: "Captain Kuro", hp: 280, atk: [25, 42], spd: 95, rank: "A" }, reward: { type: "beli", amount: 300, xp: 150 }, loseCooldown: 90 * 60 * 1000 },
  { type: "narrative", title: "Journey to Baratie", desc: "Your crew sets sail for the floating restaurant Baratie. The Grand Line calls!", pool: ["The sea grows rougher as you approach.", "Seagulls guide your ship forward.", "Your crew shares a meal together."] },
  { type: "boss", title: "Boss Battle: Don Krieg", desc: "The armored pirate Don Krieg challenges your crew!", boss: { name: "Don Krieg", hp: 350, atk: [28, 48], spd: 80, rank: "A" }, reward: { type: "beli", amount: 400, xp: 200 }, loseCooldown: 120 * 60 * 1000 },
  { type: "card", title: "Recruit: Sanji", desc: "The chef **Sanji** joins your crew! His fighting spirit burns bright.", card: { name: "Sanji", rank: "B" } },
  { type: "narrative", title: "Arlong Park Awaits", desc: "The final challenge of East Blue saga approaches. Arlong Park looms ahead.", pool: ["The water grows darker.", "Fish-men patrol the area.", "Your resolve strengthens."] },
  { type: "boss", title: "Boss Battle: Arlong", desc: "The fish-man Arlong stands in your way! This is the ultimate test!", boss: { name: "Arlong", hp: 450, atk: [35, 58], spd: 85, rank: "S" }, reward: { type: "beli", amount: 750, xp: 300 }, loseCooldown: 180 * 60 * 1000, unlocksSaga: "Grand Line" }
];

// Always stores item as lowercase, no spaces
function normalizeItemName(item) {
  return item.replace(/\s+/g, '').toLowerCase();
}

function addToInventory(user, item) {
  if (!user.inventory) user.inventory = [];
  const normItem = normalizeItemName(item);
  if (!user.inventory.map(normalizeItemName).includes(normItem)) user.inventory.push(normItem);
}
function addXP(user, amount) {
  // Check for XP boost
  const xpBoost = user.activeBoosts?.find(boost => 
    boost.type === 'double_xp' && boost.expiresAt > Date.now()
  );

  const finalAmount = xpBoost ? amount * 2 : amount;
  user.xp = (user.xp || 0) + finalAmount;
}
const EXPLORE_COOLDOWN = 2 * 60 * 1000;
function prettyTime(ms) {
  let seconds = Math.floor(ms / 1000);
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);
  minutes = minutes % 60;
  seconds = seconds % 60;
  let out = [];
  if (hours > 0) out.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (minutes > 0) out.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
  if (out.length === 0) out.push(`${seconds} seconds`);
  return out.join(", ");
}

function createBossBattleEmbed(boss, playerTeam, battleLog, turn) {
  const embed = new EmbedBuilder()
    .setTitle(`⚔️ Boss Battle: ${boss.name}`)
    .setColor(0xe74c3c);

  // Boss stats
  const bossHpBar = createHpBar(boss.currentHp, boss.hp);
  embed.addFields({
    name: `${boss.name} (${boss.rank} Rank)`,
    value: `HP: ${bossHpBar} ${boss.currentHp}/${boss.hp}\nATK: ${boss.attack[0]}-${boss.attack[1]} | SPD: ${boss.speed}`,
    inline: false
  });

  // Player team
  let teamText = '';
  playerTeam.forEach(card => {
    const hpBar = createHpBar(card.currentHp, card.hp);
    teamText += `**${card.name}** (Lv.${card.level})\nHP: ${hpBar} ${card.currentHp}/${card.hp}\n\n`;
  });

  embed.addFields({
    name: '🏴‍☠️ Your Team',
    value: teamText || 'No team members',
    inline: false
  });

  // Battle log
  if (battleLog.length > 0) {
    const recentLog = battleLog.slice(-3).join('\n');
    embed.addFields({
      name: '⚔️ Battle Log',
      value: recentLog,
      inline: false
    });
  }

  embed.setFooter({ text: `Turn ${turn} | Choose your action!` });
  return embed;
}

function createBossBattleButtons(disabled = false) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('boss_attack')
      .setLabel('⚔️ Attack')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('boss_skill')
      .setLabel('💫 Special Attack')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('boss_defend')
      .setLabel('🛡️ Defend')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('boss_flee')
      .setLabel('🏃 Flee')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled)
  );

  return [row1, row2];
}

function createHpBar(current, max) {
  const percentage = current / max;
  const barLength = 10;
  const filledBars = Math.round(percentage * barLength);
  const emptyBars = barLength - filledBars;
   return '█'.repeat(filledBars) + '░'.repeat(emptyBars);
}

// Change this to your Discord user ID for immunity
const IMMUNE_USER_ID = "1257718161298690119"; // nasif-cloud

const data = { name: "explore", description: "Begin or continue your adventure in Romance Dawn Saga!" };

async function execute(message, args, client) {
  const userId = message.author.id;

  // --- MOD COMMAND: op explore reset me ---
  if (args.length >= 1 && args[0] === 'reset' && args[1] === 'me') {
    let user = await User.findOne({ userId });
    if (!user) return message.reply("User not found.");
    user.exploreStage = 0;
    user.exploreLast = 0;
    user.exploreLossCooldown = 0;
    await user.save();
    return message.reply("✅ Your exploration progress has been reset!");
  }

  let user = await User.findOne({ userId });
  if (!user) return message.reply("Start your journey with `op start` first!");

  // --- Ensure fields exist and are numbers ---
  user.exploreStage = Number(user.exploreStage) || 0;
  user.exploreLast = Number(user.exploreLast) || 0;
  user.exploreLossCooldown = Number(user.exploreLossCooldown) || 0;

  let stage = user.exploreStage;
  const now = Date.now();

  // ---- IMMUNITY TO COOLDOWNS FOR YOU ----
  const immune = userId === IMMUNE_USER_ID;

  // Cooldown/loss checks (bypass if immune)
  if (!immune && user.exploreLossCooldown && now < user.exploreLossCooldown) {
    const left = prettyTime(user.exploreLossCooldown - now);
    return message.reply(`You are recovering from defeat! Try exploring again in ${left}.`);
  }
  if (!immune && now - user.exploreLast < EXPLORE_COOLDOWN && stage > 0) {
    const left = prettyTime(EXPLORE_COOLDOWN - (now - user.exploreLast));
    return message.reply(`⏳ You must wait ${left} before exploring again.`);
  }
  if (stage >= ROMANCE_DAWN_STAGES.length) {
    return message.reply("You've finished the Romance Dawn arc! Use `op explore` again when the next saga unlocks.");
  }

  const stageData = ROMANCE_DAWN_STAGES[stage];
  let blockProgress = false;

  // --- STAGE HANDLERS ---
  if (stageData.type === "narrative") {
    let flavor = stageData.pool
      ? stageData.pool[Math.floor(Math.random() * stageData.pool.length)]
      : "";
    await message.reply({
      embeds: [new EmbedBuilder()
        .setTitle(stageData.title)
        .setDescription(`${stageData.desc}${flavor ? "\n" + flavor : ""}`)
        .setColor(0x3498db)
      ]
    });
  }
  else if (stageData.type === "item" && stageData.effect === "strawhat") {
    addToInventory(user, "strawhat");
    await message.reply({
      embeds: [new EmbedBuilder()
        .setTitle(stageData.title)
        .setDescription(`${stageData.desc}\n*Strawhat added to your inventory*`)
        .setColor(0xffe700)
      ]
    });
  }
  else if (stageData.type === "random") {
    const idx = Math.floor(Math.random() * stageData.pool.length);
    const flavor = stageData.pool[idx];
    const reward = stageData.rewards && stageData.rewards[idx];
    let rewardText = "";
    if (reward) {
      if (reward.type === "beli") {
        user.beli = (user.beli || 0) + reward.amount;
        rewardText = `\n+${reward.amount} Beli!`;
      } else if (reward.type === "xp") {
        addXP(user, reward.amount);
        rewardText = `\n+${reward.amount} XP!`;
      } else if (reward.type === "item") {
        addToInventory(user, normalizeItemName(reward.name));
        rewardText = `\nItem acquired: ${normalizeItemName(reward.name)}`;
      }
    }
    await message.reply({
      embeds: [new EmbedBuilder()
        .setTitle("Event")
        .setDescription(flavor + rewardText)
        .setColor(0x2ecc40)
      ]
    });
  }
  else if (stageData.type === "card") {
    if (!user.cards) user.cards = [];
    if (!user.cards.find(c => c.name === stageData.card.name)) {
      user.cards.push({
        name: stageData.card.name,
        rank: stageData.card.rank,
        timesUpgraded: 0
      });
    }
    await message.reply({
      embeds: [new EmbedBuilder()
        .setTitle(stageData.title)
        .setDescription(stageData.desc)
        .setColor(0x9b59b6)
      ]
    });
  }
  else if (stageData.type === "boss") {
    if (!user.team || !user.team.length) {
      blockProgress = true;
      await message.reply({
        embeds: [new EmbedBuilder()
          .setTitle("⚠️ You need a team!")
          .setDescription("You must add at least one card to your team to challenge the boss. Use `op team add <card>`.")
          .setColor(0xe74c3c)
        ]
      });
    } else {
      // Start interactive boss battle
      const { calculateBattleStats } = require('../utils/battleSystem.js');
      const playerTeam = calculateBattleStats(user);

      if (playerTeam.length === 0) {
        blockProgress = true;
        return message.reply({
          embeds: [new EmbedBuilder()
            .setTitle("⚠️ No valid team members!")
            .setDescription("Your team cards couldn't be loaded. Add cards to your team first.")
            .setColor(0xe74c3c)
          ]
        });
      }

      const boss = {
        name: stageData.boss.name,
        hp: stageData.boss.hp,
        currentHp: stageData.boss.hp,
        attack: stageData.boss.atk,
        speed: stageData.boss.spd,
        rank: stageData.boss.rank || 'B'
      };

      const battleEmbed = createBossBattleEmbed(boss, playerTeam, [], 1);
      const battleButtons = createBossBattleButtons();

      const battleMessage = await message.reply({
        embeds: [battleEmbed],
        components: battleButtons
      });

      // Store battle state
      const battleData = {
        boss,
        playerTeam,
        battleLog: [],
        turn: 1,
        userId: user.userId,
        stageData,
        exploreBattle: true
      };

      // Store in memory for interaction handling
      if (!client.battles) client.battles = new Map();
      client.battles.set(battleMessage.id, battleData);

      // Auto-cleanup after 5 minutes
      setTimeout(() => {
        if (client.battles && client.battles.has(battleMessage.id)) {
          client.battles.delete(battleMessage.id);
        }
      }, 5 * 60 * 1000);

      return; // Don't continue explore progression until battle is resolved
    }
  }
  else if (stageData.type === "battle") {
    let enemy = { ...stageData.enemy, curHp: stageData.enemy.hp };
    let battleLog = `**${enemy.name}**\nHP: ${enemy.curHp}\nATK: ${enemy.atk[0]}–${enemy.atk[1]}\nSPD: ${enemy.spd}\n\nYou fight Helmeppo!`;
    let playerWins = Math.random() > 0.25;
    if (!playerWins) {
      await message.reply({
        embeds: [new EmbedBuilder()
          .setTitle(`Duel: ${enemy.name} – Draw`)
          .setDescription(`${battleLog}\n\nNo reward this time, but you can try again immediately!`)
          .setColor(0xf1c40f)
        ]
      });
    } else {
      user.beli = (user.beli || 0) + (stageData.reward?.amount || 0);
      await message.reply({
        embeds: [new EmbedBuilder()
          .setTitle(`Duel: ${enemy.name} – Victory!`)
          .setDescription(`${battleLog}\n\nReward: +${stageData.reward?.amount || 0} Beli.`)
          .setColor(0x27ae60)
        ]
      });
    }
  }

  // --- PROGRESSION ---
  if (!blockProgress) {
    // Update quest progress
    const { updateQuestProgress } = require('../utils/questSystem.js');

    if (stageData.type === "battle" || stageData.type === "boss") {
      await updateQuestProgress(user, 'battle_win', 1);
    }

    await updateQuestProgress(user, 'explore', 1);

    user.exploreStage = Number(stage) + 1;
    user.exploreLast = immune ? 0 : now;
    user.exploreLossCooldown = 0;
    await user.save();
  } else {
    await user.save();
  }
}

module.exports = { data, execute };