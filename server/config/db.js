const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    let uri = (process.env.MONGO_URI || '').trim();

    // Strip accidental wrapping quotes (e.g. "mongodb+srv://..." or 'mongodb+srv://...')
    if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
      uri = uri.slice(1, -1).trim();
    }

    if (!uri) {
      console.error('❌ ERROR: MONGO_URI environment variable is missing or empty in Render!');
      process.exit(1);
    }

    // If user accidentally omitted mongodb+srv://
    if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
      if (uri.startsWith('mongodb+srv:')) {
        uri = uri.replace('mongodb+srv:', 'mongodb+srv://');
      } else if (uri.startsWith('mongodb:')) {
        uri = uri.replace('mongodb:', 'mongodb://');
      } else {
        uri = 'mongodb+srv://' + uri;
      }
    }

    // Mask password in debug log for security
    const maskedUri = uri.replace(/:(.*?)@/, ':******@');
    console.log(`📡 Connecting to MongoDB at: ${maskedUri}`);

    await mongoose.connect(uri);
    console.log('✅ MongoDB Connected successfully!');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;