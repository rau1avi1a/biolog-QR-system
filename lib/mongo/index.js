// app/lib/mongo.js (or wherever you keep your connection utility)
import mongoose from "mongoose"
const MONGODB_URI = process.env.MONGODB_URI

let isConnected = false // track the connection status

export default async function connectMongoDB() {
  if (isConnected) {
    // Already connected—just return
    return
  }

  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error("Please define the MONGODB_URI environment variable.")
  }

  try {
    // Mongoose 7+ recommended approach:
    await mongoose.connect(uri, {
      // optional Mongoose config
    })

    isConnected = true
    console.log("✅ MongoDB connected successfully!")
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error.message)
    throw new Error("Could not connect to MongoDB.")
  }
}
