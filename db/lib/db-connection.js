// db/lib/db-connection.js
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error('Please define MONGODB_URI');

let cache = global.__mongooseConnection;

if (!cache) {
  cache = global.__mongooseConnection = { conn: null, promise: null };
}

/**
 * Connect to MongoDB, with caching for development hot reloads.
 * @returns {Promise<mongoose.Connection>}
 */
export async function connectMongo() {
  if (cache.conn) {
    return cache.conn;
  }
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(MONGODB_URI, { bufferCommands: false })
      .then((mongooseInstance) => mongooseInstance.connection)
      .catch((err) => {
        cache.promise = null;
        throw err;
      });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}
