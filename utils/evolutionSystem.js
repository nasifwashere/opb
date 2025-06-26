const fs = require('fs');
const path = require('path');
const cards = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/cards.json')));

function getEvolution(cardName, level, saga) {
  const card = cards.find(c => c.name === cardName);
  if (!card || !card.evolution) return null;
  const evo = card.evolution;
  if (
    level >= evo.requiredLevel &&
    saga === evo.requiredSaga
  ) {
    return evo;
  }
  return null;
}

module.exports = { getEvolution };
