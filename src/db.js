import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/family_tree';

export async function connectDB() {
  await mongoose.connect(MONGODB_URI);
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
}
