const name = 'ready';
const once = true;

function execute(client) {
  console.log(`[READY] Logged in as ${client.user.tag}!`);
}

module.exports = { name, once, execute };
