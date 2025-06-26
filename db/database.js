const mongoose = require('mongoose');

async function connectDB() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/onepiece_bot';
    await mongoose.connect(mongoURI);
    console.log('[DATABASE] Connected to MongoDB');
  } catch (error) {
    console.error('[DATABASE] Connection failed:', error);
    process.exit(1);
  }
}

module.exports = { connectDB };

mongoose.connection.on('disconnected', () => {
  console.log('[DATABASE] MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('[DATABASE] MongoDB error:', err);
});
