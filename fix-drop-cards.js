
const mongoose = require('mongoose');
const MarketListing = require('./db/models/Market.js');
const fs = require('fs');
const path = require('path');

async function fixDropChannelCards() {
    try {
        // Load config to get drops channel ID
        const configPath = path.resolve('config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        if (!config.dropsChannelId) {
            console.log('No drops channel configured.');
            return;
        }

        // Update all cards posted in drops channel to not expire
        const result = await MarketListing.updateMany(
            { 
                active: true,
                // Add a field to track if item was from drops channel
                fromDrops: true 
            },
            { 
                $set: { 
                    expiresAt: new Date('2099-12-31') // Set far future date
                }
            }
        );

        console.log(`Updated ${result.modifiedCount} drop channel cards to not expire.`);
    } catch (error) {
        console.error('Error fixing drop channel cards:', error);
    }
}

// Run if called directly
if (require.main === module) {
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/onepiece')
        .then(() => {
            console.log('Connected to MongoDB');
            return fixDropChannelCards();
        })
        .then(() => {
            console.log('Done!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Error:', error);
            process.exit(1);
        });
}

module.exports = { fixDropChannelCards };
