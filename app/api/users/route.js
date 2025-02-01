import User from "@/models/User";
import connectMongoDB from "@lib/mongo/index.js";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

// Create a new user
export async function POST(request) {
    try {
        const { name, email, password, role } = await request.json();

        if (!name || !email || !password) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
        }

        await connectMongoDB();

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return NextResponse.json({ message: "User with this email already exists" }, { status: 400 });
        }

        const newUser = await User.create({ name, email, password, role: role || "user" });

        // Exclude sensitive data (password) in the response
        const responseUser = {
            _id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            createdAt: newUser.createdAt,
        };

        return NextResponse.json(responseUser, { message: "User created successfully" }, { status: 201 });
    } catch (error) {
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
            userName: user.userName,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
        }));

        return NextResponse.json(formattedUsers);
    } catch (error) {
        return NextResponse.json({ message: "Error fetching users", error: error.message }, { status: 500 });
    }
}
