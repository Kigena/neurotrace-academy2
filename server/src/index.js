import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5003;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/neurotrace';

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
    })
    .catch((err) => {
        console.error('❌ MongoDB connection error:', err);
    });

import authRoutes from './routes/auth.js';

// Routes
app.get('/', (req, res) => {
    res.send('NeuroTrace Academy API is running');
});

// Auth Routes
app.use('/api/auth', authRoutes);

import { QuizSession } from './models/QuizSession.js';
import { AttemptEvent } from './models/AttemptEvent.js';

// --- Quiz Session Routes ---

// Create new session
app.post('/api/sessions', async (req, res) => {
    try {
        const session = new QuizSession(req.body);
        await session.save();
        res.status(201).json(session);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get session by ID
app.get('/api/sessions/:sessionId', async (req, res) => {
    try {
        const session = await QuizSession.findOne({ sessionId: req.params.sessionId });
        if (!session) return res.status(404).json({ error: 'Session not found' });
        res.json(session);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update session
app.put('/api/sessions/:sessionId', async (req, res) => {
    try {
        const session = await QuizSession.findOneAndUpdate(
            { sessionId: req.params.sessionId },
            { ...req.body, updatedAt: Date.now() },
            { new: true }
        );
        if (!session) return res.status(404).json({ error: 'Session not found' });
        res.json(session);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// --- Progress Routes ---

// Save attempt event
app.post('/api/progress', async (req, res) => {
    try {
        const attempt = new AttemptEvent(req.body);
        await attempt.save();
        res.status(201).json(attempt);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get progress events (optional user filter)
app.get('/api/progress', async (req, res) => {
    try {
        const query = req.query.userId ? { userId: req.query.userId } : {};
        const attempts = await AttemptEvent.find(query).sort({ timestamp: -1 });
        res.json(attempts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
