import express from 'express';
import { User } from '../models/User.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
    try {
        const { name, email, passwordHash } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        const user = new User({
            name,
            email,
            passwordHash
        });

        await user.save();

        // Return user without sensitive data if possible, or just the basics
        const userObj = user.toObject();
        delete userObj.passwordHash;

        res.status(201).json(userObj);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, passwordHash } = req.body;

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Verify password
        // Note: In a real app with bcrypt, we'd use compare(). 
        // Since frontend sends hash (legacy design preserved), we compare strings.
        if (user.passwordHash !== passwordHash) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Update last login
        user.lastLogin = Date.now();
        await user.save();

        const userObj = user.toObject();
        delete userObj.passwordHash;

        res.json(userObj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Profile
router.put('/profile', async (req, res) => {
    try {
        const { userId, name, email } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        // Check if new email is already taken by another user
        if (email) {
            const existingUser = await User.findOne({
                email: email.toLowerCase(),
                _id: { $ne: userId }
            });
            if (existingUser) {
                return res.status(409).json({ error: 'Email already in use' });
            }
        }

        // Update user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (name) user.name = name;
        if (email) user.email = email.toLowerCase();

        await user.save();

        const userObj = user.toObject();
        delete userObj.passwordHash;

        res.json(userObj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Change Password
router.put('/password', async (req, res) => {
    try {
        const { userId, currentPasswordHash, newPasswordHash } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        if (user.passwordHash !== currentPasswordHash) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Update password
        user.passwordHash = newPasswordHash;
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
