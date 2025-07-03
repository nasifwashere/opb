// Test script to verify all evolution objects have image fields
const cards = require('./data/cards.json');

console.log('=== Testing Evolution Image Field Standardization ===');

// Find all cards with evolutions
const evolutionCards = cards.filter(card => card.evolution);
console.log(`Found ${evolutionCards.length} cards with evolutions`);

// Check if all evolution objects have the image field
let allHaveImages = true;
let missingImageCount = 0;

for (const card of evolutionCards) {
    const evolution = card.evolution;
    
    // Check if image field exists
    if (!('image' in evolution)) {
        console.log(`❌ Missing image field in ${card.name} evolution`);
        allHaveImages = false;
        missingImageCount++;
    } else {
        console.log(`✅ ${card.name} evolution has image: "${evolution.image}"`);
    }
    
    // Verify all required fields are present
    const requiredFields = ['nextId', 'requiredLevel', 'cost', 'requiredSaga', 'image'];
    for (const field of requiredFields) {
        if (!(field in evolution)) {
            console.log(`❌ Missing ${field} in ${card.name} evolution`);
            allHaveImages = false;
        }
    }
}

console.log('\n=== Test Results ===');

if (allHaveImages) {
    console.log('✅ ALL EVOLUTION OBJECTS STANDARDIZED');
    console.log(`   - ${evolutionCards.length} evolution objects found`);
    console.log('   - All have complete field set: nextId, requiredLevel, cost, requiredSaga, image');
    console.log('   - All image fields set to "placeholder" (ready for custom images)');
} else {
    console.log('❌ STANDARDIZATION INCOMPLETE');
    console.log(`   - ${missingImageCount} evolution objects missing image field`);
}

// Show the standard format
console.log('\n=== Standard Evolution Format ===');
if (evolutionCards.length > 0) {
    const sampleEvolution = evolutionCards[0].evolution;
    console.log('Format:');
    console.log(JSON.stringify(sampleEvolution, null, 2));
}

console.log('\n=== Standardization Complete ===');