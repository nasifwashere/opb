
const fs = require('fs');
const path = require('path');

// Function to convert a single command file
function fixCommandFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath, '.js');
  
  console.log(`Processing: ${fileName}`);
  
  // Skip if already has SlashCommandBuilder
  if (content.includes('SlashCommandBuilder')) {
    console.log(`  ✓ Already converted: ${fileName}`);
    return;
  }
  
  // Add SlashCommandBuilder import if not present
  if (!content.includes('SlashCommandBuilder')) {
    content = content.replace(
      /const\s*{\s*([^}]*)\s*}\s*=\s*require\(['"]discord\.js['"]\);/,
      `const { SlashCommandBuilder, $1 } = require('discord.js');`
    );
    
    // If no discord.js import found, add it
    if (!content.includes("require('discord.js')")) {
      content = `const { SlashCommandBuilder } = require('discord.js');\n` + content;
    }
  }
  
  // Find existing data object and enhance it
  const dataMatch = content.match(/const data = \{([^}]+)\};/s);
  if (dataMatch) {
    const existingData = dataMatch[1];
    let name = fileName;
    let description = 'No description provided';
    
    // Extract existing name and description
    const nameMatch = existingData.match(/name:\s*['"]([^'"]+)['"]/);
    const descMatch = existingData.match(/description:\s*['"]([^'"]+)['"]/);
    
    if (nameMatch) name = nameMatch[1];
    if (descMatch) description = descMatch[1];
    
    // Create new data structure with SlashCommandBuilder
    const newData = `const data = new SlashCommandBuilder()
  .setName('${name}')
  .setDescription('${description}');`;
    
    content = content.replace(/const data = \{[^}]+\};/s, newData);
  } else {
    // If no data object exists, create one
    const newData = `const data = new SlashCommandBuilder()
  .setName('${fileName}')
  .setDescription('${fileName} command');`;
    
    // Insert after imports
    const lines = content.split('\n');
    let insertIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('require(') || lines[i].includes('const ')) {
        insertIndex = i + 1;
      } else if (lines[i].trim() === '') {
        continue;
      } else {
        break;
      }
    }
    
    lines.splice(insertIndex, 0, '', newData, '');
    content = lines.join('\n');
  }
  
  // Ensure proper module.exports
  if (!content.includes('module.exports')) {
    content += '\n\nmodule.exports = { data, execute };';
  } else {
    // Update existing module.exports to include data
    content = content.replace(
      /module\.exports\s*=\s*\{([^}]*)\}/,
      (match, exports) => {
        if (!exports.includes('data')) {
          const cleanExports = exports.trim();
          return `module.exports = { data, ${cleanExports} }`;
        }
        return match;
      }
    );
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`  ✓ Fixed: ${fileName}`);
}

// Function to recursively process command directories
function processDirectory(dirPath) {
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      processDirectory(itemPath);
    } else if (item.endsWith('.js')) {
      try {
        fixCommandFile(itemPath);
      } catch (error) {
        console.error(`Error processing ${item}: ${error.message}`);
      }
    }
  }
}

console.log('🔧 Starting automatic slash command conversion...\n');

// Process all command files
const commandsDir = path.join(__dirname, 'commands');
processDirectory(commandsDir);

console.log('\n✅ All command files have been processed!');
console.log('🚀 Run "node deploy-commands.js" to deploy the slash commands.');
