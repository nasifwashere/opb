import mongoose from 'mongoose';

const cardInstanceSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // Use userId as the reference
  cardName: { type: String, required: true },
  level: { type: Number, default: 1 },
  locked: { type: Boolean, default: false }
}, { timestamps: true });

const CardInstance = mongoose.model('CardInstance', cardInstanceSchema);
export default CardInstance;