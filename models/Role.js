// models/Role.js
import mongoose, { Schema } from "mongoose";

const roleSchema = new Schema(
    {
        name: { 
            type: String, 
            required: true, 
            unique: true,
            lowercase: true,
            trim: true 
        }, // Role name (e.g., "admin", "operator")
        displayName: { 
            type: String, 
            required: true 
        }, // Human-readable name (e.g., "Administrator", "Operator")
        description: { 
            type: String 
        }, // Description of what this role does
        permissions: [{
            type: String
        }], // Array of permission strings
        homeRoute: { 
            type: String, 
            default: "/dashboard" 
        }, // Default route after login for this role
        isActive: { 
            type: Boolean, 
            default: true 
        }, // Can be disabled without deleting
        isSystem: { 
            type: Boolean, 
            default: false 
        }, // System roles can't be deleted (admin, operator)
        createdBy: { 
            type: Schema.Types.ObjectId, 
            ref: "User" 
        }, // Who created this role
    },
    { timestamps: true }
);

// Static method to seed default roles
roleSchema.statics.seedDefaultRoles = async function() {
    const defaultRoles = [
        {
            name: "admin",
            displayName: "Administrator", 
            description: "Full system access and user management",
            permissions: ["*"], // Wildcard for all permissions
            homeRoute: "/admin/dashboard",
            isSystem: true
        },
        {
            name: "operator",
            displayName: "Operator",
            description: "Standard user with operational access", 
            permissions: ["read:dashboard", "write:transactions", "read:reports"],
            homeRoute: "/dashboard",
            isSystem: true
        }
    ];

    for (const roleData of defaultRoles) {
        await this.findOneAndUpdate(
            { name: roleData.name },
            roleData,
            { upsert: true, new: true }
        );
    }
};

// Method to check if role has specific permission
roleSchema.methods.hasPermission = function(permission) {
    if (this.permissions.includes("*")) return true; // Admin wildcard
    return this.permissions.includes(permission);
};

// Method to add permission
roleSchema.methods.addPermission = function(permission) {
    if (!this.permissions.includes(permission)) {
        this.permissions.push(permission);
    }
};

// Method to remove permission  
roleSchema.methods.removePermission = function(permission) {
    this.permissions = this.permissions.filter(p => p !== permission);
};

// Prevent deletion of system roles
roleSchema.pre('deleteOne', { document: true, query: false }, function(next) {
    if (this.isSystem) {
        const error = new Error('Cannot delete system role');
        error.status = 400;
        return next(error);
    }
    next();
});

const Role = mongoose.models.Role || mongoose.model("Role", roleSchema);

export default Role;