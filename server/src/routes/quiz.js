import express from 'express';
import crypto from 'crypto';
import { createRequire } from 'module';
import auth from '../middleware/auth.js';
import { QuizSession } from '../models/QuizSession.js';
import { AttemptEvent } from '../models/AttemptEvent.js';
import { Question } from '../models/Question.js';
import GamificationService from '../services/gamificationService.js';
import { BLUEPRINT_KEY } from '../blueprint/abret2026.js';
import { buildStudyProfile, selectWeakAreas } from '../services/studyAnalytics.js';
import { buildReviewQueue, CONFIDENCE_LEVELS, selectMisconceptionDrill } from '../services/reinforcement.js';
import { describeMisconception, errorCodeFor, isMisconceptionCode } from '../services/misconceptions.js';
import { completePlanItem, findTodaysItem, startPlanItem } from '../services/dailyPlan.js';
import { DIAGNOSTIC_TIME_LIMIT_SEC, selectDiagnostic } from '../services/diagnostic.js';
import { STUDY_SETS, countStudySets, isStudySet, parseStudySetSize, selectStudySet } from '../services/studySets.js';
import { ladderRungs, levelMixForRung, MAX_ADAPTIVE_INSERTS, MIN_LEVEL, pickAdaptiveQuestion } from '../services/adaptiveLadder.js';
import {
    DOMAIN_QUICKSTART,
    EXPIRY_GRACE_MS,
    MAX_CUSTOM_QUESTIONS,
    TIME_LIMITS_SEC,
    CALC_CORE_TAG,
    buildOptionOrder,
    displayIndexOf,
    resolvePresetAllocation,
    scoreSession,
    selectCustom,
    selectDomainQuickStart,
    selectForPreset,
    selectChallenge,
    selectChallengeMock,
    poolCoversPreset,
    CHALLENGE_SIZES,
    toPublicQuestion,
    xpForPercent,
} from '../services/quizEngine.js';

const require = createRequire(import.meta.url);
const presetsData = require('../data/mockExamPresets.json');

const router = express.Router();
router.use(auth);

const MODES = ['practice', 'timed', 'mock'];
const WEAK_AREA_SIZES = [10, 20, 30];
const REVIEW_SIZES = [10, 20];
const DRILL_SIZES = [5, 10];
const REINFORCEMENT_EVENT_FIELDS = 'questionId isCorrect timestamp confidence errorCode';
const POOL_FIELDS = 'questionId domainId sectionId topicTags difficulty origin.sourceOrder bank cognitiveLevel competency';
const CONTENT_FIELDS = 'questionId domainId sectionId topicTags difficulty stem options version bank cognitiveLevel competency';

// Questions withheld from every session until revised.
// The Focus Drills bank is never served here: it has its own page.
const SERVABLE = { status: 'active', qaStatus: { $nin: ['NEEDS_REVISION', 'REJECTED'] }, bank: { $ne: 'drill' } };
// Standard sessions (practice, timed, mocks, weak areas) use the foundation
// bank; the Challenge Bank is served only by "Challenge me" while its pilot
// is under human review.
const FOUNDATION_POOL = { ...SERVABLE, bank: { $nin: ['challenge', 'drill'] } };
const CHALLENGE_POOL = { ...SERVABLE, bank: 'challenge' };
const KEY_FIELDS = `${CONTENT_FIELDS} +answerIndex +explanation`;

export function getPresets() {
    return presetsData.presets;
}

// ----------------------------------------------------------------- helpers ---

const asStringArray = (v, max = 200) =>
    Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.length <= 200).slice(0, max) : [];

async function loadQuestionMap(ids, fields) {
    const docs = await Question.find({ questionId: { $in: ids } }).select(fields).lean();
    return new Map(docs.map((d) => [d.questionId, d]));
}

function answersToObject(answers) {
    if (!answers) return {};
    return answers instanceof Map ? Object.fromEntries(answers) : { ...answers };
}

function isExpired(session, now = Date.now()) {
    return !!session.expiresAt && now > new Date(session.expiresAt).getTime() + EXPIRY_GRACE_MS;
}

function sessionSummary(session) {
    return {
        sessionId: session.sessionId,
        mode: session.mode,
        kind: session.kind,
        presetId: session.presetId,
        blueprintKey: session.blueprintKey,
        status: session.status,
        startTime: session.startTime,
        expiresAt: session.expiresAt,
        timeLimitSec: session.timeLimitSec,
        questionCount: session.items?.length ?? session.questionIds?.length ?? 0,
        serverNow: Date.now(),
        expired: session.status === 'active' && isExpired(session),
    };
}

/**
 * Public, answer-free view of an in-progress session. In practice mode the
 * feedback for already-answered questions is included (it was already shown).
 */
async function buildActivePayload(session) {
    const ids = session.items.map((i) => i.questionId);
    const needKey = session.mode === 'practice';
    const qmap = await loadQuestionMap(ids, needKey ? KEY_FIELDS : CONTENT_FIELDS);
    const answers = answersToObject(session.answers);

    const questions = session.items
        .map((item) => {
            const q = qmap.get(item.questionId);
            return q ? withAdaptive(toPublicQuestion(q, item.optionOrder), item) : null;
        })
        .filter(Boolean);

    const savedAnswers = {};
    for (const item of session.items) {
        const a = answers[item.questionId];
        if (!a) continue;
        const entry = { selectedIndex: a.chosenIndex };
        if (needKey) {
            const q = qmap.get(item.questionId);
            entry.isCorrect = a.isCorrect;
            entry.correctIndex = displayIndexOf(item.optionOrder, q.answerIndex);
            entry.explanation = q.explanation || '';
            const code = a.isCorrect ? null : errorCodeOf(q, a.originalIndex);
            entry.misconception = code ? describeMisconception(code) : null;
        }
        savedAnswers[item.questionId] = entry;
    }

    return { session: sessionSummary(session), questions, answers: savedAnswers };
}

async function buildReview(session) {
    const ids = session.items.map((i) => i.questionId);
    const qmap = await loadQuestionMap(ids, KEY_FIELDS);
    const answers = answersToObject(session.answers);
    return session.items
        .map((item) => {
            const q = qmap.get(item.questionId);
            if (!q) return null;
            const a = answers[item.questionId];
            const correctIndex = displayIndexOf(item.optionOrder, q.answerIndex);
            const selectedIndex = a ? a.chosenIndex : null;
            return {
                ...toPublicQuestion(q, item.optionOrder),
                selectedIndex,
                correctIndex,
                isCorrect: selectedIndex !== null && selectedIndex === correctIndex,
                explanation: q.explanation || '',
            };
        })
        .filter(Boolean);
}

function resultToPlain(result) {
    if (!result) return null;
    const conv = (m) => (m instanceof Map ? Object.fromEntries(m) : m || {});
    return {
        correct: result.correct,
        attempted: result.attempted,
        total: result.total,
        percent: result.percent,
        percentOfAttempted: result.percentOfAttempted,
        breakdown: {
            byDomain: conv(result.breakdown?.byDomain),
            bySection: conv(result.breakdown?.bySection),
            byTag: conv(result.breakdown?.byTag),
            byDifficulty: conv(result.breakdown?.byDifficulty),
            byCompetency: conv(result.breakdown?.byCompetency),
        },
    };
}

function withAdaptive(publicQuestion, item) {
    return item.adaptive?.role ? { ...publicQuestion, adaptive: { role: item.adaptive.role, fromLevel: item.adaptive.fromLevel } } : publicQuestion;
}

/**
 * Adaptive ladder: after a miss on an L4-L6 Challenge question insert an
 * easier question on the same topic right after it; after a correct
 * step-down answer insert one back at the original level. Returns the
 * inserted public question, or null.
 */
async function insertAdaptiveQuestion(session, item, q, isCorrect, userId) {
    if (session.mode !== 'practice' || !Number.isInteger(q.cognitiveLevel) || q.bank !== 'challenge') return null;
    if (session.items.filter((i) => i.adaptive?.role).length >= MAX_ADAPTIVE_INSERTS) return null;

    let role;
    let targetLevel;
    if (!isCorrect && q.cognitiveLevel > MIN_LEVEL) {
        role = 'step-down';
        targetLevel = q.cognitiveLevel - 1;
    } else if (isCorrect && item.adaptive?.role === 'step-down' && item.adaptive.fromLevel > q.cognitiveLevel) {
        role = 'climb-up';
        targetLevel = item.adaptive.fromLevel;
    } else {
        return null;
    }

    const [pool, events] = await Promise.all([
        Question.find({ ...CHALLENGE_POOL, cognitiveLevel: { $in: [targetLevel, targetLevel - 1] } }).select(POOL_FIELDS).lean(),
        AttemptEvent.find({ userId }).sort({ timestamp: -1 }).limit(2000).select(REINFORCEMENT_EVENT_FIELDS).lean(),
    ]);
    const pick = pickAdaptiveQuestion(pool, {
        failed: q,
        targetLevel,
        excludeIds: new Set(session.items.map((i) => i.questionId)),
        events,
        allowLower: role === 'step-down',
    });
    if (!pick) return null;

    const full = await Question.findOne({ questionId: pick.questionId }).select(CONTENT_FIELDS).lean();
    if (!full) return null;
    const fromLevel = role === 'step-down' ? (item.adaptive?.role === 'step-down' ? item.adaptive.fromLevel : q.cognitiveLevel) : targetLevel;
    const newItem = {
        questionId: full.questionId,
        questionVersion: full.version ?? null,
        optionOrder: buildOptionOrder(full.options, true),
        adaptive: { role, fromLevel, parentId: q.questionId },
    };
    const position = session.items.findIndex((i) => i.questionId === item.questionId) + 1;
    const res = await QuizSession.updateOne(
        { _id: session._id, status: 'active', questionIds: { $ne: full.questionId } },
        {
            $push: {
                items: { $each: [newItem], $position: position },
                questionIds: { $each: [full.questionId], $position: position },
            },
            $set: { updatedAt: new Date() },
        }
    );
    if (!res.modifiedCount) return null;
    return { afterQuestionId: item.questionId, question: withAdaptive(toPublicQuestion(full, newItem.optionOrder), newItem) };
}

/** Misconception code for a wrong canonical choice, or undefined. */
function errorCodeOf(q, originalIndex) {
    if (originalIndex === q.answerIndex) return undefined;
    return errorCodeFor(q.questionId, q.options?.[originalIndex]) || undefined;
}

function attemptEventFor(session, userId, q, answer) {
    return {
        userId,
        questionId: q.questionId,
        questionVersion: q.version ?? null,
        domainId: q.domainId,
        sectionId: q.sectionId,
        topicTags: q.topicTags || [],
        difficulty: q.difficulty,
        bank: q.bank || 'foundation',
        cognitiveLevel: q.cognitiveLevel ?? undefined,
        competency: q.competency ?? undefined,
        selectedIndex: answer.originalIndex,
        isCorrect: answer.originalIndex === q.answerIndex,
        timestamp: Date.now(),
        timeMs: answer.timeMs || 0,
        mode: session.mode,
        sessionId: session.sessionId,
        scoredBy: 'server',
        confidence: CONFIDENCE_LEVELS.includes(answer.confidence) ? answer.confidence : undefined,
        errorCode: errorCodeOf(q, answer.originalIndex),
    };
}

async function insertAttemptsIgnoringDuplicates(docs) {
    if (!docs.length) return;
    try {
        await AttemptEvent.insertMany(docs, { ordered: false });
    } catch (err) {
        // 11000 = duplicate key: the event already exists, which is the
        // desired idempotent outcome.
        const writeErrors = err?.writeErrors || [];
        const nonDup = writeErrors.filter((e) => (e.code ?? e.err?.code) !== 11000);
        if (!writeErrors.length || nonDup.length) throw err;
    }
}

async function findOwnSession(req) {
    return QuizSession.findOne({ sessionId: req.params.sessionId, userId: req.user.id });
}

/**
 * Finalise an active session exactly once. Concurrent/duplicate submissions
 * converge on the same stored result; attempts and XP are written only by
 * the request that performs the transition.
 */
async function submitSession(session, userId) {
    if (session.status === 'submitted') return { session, alreadySubmitted: true };
    if (session.status !== 'active') {
        const err = new Error('Session is not active');
        err.status = 409;
        throw err;
    }

    const ids = session.items.map((i) => i.questionId);
    const qmap = await loadQuestionMap(ids, KEY_FIELDS);
    const answers = answersToObject(session.answers);
    const score = scoreSession(session.items, answers, qmap);

    const answerUpdates = {};
    for (const [qid, a] of Object.entries(answers)) {
        const q = qmap.get(qid);
        if (q && Number.isInteger(a.originalIndex)) {
            answerUpdates[`answers.${qid}.isCorrect`] = a.originalIndex === q.answerIndex;
        }
    }

    const now = Date.now();
    const { perQuestion: _perQuestion, ...result } = score;
    const updated = await QuizSession.findOneAndUpdate(
        { _id: session._id, status: 'active' },
        {
            $set: {
                status: 'submitted',
                submittedAt: new Date(now),
                endTime: now,
                updatedAt: new Date(now),
                result,
                ...answerUpdates,
            },
        },
        { new: true }
    );

    if (!updated) {
        // Another request won the race; return its stored outcome.
        const current = await QuizSession.findById(session._id);
        return { session: current, alreadySubmitted: true };
    }
    if (session.planItemId) await completePlanItem(userId, session.planDate, session.planItemId, session.sessionId, now);

    // Practice answers were recorded when answered; timed/mock answers are
    // recorded now, once.
    if (session.mode !== 'practice') {
        const docs = [];
        for (const item of session.items) {
            const a = answers[item.questionId];
            const q = qmap.get(item.questionId);
            if (a && q && Number.isInteger(a.originalIndex)) docs.push(attemptEventFor(session, userId, q, a));
        }
        await insertAttemptsIgnoringDuplicates(docs);
    }

    // XP consumes only the server-computed score.
    if (result.total > 0) {
        const claimed = await QuizSession.findOneAndUpdate(
            { _id: session._id, xpAwarded: false },
            { $set: { xpAwarded: true } },
            { new: true }
        );
        if (claimed) {
            const { xp, activityType } = xpForPercent(result.percent);
            try {
                await GamificationService.awardXP(userId, xp, activityType, {
                    sessionId: session.sessionId,
                    mode: session.mode,
                    score: { correct: result.correct, total: result.total, percent: result.percent },
                    questionCount: result.total,
                });
            } catch (err) {
                console.error('XP award failed (quiz result unaffected):', err.message);
            }
        }
    }

    return { session: updated, alreadySubmitted: false };
}

// ------------------------------------------------------------------ routes ---

// Presets with their resolved per-domain allocation.
router.get('/presets', (req, res) => {
    res.json({
        blueprintKey: BLUEPRINT_KEY,
        presets: getPresets().map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            questionCount: p.questionCount,
            timeLimitMinutes: p.timeLimitMinutes,
            allocation: p.allocation,
            domainAllocation: resolvePresetAllocation(p),
        })),
    });
});

// Study-page question sets with how many servable questions each holds.
router.get('/study-sets', async (req, res) => {
    try {
        const ids = (await Question.find(CHALLENGE_POOL).select('questionId').lean()).map((q) => q.questionId);
        const counts = countStudySets(ids);
        res.json({ sets: Object.entries(STUDY_SETS).map(([key, s]) => ({ key, title: s.title, count: counts[key] })) });
    } catch (error) {
        console.error('Study sets error:', error.message);
        res.status(500).json({ error: 'Failed to load study sets' });
    }
});

// Create a session. The server selects questions, fixes the option order,
// sets the time limit and returns only answer-free question data.
router.post('/sessions', async (req, res) => {
    try {
        const body = req.body || {};
        const kind = body.kind || 'custom';
        let mode;
        let presetId = null;
        let timeLimitSec;
        let selected;
        let shuffleOptions = true;
        let config;

        // Spaced review and misconception drills may draw on either bank.
        const poolQuery = kind === 'challenge' || kind === 'study-set' ? CHALLENGE_POOL
            : kind === 'review-due' || kind === 'misconception' || kind === 'diagnostic' || kind === 'preset' ? SERVABLE
                : FOUNDATION_POOL;
        const pool = await Question.find(poolQuery).select(POOL_FIELDS).lean();
        if (!pool.length) {
            if (kind === 'challenge') {
                return res.status(503).json({ error: 'The ABRET Challenge Bank has not been imported yet.' });
            }
            return res.status(503).json({ error: 'Question bank is not available. The server operator must run the question import.' });
        }

        if (kind === 'preset') {
            const preset = getPresets().find((p) => p.id === body.presetId);
            if (!preset) return res.status(400).json({ error: 'Unknown preset' });
            mode = 'mock';
            presetId = preset.id;
            timeLimitSec = preset.timeLimitMinutes * 60;
            shuffleOptions = preset.shuffle !== false;
            // Mocks come from the Challenge Bank (higher-order, audited items),
            // favouring questions not yet seen; the foundation bank is used only
            // if the Challenge Bank cannot fill every domain.
            const challengeOnly = pool.filter((q) => q.bank === 'challenge');
            if (poolCoversPreset(challengeOnly, preset)) {
                const events = await AttemptEvent.find({ userId: req.user.id, bank: 'challenge' }).sort({ timestamp: -1 }).limit(5000)
                    .select('questionId timestamp').lean();
                selected = selectChallengeMock(challengeOnly, preset, events);
            } else {
                selected = selectForPreset(pool.filter((q) => q.bank !== 'challenge'), preset);
            }
            config = {
                domains: resolvePresetAllocation(preset).map((a) => a.domainId),
                sections: [], tags: [], difficulty: [],
                shuffle: shuffleOptions,
                questionCount: selected.length,
            };
        } else if (kind === 'domain-quickstart') {
            const domainId = typeof body.domainId === 'string' ? body.domainId : '';
            mode = 'timed';
            timeLimitSec = DOMAIN_QUICKSTART.timeLimitSec;
            selected = selectDomainQuickStart(pool, domainId);
            config = { domains: [domainId], sections: [], tags: [], difficulty: [], shuffle: true, questionCount: selected.length };
        } else if (kind === 'challenge') {
            const size = Number.parseInt(body.questionCount, 10);
            if (!CHALLENGE_SIZES.includes(size)) {
                return res.status(400).json({ error: `questionCount must be one of ${CHALLENGE_SIZES.join(', ')}` });
            }
            // Optional focus on one or more competencies (used by Today's Study),
            // or on the core exam calculations (the calculation drill).
            const competencies = asStringArray(body.competencies);
            const calcDrill = body.focus === 'calc-core';
            let challengePool = competencies.length ? pool.filter((q) => competencies.includes(q.competency)) : pool;
            if (calcDrill) challengePool = challengePool.filter((q) => (q.topicTags || []).includes(CALC_CORE_TAG));
            if (!challengePool.length) {
                return res.status(400).json({ error: 'No Challenge questions match that focus' });
            }
            mode = 'practice';
            timeLimitSec = null;
            // Focused on one competency: centre the level mix on its ladder rung.
            let mix;
            if (competencies.length === 1) {
                const events = await AttemptEvent.find({ userId: req.user.id, bank: 'challenge' }).sort({ timestamp: -1 }).limit(2000)
                    .select('isCorrect timestamp cognitiveLevel competency').lean();
                const rung = ladderRungs(events)[competencies[0]]?.rung;
                if (rung) mix = levelMixForRung(rung);
            }
            selected = selectChallenge(challengePool, size, Math.random, mix);
            config = { domains: [], sections: [], tags: calcDrill ? [...competencies, CALC_CORE_TAG] : competencies, difficulty: [], shuffle: true, questionCount: selected.length };
        } else if (kind === 'study-set') {
            // The questions written for one study page (its Practice tab).
            if (!isStudySet(body.studySet)) return res.status(400).json({ error: 'Unknown study set' });
            const size = parseStudySetSize(body.questionCount);
            if (!size) return res.status(400).json({ error: 'questionCount must be 10, 20 or "all"' });
            selected = selectStudySet(pool, body.studySet, size);
            if (!selected.length) return res.status(400).json({ error: 'No questions are available for this section yet' });
            mode = 'practice';
            timeLimitSec = null;
            config = { domains: [], sections: [], tags: [`study-set:${body.studySet}`], difficulty: [], shuffle: true, questionCount: selected.length };
        } else if (kind === 'weak-areas') {
            const size = Number.parseInt(body.questionCount, 10);
            if (!WEAK_AREA_SIZES.includes(size)) {
                return res.status(400).json({ error: 'questionCount must be 10, 20 or 30' });
            }
            const events = await AttemptEvent.find({ userId: req.user.id })
                .sort({ timestamp: -1 })
                .limit(5000)
                .select('questionId domainId sectionId topicTags isCorrect timestamp')
                .lean();
            mode = 'practice';
            timeLimitSec = null;
            selected = selectWeakAreas(pool, buildStudyProfile(events), size);
            config = { domains: [], sections: [], tags: [], difficulty: [], shuffle: true, questionCount: selected.length };
        } else if (kind === 'diagnostic') {
            const events = await AttemptEvent.find({ userId: req.user.id, bank: 'challenge' }).sort({ timestamp: -1 }).limit(5000)
                .select('questionId').lean();
            selected = selectDiagnostic(pool, events);
            if (selected.length < 20) return res.status(503).json({ error: 'The Challenge Bank is not available for the diagnostic yet.' });
            mode = 'timed';
            timeLimitSec = DIAGNOSTIC_TIME_LIMIT_SEC;
            config = { domains: [], sections: [], tags: [], difficulty: [], shuffle: true, questionCount: selected.length };
        } else if (kind === 'review-due') {
            const size = Number.parseInt(body.questionCount, 10);
            if (!REVIEW_SIZES.includes(size)) {
                return res.status(400).json({ error: `questionCount must be one of ${REVIEW_SIZES.join(', ')}` });
            }
            const events = await AttemptEvent.find({ userId: req.user.id }).sort({ timestamp: -1 }).limit(5000)
                .select(REINFORCEMENT_EVENT_FIELDS).lean();
            const byId = new Map(pool.map((q) => [q.questionId, q]));
            selected = buildReviewQueue(events).due.map((i) => byId.get(i.questionId)).filter(Boolean).slice(0, size);
            if (!selected.length) return res.status(400).json({ error: 'No reviews are due right now' });
            mode = 'practice';
            timeLimitSec = null;
            config = { domains: [], sections: [], tags: [], difficulty: [], shuffle: true, questionCount: selected.length };
        } else if (kind === 'misconception') {
            const size = Number.parseInt(body.questionCount, 10);
            if (!DRILL_SIZES.includes(size)) {
                return res.status(400).json({ error: `questionCount must be one of ${DRILL_SIZES.join(', ')}` });
            }
            if (!isMisconceptionCode(body.code)) return res.status(400).json({ error: 'Unknown misconception code' });
            const events = await AttemptEvent.find({ userId: req.user.id }).sort({ timestamp: -1 }).limit(5000)
                .select(REINFORCEMENT_EVENT_FIELDS).lean();
            selected = selectMisconceptionDrill(pool, body.code, events, size);
            if (!selected.length) return res.status(400).json({ error: 'No questions are available for that mistake yet' });
            mode = 'practice';
            timeLimitSec = null;
            config = { domains: [], sections: [], tags: [body.code], difficulty: [], shuffle: true, questionCount: selected.length };
        } else if (kind === 'custom') {
            mode = MODES.includes(body.mode) ? body.mode : null;
            if (!mode) return res.status(400).json({ error: 'mode must be practice, timed or mock' });
            const requested = Number.parseInt(body.questionCount, 10);
            if (!Number.isInteger(requested) || requested < 1 || requested > MAX_CUSTOM_QUESTIONS) {
                return res.status(400).json({ error: `questionCount must be between 1 and ${MAX_CUSTOM_QUESTIONS}` });
            }
            const filters = {
                domains: asStringArray(body.filters?.domains),
                sections: asStringArray(body.filters?.sections),
                tags: asStringArray(body.filters?.tags),
                difficulty: asStringArray(body.filters?.difficulty),
            };
            shuffleOptions = body.shuffle !== false;
            timeLimitSec = TIME_LIMITS_SEC[mode];
            selected = selectCustom(pool, { filters, questionCount: requested, shuffle: shuffleOptions });
            config = { ...filters, shuffle: shuffleOptions, questionCount: selected.length };
        } else {
            return res.status(400).json({ error: 'Unknown session kind' });
        }

        if (!selected.length) {
            return res.status(400).json({ error: 'No questions match the selected filters' });
        }

        const qmap = await loadQuestionMap(selected.map((q) => q.questionId), CONTENT_FIELDS);
        const items = selected
            .map((q) => qmap.get(q.questionId))
            .filter(Boolean)
            .map((q) => ({
                questionId: q.questionId,
                questionVersion: q.version ?? null,
                optionOrder: buildOptionOrder(q.options, shuffleOptions),
            }));

        // Only one active session per user: older ones are abandoned.
        await QuizSession.updateMany(
            { userId: req.user.id, status: 'active' },
            { $set: { status: 'abandoned', updatedAt: new Date() } }
        );

        const now = Date.now();
        const planLink = await findTodaysItem(req.user.id, body.planItemId, now);
        const session = await QuizSession.create({
            userId: req.user.id,
            sessionId: `session_${now}_${crypto.randomBytes(6).toString('hex')}`,
            engineVersion: 2,
            mode,
            kind,
            presetId,
            blueprintKey: kind === 'preset' ? BLUEPRINT_KEY : null,
            status: 'active',
            questionIds: items.map((i) => i.questionId),
            items,
            answers: {},
            startTime: now,
            expiresAt: timeLimitSec ? new Date(now + timeLimitSec * 1000) : null,
            timeLimitSec: timeLimitSec || null,
            config,
            planDate: planLink?.date ?? null,
            planItemId: planLink?.item.id ?? null,
        });
        if (planLink) await startPlanItem(req.user.id, planLink.date, planLink.item.id, session.sessionId, now);

        res.status(201).json(await buildActivePayload(session));
    } catch (error) {
        console.error('Create session error:', error.message);
        res.status(500).json({ error: 'Failed to create quiz session' });
    }
});

// Resume: the caller's active session, if any.
router.get('/sessions/active', async (req, res) => {
    try {
        const session = await QuizSession.findOne({ userId: req.user.id, status: 'active', engineVersion: 2 })
            .sort({ startTime: -1 });
        if (!session) return res.json({ session: null });
        res.json(await buildActivePayload(session));
    } catch (error) {
        console.error('Active session error:', error.message);
        res.status(500).json({ error: 'Failed to load active session' });
    }
});

// Own quiz history (completed sessions only)
router.get('/sessions/history', async (req, res) => {
    try {
        const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
        const sessions = await QuizSession.find({ userId: req.user.id, endTime: { $ne: null } })
            .sort({ endTime: -1 })
            .limit(limit)
            .lean();
        res.json(sessions.map((s) => ({
            sessionId: s.sessionId,
            mode: s.mode,
            presetId: s.presetId || null,
            startTime: s.startTime,
            endTime: s.endTime,
            engineVersion: s.engineVersion || 1,
            result: s.result ? resultToPlain(s.result) : null,
        })));
    } catch (error) {
        console.error('Get quiz history error:', error.message);
        res.status(500).json({ error: 'Failed to fetch quiz history' });
    }
});

// Record an answer.
router.post('/sessions/:sessionId/answers', async (req, res) => {
    try {
        const session = await findOwnSession(req);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (session.status !== 'active') return res.status(409).json({ error: 'Session is not active' });
        if (isExpired(session)) return res.status(409).json({ error: 'Time has expired for this session', expired: true });

        const { questionId } = req.body || {};
        const selectedIndex = req.body?.selectedIndex;
        const item = session.items.find((i) => i.questionId === questionId);
        if (!item) return res.status(400).json({ error: 'Question is not part of this session' });
        if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= item.optionOrder.length) {
            return res.status(400).json({ error: 'selectedIndex is out of range' });
        }
        const timeMs = Number.isFinite(req.body?.timeMs)
            ? Math.min(Math.max(Math.round(req.body.timeMs), 0), 4 * 60 * 60 * 1000)
            : 0;
        const confidence = CONFIDENCE_LEVELS.includes(req.body?.confidence) ? req.body.confidence : undefined;
        const originalIndex = item.optionOrder[selectedIndex];

        if (session.mode === 'practice') {
            const q = await Question.findOne({ questionId }).select(KEY_FIELDS).lean();
            if (!q) return res.status(410).json({ error: 'Question is no longer available' });
            const correctIndex = displayIndexOf(item.optionOrder, q.answerIndex);
            const feedback = (isCorrect, chosenOriginal) => {
                const code = isCorrect ? null : errorCodeOf(q, chosenOriginal);
                return {
                    questionId,
                    selectedIndex,
                    isCorrect,
                    correctIndex,
                    explanation: q.explanation || '',
                    misconception: code ? describeMisconception(code) : null,
                };
            };

            // Practice answers are final: record only if not already answered.
            const answer = {
                chosenIndex: selectedIndex,
                originalIndex,
                isCorrect: originalIndex === q.answerIndex,
                timeMs,
                answeredAt: new Date(),
                confidence,
            };
            const updated = await QuizSession.findOneAndUpdate(
                { _id: session._id, status: 'active', [`answers.${questionId}`]: { $exists: false } },
                { $set: { [`answers.${questionId}`]: answer, updatedAt: new Date() } },
                { new: true }
            );

            if (!updated) {
                const existing = answersToObject((await QuizSession.findById(session._id)).answers)[questionId];
                if (existing && existing.chosenIndex === selectedIndex) {
                    return res.json({ ...feedback(existing.isCorrect, existing.originalIndex), alreadyRecorded: true });
                }
                return res.status(409).json({ error: 'This question has already been answered' });
            }

            await insertAttemptsIgnoringDuplicates([attemptEventFor(session, req.user.id, q, answer)]);
            const inserted = await insertAdaptiveQuestion(updated, item, q, answer.isCorrect, req.user.id);
            if (!inserted && updated.planItemId && Object.keys(answersToObject(updated.answers)).length >= updated.items.length) {
                await completePlanItem(req.user.id, updated.planDate, updated.planItemId, updated.sessionId);
            }
            return res.json({ ...feedback(answer.isCorrect, originalIndex), inserted });
        }

        // Timed / mock: answers may change until submission; no feedback.
        await QuizSession.updateOne(
            { _id: session._id, status: 'active' },
            {
                $set: {
                    [`answers.${questionId}`]: { chosenIndex: selectedIndex, originalIndex, timeMs, answeredAt: new Date() },
                    updatedAt: new Date(),
                },
            }
        );
        res.json({ questionId, selectedIndex, saved: true });
    } catch (error) {
        console.error('Answer error:', error.message);
        res.status(500).json({ error: 'Failed to record answer' });
    }
});

// Submit. Any score in the request body is ignored.
router.post('/sessions/:sessionId/submit', async (req, res) => {
    try {
        const session = await findOwnSession(req);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        const { session: finalSession, alreadySubmitted } = await submitSession(session, req.user.id);
        res.json({
            session: sessionSummary(finalSession),
            result: resultToPlain(finalSession.result),
            review: await buildReview(finalSession),
            alreadySubmitted,
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ error: error.message });
        console.error('Submit error:', error.message);
        res.status(500).json({ error: 'Failed to submit session' });
    }
});

// Abandon an active session (no score, no further answers).
router.post('/sessions/:sessionId/abandon', async (req, res) => {
    const updated = await QuizSession.findOneAndUpdate(
        { sessionId: req.params.sessionId, userId: req.user.id, status: 'active' },
        { $set: { status: 'abandoned', updatedAt: new Date() } },
        { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Active session not found' });
    res.json({ session: sessionSummary(updated) });
});

// Post-submission review.
router.get('/sessions/:sessionId/review', async (req, res) => {
    try {
        const session = await findOwnSession(req);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (session.status !== 'submitted' || !session.items) {
            return res.status(409).json({ error: 'Review is available after submission' });
        }
        res.json({
            session: sessionSummary(session),
            result: resultToPlain(session.result),
            review: await buildReview(session),
        });
    } catch (error) {
        console.error('Review error:', error.message);
        res.status(500).json({ error: 'Failed to load review' });
    }
});

// Aggregate stats over the caller's completed sessions.
router.get('/stats', async (req, res) => {
    try {
        const sessions = await QuizSession.find({ userId: req.user.id, endTime: { $ne: null } }).lean();
        let totalCorrect = 0;
        let totalQuestions = 0;
        let bestScore = 0;
        for (const s of sessions) {
            let correct;
            let total;
            if (s.result) {
                correct = s.result.correct;
                total = s.result.total;
            } else {
                const answers = Object.values(s.answers || {});
                correct = answers.filter((a) => a.isCorrect).length;
                total = answers.length;
            }
            totalCorrect += correct;
            totalQuestions += total;
            if (total > 0) bestScore = Math.max(bestScore, (correct / total) * 100);
        }
        res.json({
            totalQuizzes: sessions.length,
            averageScore: totalQuestions ? Math.round((totalCorrect / totalQuestions) * 1000) / 10 : 0,
            bestScore: Math.round(bestScore * 10) / 10,
            totalQuestions,
            correctAnswers: totalCorrect,
        });
    } catch (error) {
        console.error('Get quiz stats error:', error.message);
        res.status(500).json({ error: 'Failed to fetch quiz stats' });
    }
});

export default router;
