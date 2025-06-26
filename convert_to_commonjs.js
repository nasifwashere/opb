const fs = require('fs');
const path = require('path');

// Convert ES6 imports/exports to CommonJS for all command files
function convertFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Convert ES6 imports to require statements
  content = content.replace(/import\s+(\{[^}]+\})\s+from\s+['"]([^'"]+)['"]/g, 'const $1 = require(\'$2\')');
  content = content.replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, 'const $1 = require(\'$2\')');
  content = content.replace(/import\s+['"]([^'"]+)['"]/g, 'require(\'$1\')');
  
  // Convert export const data to const data
  content = content.replace(/export\s+const\s+data\s*=/g, 'const data =');
  
  // Convert export function to function
  content = content.replace(/export\s+async\s+function\s+execute/g, 'async function execute');
  content = content.replace(/export\s+function\s+execute/g, 'function execute');
  content = content.replace(/export\s+async\s+function\s+(\w+)/g, 'async function $1');
  content = content.replace(/export\s+function\s+(\w+)/g, 'function $1');
  
  // Add module.exports at the end if not present
  if (!content.includes('module.exports')) {
    content += '\n\nmodule.exports = { data, execute };';
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`Converted: ${filePath}`);
}

// Convert all command files
const commandsDir = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsDir, file);
  convertFile(filePath);
}

console.log('All command files converted to CommonJS');