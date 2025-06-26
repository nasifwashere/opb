const mongoose = require('mongoose');

const marketListingSchema = new mongoose.Schema({
  sellerId: { type: String, required: true },
  sellerName: { type: String, required: true },
  type: { type: String, enum: ['card', 'item'], required: true },
  itemName: { type: String, required: true },
  itemRank: { type: String },
  itemLevel: { type: Number },
  price: { type: Number, required: true },
  description: { type: String },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
});

marketListingSchema.index({ active: 1, type: 1, price: 1 });
marketListingSchema.index({ sellerId: 1 });
marketListingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('MarketListing', marketListingSchema);
