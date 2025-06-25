import fs from 'fs';
const cards = JSON.parse(fs.readFileSync(new URL('../data/cards.json', import.meta.url)));

export function getEvolution(cardName, level, saga) {
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