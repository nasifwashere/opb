const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');

// Location data based on your specifications
const LOCATIONS = {
  'WINDMILL VILLAGE': [
    { 
      type: "narrative", 
      title: "Your Journey Commences", 
      desc: "You ate the Gum-Gum Fruit! Your rubber powers awaken as your adventure begins in Windmill Village.",
      reward: { type: "xp", amount: 50 }
    },
    { 
      type: "narrative", 
      title: "Meeting Shanks", 
      desc: "You encounter the legendary Red-Haired Shanks at the bar. His presence fills you with determination.",
      reward: { type: "beli", amount: 50 }
    },
    { 
      type: "narrative", 
      title: "Set Out to Sea", 
      desc: "You prepare to leave Windmill Village behind and chase your dream of becoming Pirate King!",
      reward: { type: "xp", amount: 25 }
    },
    { 
      type: "boss", 
      title: "Fight with Higuma", 
      desc: "The mountain bandit Higuma blocks your path!",
      enemy: { name: "Higuma", hp: 75, atk: [10, 12], spd: 50, rank: "C" },
      reward: { type: "multiple", rewards: [
        { type: "beli", amount: 100 },
        { type: "xp", amount: 50 }
      ]},
      loseCooldown: 60 * 60 * 1000
    },
    { 
      type: "narrative", 
      title: "Shanks' Sacrifice", 
      desc: "The Sea King attacks! Shanks loses his arm saving you. His sacrifice strengthens your resolve.",
      reward: { type: "item", name: "Straw Hat" }
    },
    { 
      type: "narrative", 
      title: "Arrived at Romance Dawn", 
      desc: "You finally arrive at Romance Dawn Island, ready to begin your grand adventure!",
      reward: { type: "beli", amount: 75 }
    }
  ],
  'SHELLS TOWN': [
    { 
      type: "narrative", 
      title: "Meet Coby", 
      desc: "You encounter the timid Coby, who dreams of becoming a Marine. He tells you about the famous pirate hunter Zoro.",
      reward: { type: "xp", amount: 30 }
    },
    { 
      type: "choice", 
      title: "Free Zoro?", 
      desc: "You find Zoro tied up in the Marine base courtyard. Do you want to free the legendary pirate hunter?",
      choice: { 
        yes: { type: "card", name: "Roronoa Zoro", rank: "C" },
        no: { type: "beli", amount: 25 }
      }
    },
    { 
      type: "enemy", 
      title: "Fight Helmeppo", 
      desc: "The spoiled Marine captain's son challenges you!",
      enemy: { name: "Helmeppo", hp: 20, atk: [1, 2], spd: 30, rank: "D" },
      reward: { type: "multiple", rewards: [
        { type: "beli", amount: 50 },
        { type: "xp", amount: 25 }
      ]},
      loseCooldown: 30 * 60 * 1000
    },
    { 
      type: "multi_enemy", 
      title: "Fight Marine Squad", 
      desc: "Three Marines block your escape!",
      enemies: [
        { name: "Marine Grunt #1", hp: 15, atk: [2, 4], spd: 25, rank: "D" },
        { name: "Marine Grunt #2", hp: 15, atk: [2, 4], spd: 25, rank: "D" },
        { name: "Marine Grunt #3", hp: 15, atk: [2, 4], spd: 25, rank: "D" }
      ],
      reward: { type: "multiple", rewards: [
        { type: "beli", amount: 75 },
        { type: "xp", amount: 40 }
      ]},
      loseCooldown: 45 * 60 * 1000
    },
    { 
      type: "narrative", 
      title: "Gathering Strength", 
      desc: "You and your crew prepare for the upcoming battle against Captain Morgan.",
      reward: { type: "item", name: "Marine Sword" }
    },
    { 
      type: "boss", 
      title: "Captain Morgan", 
      desc: "The tyrannical Axe-Hand Morgan appears to stop you!",
      enemy: { name: "Captain Morgan", hp: 100, atk: [12, 15], spd: 60, rank: "C" },
      reward: { type: "beli", amount: 200, xp: 100 },
      loseCooldown: 60 * 60 * 1000
    },
    { 
      type: "narrative", 
      title: "Reached Orange Town", 
      desc: "With Morgan defeated, you sail toward Orange Town where new adventures await.",
      reward: { type: "beli", amount: 100 }
    }
  ],
  'ORANGE TOWN': [
    { 
      type: "narrative", 
      title: "Meet Nami", 
      desc: "You encounter a clever orange-haired thief named Nami. She seems interested in your crew but remains cautious.",
      reward: { type: "xp", amount: 40 }
    },
    { 
      type: "narrative", 
      title: "Buggy's Terror", 
      desc: "The town is in chaos! Buggy the Clown's crew has been terrorizing the innocent villagers.",
      reward: { type: "beli", amount: 60 }
    },
    { 
      type: "narrative", 
      title: "Planning the Attack", 
      desc: "You devise a strategy to take down Buggy's crew and free the town from their reign of terror.",
      reward: { type: "item", name: "Town Map" }
    },
    { 
      type: "narrative", 
      title: "Circus Preparation", 
      desc: "Buggy's crew prepares for their deadly circus performance. The tension in the air is thick.",
      reward: { type: "xp", amount: 35 }
    },
    { 
      type: "enemy", 
      title: "Fight Cabaji", 
      desc: "Buggy's acrobatic swordsman Cabaji challenges you to a duel!",
      enemy: { name: "Cabaji", hp: 70, atk: [10, 15], spd: 70, rank: "C" },
      reward: { type: "beli", amount: 120, xp: 60 },
      loseCooldown: 60 * 60 * 1000
    },
    { 
      type: "boss", 
      title: "Buggy the Clown", 
      desc: "The Devil Fruit user Buggy appears! His Chop-Chop powers make sword attacks useless!",
      enemy: { name: "Buggy", hp: 120, atk: [15, 20], spd: 65, rank: "B", ability: "sword_immunity" },
      reward: { type: "beli", amount: 300, xp: 120 },
      loseCooldown: 90 * 60 * 1000
    },
    { 
      type: "narrative", 
      title: "Nami Joins!", 
      desc: "Impressed by your victory over Buggy, Nami officially joins your crew as navigator!",
      reward: { type: "card", name: "Nami", rank: "C" }
    }
  ],
  'SYRUP VILLAGE': [
    { 
      type: "narrative", 
      title: "Peaceful Village", 
      desc: "You arrive at the seemingly peaceful Syrup Village, unaware of the danger lurking beneath.",
      reward: { type: "beli", amount: 80 }
    },
    { 
      type: "narrative", 
      title: "Meet Usopp", 
      desc: "You meet the village storyteller Usopp, who dreams of becoming a brave warrior of the sea!",
      reward: { type: "card", name: "Usopp", rank: "C" }
    },
    { 
      type: "multi_enemy", 
      title: "Fight Sham and Buchi", 
      desc: "The cat brothers of the Black Cat Pirates attack!",
      enemies: [
        { name: "Sham", hp: 70, atk: [10, 10], spd: 55, rank: "C" },
        { name: "Buchi", hp: 70, atk: [10, 10], spd: 55, rank: "C" }
      ],
      reward: { type: "multiple", rewards: [
        { type: "beli", amount: 150 },
        { type: "xp", amount: 80 }
      ]},
      loseCooldown: 60 * 60 * 1000
    },
    { 
      type: "boss", 
      title: "Captain Kuro", 
      desc: "The cunning Captain Kuro reveals himself! His incredible speed gives him the first strike!",
      enemy: { name: "Captain Kuro", hp: 130, atk: [17, 22], spd: 90, rank: "B", ability: "first_strike" },
      reward: { type: "beli", amount: 400, xp: 150 },
      loseCooldown: 90 * 60 * 1000
    },
    { 
      type: "narrative", 
      title: "Go to Baratie", 
      desc: "With Kuro defeated, you set sail for the floating restaurant Baratie!",
      reward: { type: "xp", amount: 60 }
    }
  ],
  'BARATIE': [
    { 
      type: "narrative", 
      title: "Speed Boost Food", 
      desc: "The chefs at Baratie prepare special dishes that enhance your crew's speed!",
      reward: { type: "item", name: "Speed Boost Food", count: 3 }
    },
    { 
      type: "narrative", 
      title: "Meet Sanji", 
      desc: "You meet the passionate cook Sanji, whose kicks are as fiery as his cooking!",
      reward: { type: "card", name: "Sanji", rank: "B" }
    },
    { 
      type: "narrative", 
      title: "Mihawk Appears", 
      desc: "The World's Greatest Swordsman, Dracule Mihawk, makes a brief but intimidating appearance.",
      reward: { type: "xp", amount: 100 }
    },
    { 
      type: "boss", 
      title: "Don Krieg", 
      desc: "The armored pirate Don Krieg attacks! His armor reflects damage back to attackers!",
      enemy: { name: "Don Krieg", hp: 150, atk: [18, 25], spd: 80, rank: "A", ability: "damage_reflection" },
      reward: { type: "beli", amount: 500, xp: 200 },
      loseCooldown: 120 * 60 * 1000
    },
    { 
      type: "narrative", 
      title: "Reach Arlong Park", 
      desc: "Your crew sets sail for the dangerous waters of Arlong Park, Nami's troubled past awaits.",
      reward: { type: "beli", amount: 120 }
    }
  ],
  'ARLONG PARK': [
    { 
      type: "narrative", 
      title: "Nami's Past", 
      desc: "You learn the truth about Nami's connection to the fish-men and her tragic past.",
      reward: { type: "xp", amount: 80 }
    },
    { 
      type: "narrative", 
      title: "Fish-Man Supremacy", 
      desc: "The fish-men boast about their superiority over humans. Their arrogance fuels your determination.",
      reward: { type: "beli", amount: 100 }
    },
    { 
      type: "narrative", 
      title: "Preparing for War", 
      desc: "You rally the villagers and prepare for the final battle against Arlong's crew.",
      reward: { type: "item", name: "Battle Banner" }
    },
    { 
      type: "enemy", 
      title: "Fight Chew", 
      desc: "The fish-man Chew attacks with his water-spitting abilities!",
      enemy: { name: "Chew", hp: 80, atk: [15, 15], spd: 60, rank: "C" },
      reward: { type: "beli", amount: 130, xp: 70 },
      loseCooldown: 60 * 60 * 1000
    },
    { 
      type: "enemy", 
      title: "Fight Kuroobi", 
      desc: "The ray fish-man Kuroobi demonstrates his fish-man karate!",
      enemy: { name: "Kuroobi", hp: 80, atk: [16, 16], spd: 65, rank: "C" },
      reward: { type: "beli", amount: 140, xp: 75 },
      loseCooldown: 60 * 60 * 1000
    },
    { 
      type: "enemy", 
      title: "Fight Hachi", 
      desc: "The six-sword wielding octopus fish-man Hachi blocks your path!",
      enemy: { name: "Hachi", hp: 80, atk: [17, 17], spd: 70, rank: "C" },
      reward: { type: "beli", amount: 150, xp: 80 },
      loseCooldown: 60 * 60 * 1000
    },
    { 
      type: "boss", 
      title: "Arlong", 
      desc: "The saw-shark fish-man Arlong emerges for the final battle! His reign of terror ends here!",
      enemy: { name: "Arlong", hp: 200, atk: [20, 30], spd: 85, rank: "A" },
      reward: { type: "beli", amount: 750, xp: 300 },
      loseCooldown: 120 * 60 * 1000
    },
    { 
      type: "narrative", 
      title: "Alabasta Unlocked!", 
      desc: "With Arlong defeated, you've completed the East Blue saga! The Grand Line awaits - Alabasta arc is now unlocked!",
      reward: { type: "saga_unlock", saga: "Alabasta" }
    }
  ]
};

const LOCATION_COOLDOWNS = {
  'WINDMILL VILLAGE': 1 * 60 * 1000, // 1 minute
  'SHELLS TOWN': 3 * 60 * 1000, // 3 minutes
  'ORANGE TOWN': 3 * 60 * 1000, // 3 minutes
  'SYRUP VILLAGE': 4 * 60 * 1000, // 4 minutes
  'BARATIE': 5 * 60 * 1000, // 5 minutes
  'ARLONG PARK': 6 * 60 * 1000 // 6 minutes
};
const DEFEAT_COOLDOWN = 5 * 60 * 1000; // 5 minutes on defeat
const IMMUNE_USER_ID = "1257718161298690119";

function normalizeItemName(item) {
  return item.replace(/\s+/g, '').toLowerCase();
}

function addToInventory(user, item) {
  if (!user.inventory) user.inventory = [];
  const normItem = normalizeItemName(item);
  if (!user.inventory.map(normalizeItemName).includes(normItem)) {
    user.inventory.push(normItem);
  }
}

function addXP(user, amount) {
  const xpBoost = user.activeBoosts?.find(boost => 
    boost.type === 'double_xp' && boost.expiresAt > Date.now()
  );
  const finalAmount = xpBoost ? amount * 2 : amount;
  user.xp = (user.xp || 0) + finalAmount;
}

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

function createHpBar(current, max) {
  const percentage = Math.max(0, current / max);
  const barLength = 10;
  const filledBars = Math.round(percentage * barLength);
  const emptyBars = barLength - filledBars;
  return '█'.repeat(filledBars) + '░'.repeat(emptyBars);
}

function getCurrentLocation(stage) {
  if (stage < 6) return 'WINDMILL VILLAGE';
  if (stage < 13) return 'SHELLS TOWN';
  if (stage < 20) return 'ORANGE TOWN';
  if (stage < 25) return 'SYRUP VILLAGE';
  if (stage < 30) return 'BARATIE';
  if (stage < 38) return 'ARLONG PARK';
  return 'COMPLETED';
}

function getLocalStage(globalStage) {
  if (globalStage < 6) return globalStage;
  if (globalStage < 13) return globalStage - 6;
  if (globalStage < 20) return globalStage - 13;
  if (globalStage < 25) return globalStage - 20;
  if (globalStage < 30) return globalStage - 25;
  if (globalStage < 38) return globalStage - 30;
  return 0;
}

const data = { name: "explore", description: "Begin or continue your adventure through the East Blue!" };

async function execute(message, args, client) {
  const userId = message.author.id;

  // Reset command
  if (args.length >= 1 && args[0] === 'reset' && args[1] === 'me') {
    let user = await User.findOne({ userId });
    if (!user) return message.reply("User not found.");
    user.exploreStage = 0;
    user.exploreLast = 0;
    user.exploreLossCooldown = 0;
    await user.save();
    return message.reply("<:sucess:1375872950321811547> Your exploration progress has been reset!");
  }

  let user = await User.findOne({ userId });
  if (!user) return message.reply("Start your journey with `op start` first!");

  // Ensure fields exist
  user.exploreStage = Number(user.exploreStage) || 0;
  user.exploreLast = Number(user.exploreLast) || 0;
  user.exploreLossCooldown = Number(user.exploreLossCooldown) || 0;

  const stage = user.exploreStage;
  const now = Date.now();
  const immune = userId === IMMUNE_USER_ID;

  const currentLocation = getCurrentLocation(stage);

  // Cooldown checks
  if (!immune && user.exploreLossCooldown && now < user.exploreLossCooldown) {
    const left = prettyTime(user.exploreLossCooldown - now);
    return message.reply(`You are recovering from defeat! Try exploring again in ${left}.`);
  }

  const locationCooldown = LOCATION_COOLDOWNS[currentLocation] || 2 * 60 * 1000;
  if (!immune && user.locationCooldowns && user.locationCooldowns[currentLocation] && now < user.locationCooldowns[currentLocation]) {
    const left = prettyTime(user.locationCooldowns[currentLocation] - now);
    return message.reply(`<:icon4:1375877365649117245> You must wait ${left} before exploring ${currentLocation} again.`);
  }
  if (currentLocation === 'COMPLETED') {
    return message.reply("<:sucess:1375872950321811547> You've completed the East Blue saga! The Grand Line awaits in future updates!");
  }

  const localStage = getLocalStage(stage);
  const locationData = LOCATIONS[currentLocation];

  if (!locationData || localStage >= locationData.length) {
    return message.reply("No more stages available in this location!");
  }

  const stageData = locationData[localStage];
  let blockProgress = false;

  // Handle different stage types
  if (stageData.type === "narrative") {
    let rewardText = '';

    // Apply rewards
    if (stageData.reward) {
      await applyReward(user, stageData.reward);
      rewardText = formatRewardText(stageData.reward);
    }

    const embed = new EmbedBuilder()
      .setTitle(`📍 ${currentLocation} - ${stageData.title}`)
      .setDescription(`${stageData.desc}${rewardText ? `\n\n<:Chest:1375599735854989403> **Rewards:**\n${rewardText.split('\n').map(line => `#- ${line}`).join('\n')}` : ''}`)
      .setColor(0x3498db);

    await message.reply({ embeds: [embed] });
  }
  else if (stageData.type === "choice") {
    const embed = new EmbedBuilder()
      .setTitle(`📍 ${currentLocation} - ${stageData.title}`)
      .setDescription(stageData.desc)
      .setColor(0xf39c12);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('choice_yes')
        .setLabel(' Yes')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('choice_no')
        .setLabel(' No')
        .setStyle(ButtonStyle.Danger)
    );

    const choiceMessage = await message.reply({
      embeds: [embed],
      components: [row]
    });

    // Store choice data
    if (!client.choices) client.choices = new Map();
    client.choices.set(choiceMessage.id, {
      userId: user.userId,
      stageData,
      currentLocation,
      stage: user.exploreStage
    });

    setTimeout(() => {
      if (client.choices && client.choices.has(choiceMessage.id)) {
        client.choices.delete(choiceMessage.id);
      }
    }, 2 * 60 * 1000);

    return; // Don't progress until choice is made
  }
  else if (stageData.type === "enemy" || stageData.type === "boss" || stageData.type === "multi_enemy") {
    if (!user.team || !user.team.length) {
      blockProgress = true;
      await message.reply({
        embeds: [new EmbedBuilder()
          .setTitle("<:arrow:1375872983029256303> You need a team!")
          .setDescription("You must add at least one card to your team to fight. Use `op team add <card>`.")
          .setColor(0xe74c3c)
        ]
      });
    } else {
      // Start battle
      const { calculateBattleStats } = require('../utils/battleSystem.js');
      const playerTeam = calculateBattleStats(user);

      if (playerTeam.length === 0) {
        blockProgress = true;
        return message.reply({
          embeds: [new EmbedBuilder()
            .setTitle("<:arrow:1375872983029256303> No valid team members!")
            .setDescription("Your team cards couldn't be loaded. Add cards to your team first.")
            .setColor(0xe74c3c)
          ]
        });
      }

      let enemies = [];
      let enemyType = "enemy";

      if (stageData.type === "multi_enemy") {
        enemies = stageData.enemies.map(enemy => ({
          ...enemy,
          currentHp: enemy.hp,
          maxHp: enemy.hp,
          attack: enemy.atk,
          power: Math.floor((enemy.atk[0] + enemy.atk[1]) / 2)
        }));
        enemyType = "multi_enemy";
      } else {
        const enemy = {
          ...stageData.enemy,
          currentHp: stageData.enemy.hp,
          maxHp: stageData.enemy.hp,
          attack: stageData.enemy.atk,
          power: Math.floor((stageData.enemy.atk[0] + stageData.enemy.atk[1]) / 2)
        };
        enemies = [enemy];
        enemyType = stageData.type === "boss" ? "boss" : "enemy";
      }

      const battleEmbed = createBossBattleEmbed(enemies[0], playerTeam, [], 1, enemyType, enemies);
      const battleButtons = createBossBattleButtons();

      const battleMessage = await message.reply({
        embeds: [battleEmbed],
        components: [battleButtons]
      });

      // Store battle state
      const battleData = {
        boss: enemies[0],
        enemies: enemies,
        playerTeam,
        battleLog: [],
        turn: 1,
        userId: user.userId,
        stageData,
        currentLocation,
        stage: user.exploreStage,
        exploreBattle: true,
        enemyType: enemyType
      };

      if (!client.battles) client.battles = new Map();
      client.battles.set(battleMessage.id, battleData);

      setTimeout(() => {
        if (client.battles && client.battles.has(battleMessage.id)) {
          client.battles.delete(battleMessage.id);
        }
      }, 5 * 60 * 1000);

      return; // Don't progress until battle is resolved
    }
  }

  // Progress to next stage
  if (!blockProgress) {
    const { updateQuestProgress } = require('../utils/questSystem.js');
    await updateQuestProgress(user, 'explore', 1);

    user.exploreStage = stage + 1;

    // Set location-based cooldown
    if (!immune) {
      if (!user.locationCooldowns) user.locationCooldowns = {};
      const locationCooldown = LOCATION_COOLDOWNS[currentLocation] || 2 * 60 * 1000;
      user.locationCooldowns[currentLocation] = now + locationCooldown;
    }

    user.exploreLossCooldown = 0;
    await user.save();
  } else {
    await user.save();
  }
}

function createBossBattleEmbed(boss, playerTeam, battleLog, turn, enemyType = "enemy", allEnemies = null) {
  let battleTitle = "Battle";
  if (enemyType === "boss") battleTitle = "Boss Battle";
  else if (enemyType === "multi_enemy") battleTitle = "Multi-Enemy Battle";

  const embed = new EmbedBuilder()
    .setTitle(` ${battleTitle}`)
    .setDescription(`${battleLog.slice(-4).join('\n') || 'Battle begins!'}`)
    .setColor(0xff0000);

  const teamDisplay = playerTeam.filter(card => card.currentHp > 0).map(card => {
    const cardHpBar = createHpBar(card.currentHp, card.hp);
    return `${card.name} ${cardHpBar} ${card.currentHp}/${card.hp}`;
  }).join('\n') || 'No cards available';

  if (enemyType === "multi_enemy" && allEnemies) {
    const enemyDisplay = allEnemies.filter(enemy => enemy.currentHp > 0).map(enemy => {
      const hpBar = createHpBar(enemy.currentHp, enemy.maxHp);
      return `${enemy.name} ${hpBar} ${enemy.currentHp}/${enemy.maxHp}`;
    }).join('\n');

    embed.addFields(
      { name: '<:INTSL_Aokiji_NOPE:1388591619585871902> Enemies', value: enemyDisplay, inline: false },
      { name: '<:Zoro_CuteStair:1388591115795693688> Your Team', value: teamDisplay, inline: false }
    );
  } else {
    const hpBar = createHpBar(boss.currentHp, boss.maxHp);
    embed.addFields(
      { name: ` ${boss.name} HP`, value: `${hpBar} ${boss.currentHp}/${boss.maxHp}`, inline: true },
      { name: ' Attack Power', value: `${boss.attack[0]}-${boss.attack[1]}`, inline: true },
      { name: ' Your Team', value: teamDisplay, inline: false }
    );
  }

  return embed;
}

function createBossBattleButtons(disabled = false) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('boss_attack')
        .setLabel(' Attack')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('boss_defend')
        .setLabel(' Defend')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('boss_inventory')
        .setLabel('<:emptybox:1388587415018410177> Items')
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('boss_flee')
        .setLabel(' Flee')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled)
    );
}

function formatRewardText(reward) {
  if (!reward) return '';

  if (reward.type === "multiple") {
    return reward.rewards.map(r => formatRewardText(r)).filter(t => t).join('\n');
  }

  switch (reward.type) {
    case "card":
      return `${reward.name} (${reward.rank}-Rank)`;
    case "beli":
      return `<:Money:1375579299565928499>+${reward.amount} Beli`;
    case "xp":
      return `<:snoopy_sparkles:1388585338821152978> +${reward.amount} XP`;
    case "item":
      return `<:emptybox:1388587415018410177> ${reward.name}${reward.count ? ` x${reward.count}` : ''}`;
    case "chest":
      return `<:emptybox:1388587415018410177> ${reward.rank.toUpperCase()} Chest`;
    case "saga_unlock":
      return `${reward.saga} Saga Unlocked!`;
    default:
      return '';
  }
}

async function applyReward(user, reward) {
  if (!reward) return;

  if (reward.type === "multiple") {
    for (const subReward of reward.rewards) {
      await applyReward(user, subReward);
    }
    return;
  }

  switch (reward.type) {
    case "card":
      if (!user.cards) user.cards = [];
      const existingCard = user.cards.find(c => c.name === reward.name);
      if (existingCard) {
        // Add a duplicate instead of ignoring
        user.cards.push({
          name: reward.name,
          rank: reward.rank,
          level: 1,
          experience: 0,
          timesUpgraded: 0
        });
      } else {
        user.cards.push({
          name: reward.name,
          rank: reward.rank,
          level: 1,
          experience: 0,
          timesUpgraded: 0
        });
      }
      break;
    case "beli":
      user.beli = (user.beli || 0) + reward.amount;
      break;
    case "xp":
      addXP(user, reward.amount);
      // Distribute XP to team members
      const { distributeXPToTeam } = require('../utils/levelSystem.js');
      const levelChanges = distributeXPToTeam(user, reward.amount);
      if (levelChanges && levelChanges.length > 0) {
        // Store level up notifications for later display
        user.recentLevelUps = levelChanges;
      }
      break;
    case "item":
      if (reward.count) {
        for (let i = 0; i < reward.count; i++) {
          addToInventory(user, reward.name);
        }
      } else {
        addToInventory(user, reward.name);
      }
      break;
    case "chest":
      if (!user.inventory) user.inventory = [];
      user.inventory.push(`${reward.rank.toLowerCase()}chest`);
      break;
    case "saga_unlock":
      if (!user.unlockedSagas) user.unlockedSagas = ['East Blue'];
      if (!user.unlockedSagas.includes(reward.saga)) {
        user.unlockedSagas.push(reward.saga);
      }
      break;
  }
}

module.exports = { data, execute };