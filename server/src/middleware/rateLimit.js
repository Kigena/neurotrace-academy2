import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { normalizeEmail } from '../utils/validation.js';

const DEFAULTS = {
    login: { windowMs: 15 * 60 * 1000, limit: 10 },
    register: { windowMs: 60 * 60 * 1000, limit: 10 },
    passwordChange: { windowMs: 15 * 60 * 1000, limit: 10 },
    ai: { windowMs: 60 * 1000, limit: 20 },
    post: { windowMs: 60 * 1000, limit: 10 },
};

const tooMany = (req, res) =>
    res.status(429).json({ error: 'Too many requests. Please try again later.' });

/**
 * Build the limiter set. `overrides` lets tests use small windows/limits.
 */
export function createRateLimiters(overrides = {}) {
    const cfg = (name) => ({ ...DEFAULTS[name], ...(overrides[name] || {}) });

    return {
        // Keyed by client IP + target email so one attacker cannot lock every
        // account from one address, and one account cannot be brute-forced
        // quickly from one address.
        login: rateLimit({
            ...cfg('login'),
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            keyGenerator: (req) => `${ipKeyGenerator(req.ip || '')}|${normalizeEmail(req.body?.email)}`,
            handler: tooMany,
        }),
        register: rateLimit({
            ...cfg('register'),
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            handler: tooMany,
        }),
        passwordChange: rateLimit({
            ...cfg('passwordChange'),
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip || ''),
            handler: tooMany,
        }),
        // Community posts and comments, per user.
        post: rateLimit({
            ...cfg('post'),
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip || ''),
            handler: tooMany,
        }),
        ai: rateLimit({
            ...cfg('ai'),
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip || ''),
            handler: tooMany,
        }),
    };
}
