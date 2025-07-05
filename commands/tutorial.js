const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../db/models/User.js');

const tutorialSteps = [
  {
    title: 'Welcome to the Bot!',
    desc: 'This tutorial will guide you through the basics. Ready to become a pirate legend? Click Next to begin!'
  },
  {
    title: 'Step 1: Your Adventure Begins',
    desc: 'Use `/start` to create your account and begin your journey.'
  },
  {
    title: 'Step 2: Viewing Your Cards',
    desc: 'Use `/collection` to see all the cards you own. Cards are your main assets!'
  },
  {
    title: 'Step 3: Pulling New Cards',
    desc: 'Use `/pull` to get new cards. Try it every day for new surprises!\n\n*You received a free pull!*'
  },
  {
    title: 'Step 4: Equipping Items',
    desc: 'Use `/shop` to buy items and `/equip` to equip them to your cards.\n\n*You received a Lucky Charm!*'
  },
  {
    title: 'Step 5: Leveling Up',
    desc: 'Cards gain XP from battles and can be leveled up for better stats.'
  },
  {
    title: 'Step 6: Evolving Cards',
    desc: 'Some cards can evolve into stronger forms. Use `/evolve` to upgrade them!'
  },
  {
    title: 'Step 7: Exploring',
    desc: 'Use `/explore` to go on adventures and find rare cards and items.'
  },
  {
    title: 'Step 8: Simple Battle Example',
    desc: 'Let’s try a simple battle!\n\n*You fought a Marine and won! Your card gained XP.*'
  },
  {
    title: 'Step 9: Quests & Rewards',
    desc: 'Complete `/quest` tasks for extra rewards every day.'
  },
  {
    title: 'Step 10: You’re Ready!',
    desc: 'You’ve finished the tutorial! Use `/help` anytime for more info. Good luck, captain!'
  }
];

const data = new SlashCommandBuilder()
  .setName('tutorial')
  .setDescription('Start the interactive tutorial in your DMs.');

async function execute(message) {
  const userId = message.author.id;
  let user = await User.findOne({ userId });
  if (!user) {
    return message.reply('Start your journey with `/start` first!');
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
      if (step === 4 && !user.tutorial.luckyCharmGiven) {
        user.tutorial.luckyCharmGiven = true;
        user.inventory = user.inventory || [];
        user.inventory.push('luckycharm');
      }
      if (step === 8 && !user.tutorial.battleXpGiven) {
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
