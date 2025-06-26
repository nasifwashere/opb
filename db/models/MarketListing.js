import mongoose from 'mongoose';

const marketListingSchema = new mongoose.Schema({
  sellerId: { type: String, required: true }, // userId field for sellers
  cardName: { type: String, required: true },
  price: { type: Number, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const MarketListing = mongoose.model('MarketListing', marketListingSchema);
export default MarketListing;