const { EmbedBuilder } = require('discord.js');
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
    ],
  },
  { type: "card", title: "Recruit: Coby", desc: "You meet and recruit **Coby**! He's now part of your crew.", card: { name: "Coby", rank: "C" } },
  { type: "boss", title: "Boss Battle: Pirate Captain Alvida", desc: "Alvida appears! Prepare for battle.", boss: { name: "Alvida", hp: 100, atk: [10, 20], spd: 50 }, reward: { type: "beli", amount: 100, rank: "C" }, loseCooldown: 60 * 60 * 1000 },
  { type: "narrative", title: "Sail to Shell Town", desc: "Your crew sails to Shell Town. On the way you experience random events.", pool: [
      "A friendly dolphin follows your ship.",
      "You find a floating bottle with an unreadable message.",
      "You share stories with your crew under the stars.",
      "A sudden rainstorm washes the deck clean.",
    ],
  },
  { type: "card", title: "Recruit: Zoro", desc: "The swordsman **Zoro** joins your team! His presence inspires confidence.", card: { name: "Zoro", rank: "C" } },
  { type: "battle", title: "Duel: Helmeppo", desc: "You challenge Helmeppo to a duel!", enemy: { name: "Helmeppo", hp: 50, atk: [5, 10], spd: 20 }, reward: { type: "beli", amount: 30 }, loseCooldown: 0 },
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
  { type: "boss", title: "Boss Battle: Axe-Hand Morgan", desc: "The final challenge of Romance Dawn! Axe-Hand Morgan blocks your path.", boss: { name: "Axe-Hand Morgan", hp: 150, atk: [12, 22], spd: 65, rank: "C" }, reward: { type: "beli", amount: 100 }, loseCooldown: 60 * 60 * 1000, unlocksSaga: "Orange Town" }
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
  user.xp = (user.xp || 0) + amount;
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
      let boss = { ...stageData.boss, curHp: stageData.boss.hp };
      let battleLog = `**${boss.name}**\nHP: ${boss.curHp}\nATK: ${boss.atk[0]}–${boss.atk[1]}\nSPD: ${boss.spd}\n\nYou and your team face off!`;
      let playerWins = Math.random() > 0.35;
      if (!playerWins) {
        if (!immune) user.exploreLossCooldown = now + (stageData.loseCooldown || 60 * 60 * 1000);
        await user.save();
        await message.reply({
          embeds: [new EmbedBuilder()
            .setTitle(`Boss Battle: ${boss.name} – Defeat`)
            .setDescription(`${battleLog}\n\nYou lost the fight! Rest and try again in 1 hour.`)
            .setColor(0xe74c3c)
          ]
        });
        return;
      } else {
        user.beli = (user.beli || 0) + (stageData.reward?.amount || 0);
        await message.reply({
          embeds: [new EmbedBuilder()
            .setTitle(`Boss Battle: ${boss.name} – Victory!`)
            .setDescription(`${battleLog}\n\nYou won! Rewards: +${stageData.reward?.amount || 0} Beli.`)
            .setColor(0x27ae60)
          ]
        });
      }
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
    user.exploreStage = Number(stage) + 1;
    user.exploreLast = immune ? 0 : now;
    user.exploreLossCooldown = 0;
    await user.save();
  } else {
    await user.save();
  }
}


module.exports = { data, execute };