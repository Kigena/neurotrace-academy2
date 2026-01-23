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

export default router;
