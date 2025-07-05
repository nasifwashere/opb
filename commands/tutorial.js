const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');

const tutorialSteps = [
  {
    title: 'Welcome to the Bot!',
    desc: 'This interactive tutorial will guide you through the basics of the game.\n\nReact with **Next** to continue.'
  },
  {
    title: 'Step 1: Starting Out',
    desc: 'Type `op start` in the server to create your account and begin your pirate adventure.\n\nYou only need to do this once!'
  },
  {
    title: 'Step 2: Viewing Your Collection',
    desc: 'Type `op collection` to see all the cards you own.\n\nCards are your main assets and can be leveled up, evolved, and equipped.'
  },
  {
    title: 'Step 3: Pulling Cards',
    desc: 'Type `op pull` to get a new card.\n\nYou can pull cards every day.\n\n*You received a free pull!*'
  },
  {
    title: 'Step 4: Using Items',
    desc: 'Type `op inventory` to see your items.\nType `op use <item>` to use an item.\n\n*You received a Basic Potion!*'
  },
  {
    title: 'Step 5: Equipping Items',
    desc: 'Type `op shop` to buy items.\nType `op equip <card> <item>` to equip an item to a card.\n\n*You received a Lucky Charm!*'
  },
  {
    title: 'Step 6: Leveling Up',
    desc: 'Cards gain XP from battles and quests.\nType `op mycard <card>` to see a card’s stats and XP.'
  },
  {
    title: 'Step 7: Evolving Cards',
    desc: 'Some cards can evolve into stronger forms.\nType `op evolve <card>` to upgrade them if you meet the requirements.'
  },
  {
    title: 'Step 8: Exploring',
    desc: 'Type `op explore` to go on adventures and find rare cards and items.'
  },
  {
    title: 'Step 9: Example Battle',
    desc: 'Let’s simulate a simple battle!\n\nYou face a Marine...\n\n**Your card attacks!**\nYou win and gain 50 XP.\n\n*You received 50 XP!*'
  },
  {
    title: 'Step 10: Quests & Rewards',
    desc: 'Type `op quest` to see daily and weekly quests.\nComplete quests for extra rewards every day.'
  },
  {
    title: 'Tutorial Complete!',
    desc: 'You’ve finished the tutorial!\n\nTry typing `op help` in the server for more commands.\n\nGood luck, captain!'
  }
];

const data = new SlashCommandBuilder()
  .setName('tutorial')
  .setDescription('Start the interactive tutorial in your DMs.');

async function execute(message) {
  const userId = message.author.id;
  let user = await User.findOne({ userId });
  if (!user) {
    return message.reply('Start your journey with `op start` first!');
  }

  // Track tutorial progress in user object
  if (!user.tutorial) user.tutorial = { step: 0, completed: false };
  if (user.tutorial.completed) {
    return message.reply('You have already completed the tutorial!');
  }

  let step = 0;
  const dm = await message.author.createDM();
  let tutorialMsg = null;

  async function sendStep() {
    const t = tutorialSteps[step];
    const embed = new EmbedBuilder()
      .setTitle(t.title)
      .setDescription(t.desc)
      .setColor(0x2b2d31);
    const row = new ActionRowBuilder();
    if (step > 0) {
      row.addComponents(new ButtonBuilder().setCustomId('prev').setLabel('Previous').setStyle(ButtonStyle.Secondary));
    }
    if (step < tutorialSteps.length - 1) {
      row.addComponents(new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Primary));
    } else {
      row.addComponents(new ButtonBuilder().setCustomId('finish').setLabel('Finish').setStyle(ButtonStyle.Success));
    }
    if (tutorialMsg) {
      await tutorialMsg.edit({ embeds: [embed], components: [row] });
    } else {
      tutorialMsg = await dm.send({ embeds: [embed], components: [row] });
    }
  }

  await sendStep();

  const collector = tutorialMsg.createMessageComponentCollector({ time: 10 * 60 * 1000 });
  collector.on('collect', async interaction => {
    await interaction.deferUpdate();
    if (interaction.user.id !== userId) return;
    if (interaction.customId === 'next' && step < tutorialSteps.length - 1) {
      step++;
      // Give items/rewards at certain steps
      if (step === 3 && !user.tutorial.pullGiven) {
        user.tutorial.pullGiven = true;
        user.pulls = (user.pulls || []);
        user.pulls.push({ tutorial: true });
      }
      if (step === 4 && !user.tutorial.basicPotionGiven) {
        user.tutorial.basicPotionGiven = true;
        user.inventory = user.inventory || [];
        user.inventory.push('basicpotion');
      }
      if (step === 5 && !user.tutorial.luckyCharmGiven) {
        user.tutorial.luckyCharmGiven = true;
        user.inventory = user.inventory || [];
        user.inventory.push('luckycharm');
      }
      if (step === 9 && !user.tutorial.battleXpGiven) {
        user.tutorial.battleXpGiven = true;
        user.xp = (user.xp || 0) + 50;
      }
      await user.save();
      await sendStep();
    } else if (interaction.customId === 'prev' && step > 0) {
      step--;
      await sendStep();
    } else if (interaction.customId === 'finish') {
      user.tutorial.completed = true;
      await user.save();
      await tutorialMsg.edit({ embeds: [new EmbedBuilder().setTitle('Tutorial Complete!').setDescription('You are ready to play!').setColor(0x2b2d31)], components: [] });
      collector.stop();
    }
  });

  collector.on('end', () => {
    tutorialMsg.edit({ components: [] }).catch(() => {});
  });

  await message.reply('Check your DMs for the tutorial!');
}

module.exports = { data, execute };
