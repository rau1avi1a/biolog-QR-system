// models/User.js
import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

// Define the User schema
const userSchema = new Schema(
    {
        name: { type: String, required: true }, // Full name of the user
        email: { type: String, required: true, unique: true }, // Unique email address
        password: { type: String, required: true }, // Hashed password
        role: { type: String, enum: ["admin", "user"], default: "user" }, // Role-based access
        createdAt: { type: Date, default: Date.now }, // Timestamp for account creation
    },
    { timestamps: true,
        strict: false
     }
);

// Pre-save hook to hash passwords before saving
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next(); // Skip if password is not modified

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Method to compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Virtual field to exclude password in JSON responses
userSchema.set("toJSON", {
    transform: (doc, ret) => {
        delete ret.password;
        return ret;
    },
});

// Create or retrieve the User model
const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
