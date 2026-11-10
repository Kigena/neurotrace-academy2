import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';

import { createAuthRouter } from './routes/auth.js';
import { createChatRouter } from './routes/chat.js';
import { createFeedRouter } from './routes/feed.js';
import casesRoutes from './routes/cases.js';
import caseProgressRoutes from './routes/caseProgress.js';
import adminRoutes from './routes/admin.js';
import aiRoutes from './routes/ai.js';
import gamificationRoutes from './routes/gamification.js';
import quizRoutes from './routes/quiz.js';
import progressRoutes from './routes/progress.js';
import blueprintRoutes from './routes/blueprint.js';
import studyRoutes from './routes/study.js';
import profileRoutes from './routes/profile.js';
import notificationRoutes from './routes/notifications.js';
import { createRateLimiters } from './middleware/rateLimit.js';
import { getAllowedOrigins } from './config/env.js';

/**
 * Build the Express application without connecting to MongoDB or listening.
 * `options.rateLimits` lets tests tighten or relax limiter windows.
 */
export function createApp(options = {}) {
    const app = express();
    const limiters = createRateLimiters(options.rateLimits);
    const allowedOrigins = getAllowedOrigins();

    // Render / most PaaS terminate TLS in a single proxy hop.
    app.set('trust proxy', 1);
    app.disable('x-powered-by');

    app.use(helmet({
        // Uploaded images are displayed by the frontend on another origin.
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    }));
    app.use(cors({
        origin(origin, cb) {
            // Non-browser clients (curl, health checks) send no Origin header.
            if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
            return cb(null, false);
        },
        credentials: true,
    }));
    app.use(express.json({ limit: '1mb' }));

    // Local-disk uploads (fallback when Cloudinary is not configured).
    // Served with headers that prevent them from executing as active content.
    app.use('/uploads', express.static('uploads', {
        dotfiles: 'deny',
        index: false,
        setHeaders(res) {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        },
    }));

    app.get('/', (req, res) => {
        res.send('NeuroLinea API is running');
    });

    // Health check endpoint for uptime monitoring
    app.get('/health', (req, res) => {
        res.status(200).json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
        });
    });

    app.use('/api/auth', createAuthRouter({ limiters }));
    app.use('/api/chat', createChatRouter({ limiters }));
    app.use('/api/feed', createFeedRouter({ limiters }));
    app.use('/api/case-progress', caseProgressRoutes);
    app.use('/api/cases', casesRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/ai', limiters.ai, aiRoutes);
    app.use('/api/gamification', gamificationRoutes);
    app.use('/api/quiz', quizRoutes);
    app.use('/api/blueprint', blueprintRoutes);
    app.use('/api/study', studyRoutes);
    app.use('/api/profile', profileRoutes);
    app.use('/api/notifications', notificationRoutes);
    // /api/progress, /api/progress/weak-topics, /api/sessions, /api/sessions/:id
    app.use('/api', progressRoutes);

    app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: err.message });
        }
        if (err?.status && err.status < 500) {
            return res.status(err.status).json({ error: err.message });
        }
        if (err?.type === 'entity.parse.failed') {
            return res.status(400).json({ error: 'Invalid JSON body' });
        }
        console.error('Unhandled error:', err?.message);
        res.status(500).json({ error: 'Internal server error' });
    });

    return app;
}
