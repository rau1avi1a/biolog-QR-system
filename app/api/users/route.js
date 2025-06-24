import User from "@/db/schemas/User";
import connectMongoDB from '@/db/index';
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

// Create a new user with optional NetSuite credentials
export async function POST(request) {
    try {
        const { 
            name, 
            email, 
            password, 
            role,
            netsuiteCredentials 
        } = await request.json();

        if (!name || !email || !password) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
        }

        await connectMongoDB();

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return NextResponse.json({ message: "User with this email already exists" }, { status: 400 });
        }

        const newUser = await User.create({ 
            name, 
            email, 
            password, 
            role: role || "operator" 
        });

        // Set up NetSuite credentials if provided
        if (netsuiteCredentials) {
            if (netsuiteCredentials.useEnvVars) {
                // Use environment variables
                newUser.setNetSuiteCredentials({
                    accountId: process.env.NETSUITE_ACCOUNT_ID,
                    consumerKey: process.env.NETSUITE_CONSUMER_KEY,
                    consumerSecret: process.env.NETSUITE_CONSUMER_SECRET,
                    tokenId: process.env.NETSUITE_TOKEN_ID,
                    tokenSecret: process.env.NETSUITE_TOKEN_SECRET
                });
            } else {
                // Use provided credentials
                const { accountId, consumerKey, consumerSecret, tokenId, tokenSecret } = netsuiteCredentials;
                
                if (accountId && consumerKey && consumerSecret && tokenId && tokenSecret) {
                    newUser.setNetSuiteCredentials({
                        accountId,
                        consumerKey,
                        consumerSecret,
                        tokenId,
                        tokenSecret
                    });
                }
            }
            
            await newUser.save();
        }

        // Exclude sensitive data (password) in the response
        const responseUser = {
            _id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            createdAt: newUser.createdAt,
            netsuiteConfigured: newUser.hasNetSuiteAccess()
        };

        return NextResponse.json(responseUser, { status: 201 });
    } catch (error) {
        console.error('User creation error:', error);
        return NextResponse.json({ message: "Error creating user", error: error.message }, { status: 500 });
    }
}

// Get all users
export async function GET() {
    try {
        await connectMongoDB();

        const users = await User.find();

        // Exclude sensitive data (password) for all users in the response
        const formattedUsers = users.map((user) => ({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
            netsuiteConfigured: user.hasNetSuiteAccess()
        }));

        return NextResponse.json(formattedUsers);
    } catch (error) {
        return NextResponse.json({ message: "Error fetching users", error: error.message }, { status: 500 });
    }
}