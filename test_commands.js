// Test script for crew and evolution systems
const cards = require('./data/cards.json');

console.log('=== Testing Evolution Format Consistency ===');

// Find all cards with evolutions
const evolutionCards = cards.filter(card => card.evolution);
console.log(`Found ${evolutionCards.length} cards with evolutions`);

// Check format consistency
let formatConsistent = true;
let expectedFields = ['nextId', 'requiredLevel', 'cost', 'requiredSaga'];

for (const card of evolutionCards) {
    const evolution = card.evolution;
    for (const field of expectedFields) {
        if (!(field in evolution)) {
            formatConsistent = false;
            console.log(`❌ Missing field ${field} in ${card.name}`);
        }
    }
    
    // Check data types
    if (typeof evolution.requiredLevel !== 'number') {
        console.log(`❌ Invalid requiredLevel type in ${card.name}`);
        formatConsistent = false;
    }
    if (typeof evolution.cost !== 'number') {
        console.log(`❌ Invalid cost type in ${card.name}`);
        formatConsistent = false;
    }
}

if (formatConsistent) {
    console.log('✅ Evolution format test: PASSED');
} else {
    console.log('❌ Evolution format test: FAILED');
}

console.log('\n=== Testing Luffy Evolution Changes ===');

// Test Luffy specifically
const luffyCard = cards.find(card => card.name === 'Monkey D. Luffy');
if (luffyCard && luffyCard.evolution) {
    console.log('✅ Luffy evolution found');
    console.log(`   - Level: ${luffyCard.evolution.requiredLevel} (should be 5)`);
    console.log(`   - Cost: ${luffyCard.evolution.cost} (should be 50)`);
    console.log(`   - Saga: ${luffyCard.evolution.requiredSaga} (should be East Blue)`);
    
    // Verify the changes are correct
    if (luffyCard.evolution.requiredLevel === 5 && 
        luffyCard.evolution.cost === 50 && 
        luffyCard.evolution.requiredSaga === 'East Blue') {
        console.log('✅ Luffy evolution test: PASSED');
    } else {
        console.log('❌ Luffy evolution test: FAILED');
    }
} else {
    console.log('❌ Luffy evolution not found');
}

console.log('\n=== Testing Crew Command Loading ===');

try {
    const crew = require('./commands/crew.js');
    console.log('✅ Crew command loaded successfully');
    console.log(`   - Execute function: ${typeof crew.execute === 'function'}`);
    console.log(`   - Crews storage: ${typeof crew.crews === 'object'}`);
    console.log(`   - Max crew size: ${crew.MAX_CREW_SIZE}`);
} catch (error) {
    console.log(`❌ Crew command failed to load: ${error.message}`);
}

console.log('\n=== Testing Raid Command Loading ===');

try {
    const raid = require('./commands/raid.js');
    console.log('✅ Raid command loaded successfully');
    console.log(`   - Execute function: ${typeof raid.execute === 'function'}`);
    console.log(`   - Bosses available: ${Object.keys(raid.EAST_BLUE_BOSSES).length}`);
    
    // List available bosses
    console.log('   - Available bosses:');
    Object.keys(raid.EAST_BLUE_BOSSES).forEach(boss => {
        console.log(`     • ${boss}`);
    });
} catch (error) {
    console.log(`❌ Raid command failed to load: ${error.message}`);
}

console.log('\n=== All Tests Completed ===');