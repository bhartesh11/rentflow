const mongoose = require('mongoose');

// Reuse a single connection across the app (and across nodemon reloads in
// dev) instead of opening a new one per require.
const globalForMongoose = global;

async function connectDB() {
  if (globalForMongoose.mongooseConn) {
    return globalForMongoose.mongooseConn;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in the environment');
  }

  mongoose.set('strictQuery', true);

  const conn = await mongoose.connect(uri);
  globalForMongoose.mongooseConn = conn;

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  console.log('MongoDB connected');
  return conn;
}

module.exports = connectDB;
