// models/User.js
import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

// Simple base64 encoding/decoding (for testing - not secure for production)
const encode = (text) => {
    if (!text) return null;
    return Buffer.from(text).toString('base64');
};

const decode = (encodedText) => {
    if (!encodedText) return null;
    try {
        return Buffer.from(encodedText, 'base64').toString('utf8');
    } catch (error) {
        console.error('Decode error:', error);
        return null;
    }
};

// Define the User schema
const userSchema = new Schema(
    {
        name: { type: String, required: true }, // Full name of the user
        email: { type: String, required: true, unique: true }, // Unique email address
        password: { type: String, required: true }, // Hashed password
        role: { type: String, default: "operator" }, // Role-based access (dynamic roles)
        createdAt: { type: Date, default: Date.now }, // Timestamp for account creation
        
        // NetSuite credentials (stored encoded)
        netsuiteCredentials: {
            accountId: { type: String }, // NetSuite account ID
            consumerKey: { type: String }, // App consumer key
            consumerSecret: { type: String }, // App consumer secret (encoded)
            tokenId: { type: String }, // User-specific token ID (encoded)
            tokenSecret: { type: String }, // User-specific token secret (encoded)
            isConfigured: { type: Boolean, default: false } // Flag to check if NetSuite is set up
        }
    },
    { 
        timestamps: true,
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

// Method to set NetSuite credentials (with encoding)
userSchema.methods.setNetSuiteCredentials = function (credentials) {
    this.netsuiteCredentials = {
        accountId: credentials.accountId || process.env.NETSUITE_ACCOUNT_ID,
        consumerKey: credentials.consumerKey || process.env.NETSUITE_CONSUMER_KEY,
        consumerSecret: encode(credentials.consumerSecret || process.env.NETSUITE_CONSUMER_SECRET),
        tokenId: encode(credentials.tokenId || process.env.NETSUITE_TOKEN_ID),
        tokenSecret: encode(credentials.tokenSecret || process.env.NETSUITE_TOKEN_SECRET),
        isConfigured: true
    };
};

// Method to get decrypted NetSuite credentials
userSchema.methods.getNetSuiteCredentials = function () {
    if (!this.netsuiteCredentials || !this.netsuiteCredentials.isConfigured) {
        return null;
    }
    
    return {
        accountId: this.netsuiteCredentials.accountId,
        consumerKey: this.netsuiteCredentials.consumerKey,
        consumerSecret: decode(this.netsuiteCredentials.consumerSecret),
        tokenId: decode(this.netsuiteCredentials.tokenId),
        tokenSecret: decode(this.netsuiteCredentials.tokenSecret)
    };
};

// Method to check if NetSuite is configured
userSchema.methods.hasNetSuiteAccess = function () {
    return this.netsuiteCredentials && this.netsuiteCredentials.isConfigured;
};

// Method to get user's role object (populated)
userSchema.methods.getRoleData = async function () {
    const Role = mongoose.model('Role');
    return await Role.findOne({ name: this.role });
};

// Method to check if user has specific permission
userSchema.methods.hasPermission = async function (permission) {
    const roleData = await this.getRoleData();
    return roleData ? roleData.hasPermission(permission) : false;
};

// Method to get user's home route based on role
userSchema.methods.getHomeRoute = async function () {
    const roleData = await this.getRoleData();
    return roleData ? roleData.homeRoute : '/dashboard';
};

// Method to remove NetSuite credentials
userSchema.methods.removeNetSuiteCredentials = function () {
    this.netsuiteCredentials = {
        isConfigured: false
    };
};

// Virtual field to exclude password and encoded credentials in JSON responses
userSchema.set("toJSON", {
    transform: (doc, ret) => {
        delete ret.password;
        // Only show NetSuite status, not the actual credentials
        if (ret.netsuiteCredentials) {
            ret.netsuiteCredentials = {
                isConfigured: ret.netsuiteCredentials.isConfigured
            };
        }
        return ret;
    },
});

// Create or retrieve the User model
const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;