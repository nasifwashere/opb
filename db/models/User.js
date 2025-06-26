import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true, required: true }, // Now the only unique identifier
  beli: { type: Number, default: 0 },
  saga: { type: String, default: "East Blue" },
  team: { type: Array, default: [] },
  wins: { type: Number, default: 0 },
  // Add these for explore!
  exploreStage: { type: Number, default: 0 },
  exploreLast: { type: Number, default: 0 },
  exploreLossCooldown: { type: Number, default: 0 },
  // For inventory/items if needed:
  inventory: { type: Array, default: [] },
  xp: { type: Number, default: 0 },
  cards: { type: Array, default: [] }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
export default User;