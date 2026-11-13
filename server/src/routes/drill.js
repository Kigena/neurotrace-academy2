import express from 'express';
import crypto from 'crypto';
import auth from '../middleware/auth.js';
import { AttemptEvent } from '../models/AttemptEvent.js';
import { Question } from '../models/Question.js';
import { User } from '../models/User.js';

// The Three-Day Drill. Its questions live in the question collection under
// bank "drill", but they are served only here and never mixed into practice,
// mocks or study analytics. Answers are scored on the server and recorded as
// attempt events (bank "drill"), so drill misses also show up, grouped by
// domain, on the Review Incorrect page.

const router = express.Router();
router.use(auth);

const DRILL_POOL = { bank: 'drill', status: 'active', qaStatus: { $nin: ['NEEDS_REVISION', 'REJECTED'] } };

// All drill questions without their answers. The page shuffles the order.
router.get('/questions', async (req, res) => {
    try {
        const questions = await Question.find(DRILL_POOL)
            .sort({ 'origin.sourceOrder': 1 })
            .select('-_id questionId drillSet domainId sectionId stem options')
            .lean();
        res.json({ questions });
    } catch (error) {
        console.error('Drill questions error:', error.message);
        res.status(500).json({ error: 'Failed to load the drill' });
    }
});

/**
 * Drill progress from the member's drill answers since their last reset:
 * per question how often it was seen and answered right and whether the
 * latest answer was right, plus the review pile (latest answer wrong).
 */
export function drillProgress(events) {
    const stats = {};
    const ordered = [...events].sort((a, b) => a.timestamp - b.timestamp);
    for (const e of ordered) {
        const st = stats[e.questionId] || (stats[e.questionId] = { seen: 0, right: 0, last: 0 });
        st.seen += 1;
        if (e.isCorrect) st.right += 1;
        st.last = e.isCorrect ? 1 : 0;
    }
    const missed = Object.entries(stats).filter(([, st]) => st.last === 0).map(([id]) => id);
    return { stats, missed };
}

async function resetAt(userId) {
    const u = await User.findById(userId).select('drillResetAt').lean();
    return u?.drillResetAt ? u.drillResetAt.getTime() : 0;
}

router.get('/progress', async (req, res) => {
    try {
        const since = await resetAt(req.user.id);
        const events = await AttemptEvent.find({ userId: req.user.id, bank: 'drill', timestamp: { $gte: since } })
            .select('questionId isCorrect timestamp')
            .lean();
        res.json(drillProgress(events));
    } catch (error) {
        console.error('Drill progress error:', error.message);
        res.status(500).json({ error: 'Failed to load drill progress' });
    }
});

// Score one answer. `selectedIndex` is the index in the options as served.
router.post('/answer', async (req, res) => {
    try {
        const { questionId, selectedIndex } = req.body || {};
        if (typeof questionId !== 'string' || questionId.length > 120) return res.status(400).json({ error: 'questionId is required' });
        const q = await Question.findOne({ ...DRILL_POOL, questionId })
            .select('questionId domainId sectionId topicTags difficulty version options bank +answerIndex +explanation +memoryAid')
            .lean();
        if (!q) return res.status(404).json({ error: 'Drill question not found' });
        if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= q.options.length) {
            return res.status(400).json({ error: 'selectedIndex is out of range' });
        }
        const isCorrect = selectedIndex === q.answerIndex;
        const timeMs = Number.isFinite(req.body?.timeMs) ? Math.min(Math.max(Math.round(req.body.timeMs), 0), 3600000) : 0;
        await AttemptEvent.create({
            userId: req.user.id,
            questionId: q.questionId,
            questionVersion: q.version ?? null,
            domainId: q.domainId,
            sectionId: q.sectionId,
            topicTags: q.topicTags || [],
            difficulty: q.difficulty,
            bank: 'drill',
            selectedIndex,
            isCorrect,
            timestamp: Date.now(),
            timeMs,
            mode: 'practice',
            sessionId: `drill_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
            scoredBy: 'server',
        });
        res.json({
            questionId: q.questionId,
            selectedIndex,
            isCorrect,
            correctIndex: q.answerIndex,
            explanation: q.explanation || '',
            memoryAid: q.memoryAid || '',
        });
    } catch (error) {
        console.error('Drill answer error:', error.message);
        res.status(500).json({ error: 'Failed to record the answer' });
    }
});

// Start the drill's progress cards afresh. Earlier answers are kept in the
// attempt history (and on Review Incorrect); they just stop counting here.
router.post('/reset', async (req, res) => {
    try {
        await User.updateOne({ _id: req.user.id }, { $set: { drillResetAt: new Date() } });
        res.json({ stats: {}, missed: [] });
    } catch (error) {
        console.error('Drill reset error:', error.message);
        res.status(500).json({ error: 'Failed to reset drill progress' });
    }
});

export default router;
