const mongoose = require('mongoose');

const marketListingSchema = new mongoose.Schema({
    sellerId: { type: String, required: true },
    sellerName: { type: String, required: true },
    type: { type: String, enum: ['card', 'item'], required: true },
    itemName: { type: String, required: true },
    itemRank: { type: String },
    itemLevel: { type: Number },
    price: { type: Number, required: true, min: 1 },
    description: { type: String, maxlength: 200 },
    active: { type: Boolean, default: true },
    expiresAt: { 
        type: Date, 
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    },
    createdAt: { type: Date, default: Date.now }
});

// Index for performance
marketListingSchema.index({ active: 1, expiresAt: 1 });
marketListingSchema.index({ sellerId: 1 });
marketListingSchema.index({ type: 1 });
marketListingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('MarketListing', marketListingSchema);