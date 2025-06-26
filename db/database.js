const mongoose = require('mongoose');
require('dotenv').config();

async function connectDB() {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/onepiece_bot';
    
    if (!mongoURI || mongoURI === 'mongodb://localhost:27017/onepiece_bot') {
      console.error('[DATABASE] MONGO_URI environment variable not found or using default localhost');
      console.error('[DATABASE] Please check your .env file');
    }
    
    console.log('[DATABASE] Attempting to connect to MongoDB Atlas...');
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('[DATABASE] Connected to MongoDB Atlas successfully');
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
