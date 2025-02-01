// scripts/seed.js
import mongoose from 'mongoose';
import User from '../models/User.js'; // Adjust the path as necessary
import connectMongoDB from '../lib/mongo/index.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

const seedUsers = [
  {
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'AdminPassword123', // Use a strong password
    role: 'admin',
  },
  // Add more users as needed
];

async function seedDatabase() {
  try {
    await connectMongoDB();

    for (const userData of seedUsers) {
      // Check if the user already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        console.log(`User with email ${userData.email} already exists.`);
        continue;
      }

      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      // Create the user
      const newUser = new User({
        name: userData.name,
        email: userData.email,
        password: hashedPassword,
        role: userData.role,
      });

      await newUser.save();
      console.log(`User ${userData.email} created successfully.`);
    }

    console.log('Database seeding completed.');
    process.exit(0);
  } catch (error) {
    console.error('Database seeding error:', error);
    process.exit(1);
  }
}

seedDatabase();
