import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/family_tree';
// Set explicitly so an Atlas URI without a database name doesn't fall back to "test".
const DB_NAME = process.env.MONGODB_DB || 'family_tree';

let connection = null;

// Reuses one connection; serverless (Vercel) invocations call this on every request.
export function connectDB() {
  connection ??= mongoose.connect(MONGODB_URI, { dbName: DB_NAME }).then(
    (m) => {
      console.log(`MongoDB connected: ${m.connection.name}`);
      return m;
    },
    (err) => {
      connection = null; // let the next request retry
      throw err;
    }
  );
  return connection;
}
