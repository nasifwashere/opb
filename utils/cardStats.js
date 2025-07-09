// Card stat lookup utility for raid.js
const fs = require('fs');
const path = require('path');

const cardsPath = path.resolve(__dirname, '../data/cards.json');
const allCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

function getBaseCardStats(cardName) {
    // Fuzzy match by name
    const norm = s => String(s || '').replace(/\s+/g, '').toLowerCase();
    let card = allCards.find(c => norm(c.name) === norm(cardName));
    if (!card) {
        card = allCards.find(c => norm(c.name).includes(norm(cardName)));
    }
    if (!card) return null;
    const [power, hp, speed] = (card.phs || '').split('/').map(s => parseInt(s.trim(), 10));
    return {
        name: card.name,
        power: power || 0,
        hp: hp || 0,
        speed: speed || 0,
        rank: card.rank || 'C',
        image: card.image || '',
    };
}

module.exports = { getBaseCardStats };
