const { EmbedBuilder } = require('discord.js');
const User = require('../db/models/User.js');

const validSettings = {
  notifications: {
    name: 'Notifications',
    description: 'Enable or disable bot notifications',
    type: 'boolean',
    values: ['on', 'off', 'true', 'false', 'enabled', 'disabled']
  },
  duelaccept: {
    name: 'Duel Accept Mode',
    description: 'How to handle duel challenges',
    type: 'choice',
    values: ['auto', 'manual']
  },
  language: {
    name: 'Language',
    description: 'Bot language preference',
    type: 'choice',
    values: ['en', 'japanese', 'spanish', 'french']
  }
};

function normalizeSettingName(name) {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

function normalizeValue(value) {
  return value.toLowerCase().trim();
}

function validateAndConvertValue(setting, value) {
  const normalizedValue = normalizeValue(value);
  
  if (setting.type === 'boolean') {
    if (['on', 'true', 'enabled', 'yes', '1'].includes(normalizedValue)) {
      return { valid: true, value: true };
    } else if (['off', 'false', 'disabled', 'no', '0'].includes(normalizedValue)) {
      return { valid: true, value: false };
    } else {
      return { valid: false, error: 'Value must be on/off, true/false, or enabled/disabled' };
    }
  } else if (setting.type === 'choice') {
    if (setting.values.includes(normalizedValue)) {
      return { valid: true, value: normalizedValue };
    } else {
      return { valid: false, error: `Value must be one of: ${setting.values.join(', ')}` };
    }
  }
  
  return { valid: false, error: 'Unknown setting type' };
}

function getSettingKey(settingName) {
  const normalized = normalizeSettingName(settingName);
  switch (normalized) {
    case 'notifications': return 'notifications';
    case 'duelaccept': return 'duelAccept';
    case 'language': return 'language';
    default: return null;
  }
}

function createSettingsEmbed(user) {
  const settings = user.settings || {};
  
  const embed = new EmbedBuilder()
    .setTitle(' Your Settings')
    .setDescription('Your current bot settings')
    .setColor(0x3498db)
    .setFooter({ text: 'Use "op set <setting> <value>" to change settings' });

  Object.keys(validSettings).forEach(key => {
    const setting = validSettings[key];
    const settingKey = getSettingKey(key);
    const currentValue = settings[settingKey];
    
    let displayValue;
    if (setting.type === 'boolean') {
      displayValue = currentValue ? '<:sucess:1375872950321811547> Enabled' : ' Disabled';
    } else {
      displayValue = currentValue || 'Not set';
    }
    
    embed.addFields({
      name: setting.name,
      value: `${displayValue}\n*${setting.description}*`,
      inline: true
    });
  });

  return embed;
}

const data = { name: 'set', description: 'Change your bot settings and preferences.' };

async function execute(message, args) {
  const userId = message.author.id;
  const user = await User.findOne({ userId });

  if (!user) return message.reply('Start your journey with `op start` first!');

  // If no arguments, show current settings
  if (args.length === 0) {
    const embed = createSettingsEmbed(user);
    return message.reply({ embeds: [embed] });
  }

  // If only one argument, show help for that setting
  if (args.length === 1) {
    const settingName = normalizeSettingName(args[0]);
    const setting = validSettings[settingName];
    
    if (!setting) {
      const availableSettings = Object.keys(validSettings).map(key => validSettings[key].name).join(', ');
      return message.reply(`<:arrow:1375872983029256303> Unknown setting. Available settings: ${availableSettings}`);
    }
    
    const embed = new EmbedBuilder()
      .setTitle(` ${setting.name} Setting`)
      .setDescription(setting.description)
      .addFields(
        { name: 'Valid Values', value: setting.values.join(', '), inline: false },
        { name: 'Usage', value: `\`op set ${settingName} <value>\``, inline: false }
      )
      .setColor(0x3498db);
    
    return message.reply({ embeds: [embed] });
  }

  // Set a setting value
  const settingName = normalizeSettingName(args[0]);
  const value = args.slice(1).join(' ');
  
  const setting = validSettings[settingName];
  if (!setting) {
    const availableSettings = Object.keys(validSettings).map(key => validSettings[key].name).join(', ');
    return message.reply(`<:arrow:1375872983029256303> Unknown setting. Available settings: ${availableSettings}`);
  }

  const validation = validateAndConvertValue(setting, value);
  if (!validation.valid) {
    return message.reply(`<:arrow:1375872983029256303> Invalid value: ${validation.error}`);
  }

  // Update the setting
  if (!user.settings) user.settings = {};
  const settingKey = getSettingKey(settingName);
  user.settings[settingKey] = validation.value;
  
  await user.save();

  // Create success embed
  const embed = new EmbedBuilder()
    .setTitle('<:sucess:1375872950321811547> Setting Updated!')
    .setDescription(`**${setting.name}** has been updated.`)
    .addFields(
      { name: 'Setting', value: setting.name, inline: true },
      { name: 'New Value', value: String(validation.value), inline: true }
    )
    .setColor(0x2ecc40);

  await message.reply({ embeds: [embed] });
}


module.exports = { data, execute };