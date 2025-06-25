import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true, required: true },
  beli: { type: Number, default: 0 },
  saga: { type: String, default: "East Blue" },
  team: { type: Array, default: [] },
  wins: { type: Number, default: 0 }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
export default User;