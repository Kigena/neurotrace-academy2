import express from 'express';
import crypto from 'crypto';
import auth from '../middleware/auth.js';
import { AttemptEvent } from '../models/AttemptEvent.js';
import { QuizSession } from '../models/QuizSession.js';
import { Question } from '../models/Question.js';
import { getPresets } from './quiz.js';
import {
    buildDailyPlan,
    computeMastery,
    computeReadiness,
    outstandingIncorrect,
    recentPerformance,
} from '../services/studyAnalytics.js';
import { clampInt } from '../utils/validation.js';
import { buildReviewQueue, CONFIDENCE_LEVELS, misconceptionSummary } from '../services/reinforcement.js';
import { describeMisconception, errorCodeFor } from '../services/misconceptions.js';
import { getTodaysPlan, planDateFor } from '../services/dailyPlan.js';
import { ladderRungs } from '../services/adaptiveLadder.js';
import { buildMockSchedule, FULL_MOCK_PRESET } from '../services/mockSchedule.js';
import { diagnosticSummary } from '../services/diagnostic.js';

// Where a missed question was answered: the bank it belongs to, or a mock exam.
export function attemptSource(event, question) {
    const bank = question?.bank || event.bank || 'foundation';
    if (bank === 'drill') return 'drill';
    if (event.mode === 'mock') return 'mock';
    return bank === 'challenge' ? 'challenge' : 'bank';
}

/**
 * Per-domain and per-section totals over every scored answer: how many were
 * answered, how many right, and how many questions are still outstanding
 * (latest answer wrong). Domains and sections are sorted weakest first.
 */
export function weaknessBreakdown(events, outstanding) {
    const domains = new Map();
    const slot = (domainId) => {
        if (!domains.has(domainId)) domains.set(domainId, { domainId, attempts: 0, correct: 0, outstanding: 0, sections: new Map() });
        return domains.get(domainId);
    };
    const sectionSlot = (d, sectionId) => {
        if (!d.sections.has(sectionId)) d.sections.set(sectionId, { sectionId, attempts: 0, correct: 0, outstanding: 0 });
        return d.sections.get(sectionId);
    };
    for (const e of events) {
        if (!e.domainId) continue;
        const d = slot(e.domainId);
        const s = sectionSlot(d, e.sectionId);
        d.attempts += 1; s.attempts += 1;
        if (e.isCorrect) { d.correct += 1; s.correct += 1; }
    }
    for (const e of outstanding) {
        if (!e.domainId) continue;
        const d = slot(e.domainId);
        d.outstanding += 1;
        sectionSlot(d, e.sectionId).outstanding += 1;
    }
    const finish = (x) => ({ ...x, accuracy: x.attempts ? Math.round((x.correct / x.attempts) * 100) : null });
    const weakestFirst = (a, b) => b.outstanding - a.outstanding || (a.accuracy ?? 101) - (b.accuracy ?? 101);
    return [...domains.values()]
        .map((d) => finish({ ...d, sections: [...d.sections.values()].map(finish).sort(weakestFirst) }))
        .sort(weakestFirst);
}

// Single-user study dashboard, incorrect-answer review and retry.
// Every query is scoped to the authenticated user.

const router = express.Router();
router.use(auth);

const MAX_EVENTS = 5000;

function ownEvents(userId) {
    return AttemptEvent.find({ userId })
        .sort({ timestamp: -1 })
        .limit(MAX_EVENTS)
        .select('questionId domainId sectionId topicTags difficulty isCorrect timestamp mode selectedIndex bank cognitiveLevel competency confidence errorCode')
        .lean();
}

async function mockResults(userId) {
    const presetTitles = Object.fromEntries(getPresets().map((p) => [p.id, p.title]));
    const sessions = await QuizSession.find({ userId, kind: 'preset', status: 'submitted' })
        .sort({ endTime: -1 })
        .limit(20)
        .select('presetId endTime result.correct result.total result.percent')
        .lean();
    return sessions
        .filter((s) => s.result && s.result.total > 0)
        .map((s) => ({
            presetId: s.presetId,
            title: presetTitles[s.presetId] || s.presetId,
            endTime: s.endTime,
            correct: s.result.correct,
            total: s.result.total,
            percent: s.result.percent,
        }));
}

async function sectionDomainMap() {
    const rows = await Question.aggregate([
        { $match: { status: 'active', bank: { $ne: 'drill' } } },
        { $group: { _id: '$sectionId', domainId: { $first: '$domainId' } } },
    ]);
    return Object.fromEntries(rows.map((r) => [r._id, r.domainId]));
}

// Everything the study dashboard and progress page need, in one call.
router.get('/dashboard', async (req, res) => {
    try {
        const [events, mocks, sectionDomains, activeSession, challengeAvailable] = await Promise.all([
            // The Three-Day Drill stays out of mastery, readiness and reviews.
            ownEvents(req.user.id).then((all) => all.filter((e) => e.bank !== 'drill')),
            mockResults(req.user.id),
            sectionDomainMap(),
            QuizSession.exists({ userId: req.user.id, status: 'active', engineVersion: 2 }),
            Question.countDocuments({ bank: 'challenge', status: 'active', qaStatus: { $nin: ['NEEDS_REVISION', 'REJECTED'] } }),
        ]);
        const mastery = computeMastery(events);
        const performance = recentPerformance(events);
        const incorrect = outstandingIncorrect(events);
        const readiness = computeReadiness({ events, mockResults: mocks });

        // Spaced review only counts questions that can still be served.
        const servable = new Set((await Question.find({ status: 'active', bank: { $ne: 'drill' }, qaStatus: { $nin: ['NEEDS_REVISION', 'REJECTED'] } })
            .select('questionId').lean()).map((q) => q.questionId));
        const queue = buildReviewQueue(events.filter((e) => servable.has(e.questionId)));
        const reviews = {
            ...queue.summary,
            nextDueAt: Number.isFinite(queue.summary.nextDueAt) ? queue.summary.nextDueAt : null,
        };
        const mistakes = misconceptionSummary(events);
        const activeMistakes = mistakes.filter((m) => m.active);

        const mockSchedule = buildMockSchedule({ mocks: mocks.filter((m) => m.presetId === FULL_MOCK_PRESET) });
        const lastDiagnostic = await QuizSession.findOne({ userId: req.user.id, kind: 'diagnostic', status: 'submitted' })
            .sort({ endTime: -1 }).select('sessionId endTime result').lean();
        const diagnostic = diagnosticSummary(lastDiagnostic);
        const ladder = ladderRungs(events.filter((e) => e.bank === 'challenge'));

        // Today's Study: persisted per day so completed items stay marked.
        const freshPlan = buildDailyPlan({
            mastery,
            incorrectCount: incorrect.length,
            sectionDomains,
            challengeAvailable,
            reviewsDue: reviews.dueNow,
            misconception: activeMistakes.find((m) => m.questionsAvailable > 0) || null,
        });
        // Never taken a diagnostic: suggest it (it fills in the mastery map).
        if (!diagnostic.taken) {
            freshPlan.push({ kind: 'diagnostic', count: 40, reason: 'One-time 40-question check across all domains and skills' });
        }
        // A due scheduled mock goes last: it is long, and the shorter items warm up for it.
        if (mockSchedule.dueNow) {
            freshPlan.push({ kind: 'mock', count: 130, reason: `Scheduled full mock exam (target ${mockSchedule.next.date})` });
        }
        const plan = await getTodaysPlan(req.user.id, freshPlan);
        // "Review incorrect" items have no quiz session: done once that many
        // retries were answered today.
        const today = planDateFor();
        const retriesToday = events.filter((e) => e.mode === 'review' && planDateFor(e.timestamp) === today).length;
        const todaysStudy = plan.items.map((i) => (
            i.kind === 'review' && i.status !== 'done' && retriesToday >= (i.count || 1)
                ? { ...i, status: 'done' }
                : i
        ));

        const ranked = (table) => Object.entries(table)
            .filter(([, m]) => m.sufficient)
            .map(([key, m]) => ({ key, ...m }))
            .sort((a, b) => a.score - b.score || b.attempts - a.attempts);

        res.json({
            generatedAt: Date.now(),
            performance,
            readiness,
            mastery,
            sectionDomains,
            weakestSections: ranked(mastery.bySection).slice(0, 5),
            weakestTags: ranked(mastery.byTag).slice(0, 5),
            mockHistory: mocks,
            lastMock: mocks[0] || null,
            incorrectOutstanding: incorrect.length,
            hasActiveSession: !!activeSession,
            challengeAvailable,
            reviews,
            misconceptions: {
                active: activeMistakes.slice(0, 5),
                recent: mistakes.filter((m) => !m.active && m.recentErrors > 0).slice(0, 5),
            },
            mockSchedule,
            ladder,
            diagnostic,
            todaysStudy,
            todaysProgress: {
                done: todaysStudy.filter((i) => i.status === 'done').length,
                total: todaysStudy.length,
                date: plan.date,
            },
        });
    } catch (error) {
        console.error('Study dashboard error:', error.message);
        res.status(500).json({ error: 'Failed to load study dashboard' });
    }
});

// Questions whose most recent attempt was incorrect (historical attempts are
// never modified). Answers are shown here because these were already answered.
// Every item carries its domain, section and where it was missed, and the
// response includes a per-domain and per-section breakdown of all answers so
// the page can show where the weak spots are.
router.get('/incorrect', async (req, res) => {
    try {
        const limit = clampInt(req.query.limit, 1, 500, 50);
        const events = await ownEvents(req.user.id);
        const allOutstanding = outstandingIncorrect(events);
        const outstanding = allOutstanding.slice(0, limit);
        const wrongCounts = new Map();
        for (const e of events) if (!e.isCorrect) wrongCounts.set(e.questionId, (wrongCounts.get(e.questionId) || 0) + 1);

        const docs = await Question.find({ questionId: { $in: outstanding.map((e) => e.questionId) } })
            .select('questionId domainId sectionId topicTags difficulty stem options bank drillSet +answerIndex +explanation +memoryAid')
            .lean();
        const byId = new Map(docs.map((d) => [d.questionId, d]));

        res.json({
            total: allOutstanding.length,
            byDomain: weaknessBreakdown(events, allOutstanding),
            items: outstanding
                .map((e) => {
                    const q = byId.get(e.questionId);
                    if (!q) return null;
                    return {
                        questionId: q.questionId,
                        stem: q.stem,
                        options: q.options,
                        selectedIndex: Number.isInteger(e.selectedIndex) ? e.selectedIndex : null,
                        correctIndex: q.answerIndex,
                        explanation: q.explanation || '',
                        memoryAid: q.memoryAid || null,
                        domainId: q.domainId,
                        sectionId: q.sectionId,
                        topicTags: q.topicTags || [],
                        difficulty: q.difficulty,
                        source: attemptSource(e, q),
                        lastAttemptAt: e.timestamp,
                        timesIncorrect: wrongCounts.get(q.questionId) || 1,
                    };
                })
                .filter(Boolean),
        });
    } catch (error) {
        console.error('Incorrect review error:', error.message);
        res.status(500).json({ error: 'Failed to load incorrect questions' });
    }
});

async function hasPriorIncorrect(userId, questionId) {
    return !!(await AttemptEvent.exists({ userId, questionId, isCorrect: false }));
}

// Retry: the question WITHOUT its answer (only for questions previously missed).
router.get('/retry/:questionId', async (req, res) => {
    const { questionId } = req.params;
    if (!(await hasPriorIncorrect(req.user.id, questionId))) {
        return res.status(404).json({ error: 'No incorrect attempt found for this question' });
    }
    const q = await Question.findOne({ questionId }).select('questionId domainId sectionId topicTags difficulty stem options').lean();
    if (!q) return res.status(404).json({ error: 'Question not found' });
    res.json({ question: q });
});

// Submit a retry. Recorded as a NEW scored attempt (mode "review"); earlier
// attempts, including the original incorrect one, are left untouched.
router.post('/retry/:questionId', async (req, res) => {
    try {
        const { questionId } = req.params;
        const { selectedIndex } = req.body || {};
        const confidence = CONFIDENCE_LEVELS.includes(req.body?.confidence) ? req.body.confidence : undefined;
        if (!(await hasPriorIncorrect(req.user.id, questionId))) {
            return res.status(404).json({ error: 'No incorrect attempt found for this question' });
        }
        const q = await Question.findOne({ questionId }).select('questionId domainId sectionId topicTags difficulty version options bank cognitiveLevel competency +answerIndex +explanation +memoryAid').lean();
        if (!q) return res.status(404).json({ error: 'Question not found' });
        if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= q.options.length) {
            return res.status(400).json({ error: 'selectedIndex is out of range' });
        }
        const isCorrect = selectedIndex === q.answerIndex;
        const errorCode = isCorrect ? undefined : errorCodeFor(q.questionId, q.options[selectedIndex]) || undefined;
        const timeMs = Number.isFinite(req.body?.timeMs) ? Math.min(Math.max(Math.round(req.body.timeMs), 0), 3600000) : 0;
        await AttemptEvent.create({
            userId: req.user.id,
            questionId: q.questionId,
            questionVersion: q.version ?? null,
            domainId: q.domainId,
            sectionId: q.sectionId,
            topicTags: q.topicTags || [],
            difficulty: q.difficulty,
            bank: q.bank || 'foundation',
            cognitiveLevel: q.cognitiveLevel ?? undefined,
            competency: q.competency ?? undefined,
            selectedIndex,
            isCorrect,
            timestamp: Date.now(),
            timeMs,
            mode: 'review',
            sessionId: `retry_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
            scoredBy: 'server',
            confidence,
            errorCode,
        });
        res.json({
            questionId,
            selectedIndex,
            isCorrect,
            correctIndex: q.answerIndex,
            explanation: q.explanation || '',
            memoryAid: q.memoryAid || null,
            misconception: errorCode ? describeMisconception(errorCode) : null,
        });
    } catch (error) {
        console.error('Retry error:', error.message);
        res.status(500).json({ error: 'Failed to record retry' });
    }
});

export default router;
