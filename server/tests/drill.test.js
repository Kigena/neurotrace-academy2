import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { setupTestDb, makeApp, registerUser, bearer, seedFixtureBank } from './helpers.js';
import { importQuestions, loadSourceFile } from '../src/services/questionImport.js';
import { Question } from '../src/models/Question.js';
import { drillProgress } from '../src/routes/drill.js';
import { attemptSource, weaknessBreakdown } from '../src/routes/study.js';

setupTestDb();
const app = makeApp();
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const drillFile = loadSourceFile(path.join(serverRoot, 'src', 'data', 'drill', 'three-day-drill.json'));

let key;
beforeAll(async () => {
    await seedFixtureBank(40);
    const report = await importQuestions({ data: drillFile, sourceFile: 'drill', bank: 'drill' });
    expect(report).toMatchObject({ inserted: 90, failed: 0, reconciled: true });
    key = new Map(drillFile.questions.map((q) => [q.id, q]));
});

const get = (u, url) => request(app).get(url).set(bearer(u.token));
const post = (u, url, body) => request(app).post(url).set(bearer(u.token)).send(body);
const wrongIndex = (id) => (key.get(id).answerIndex + 1) % 4;

describe('drill import file', () => {
    it('has 30 questions per set, ABRET domains and a balanced answer key', () => {
        const qs = drillFile.questions;
        for (const set of ['neuro', 'peds', 'meds']) expect(qs.filter((q) => q.drillSet === set)).toHaveLength(30);
        for (const q of qs) {
            expect(q.domainId).toMatch(/^domain-[1-4]$/);
            expect(q.sectionId.startsWith(`d${q.domainId.slice(-1)}-`)).toBe(true);
            expect(q.memoryAid).toBeTruthy();
        }
        const positions = [0, 1, 2, 3].map((i) => qs.filter((q) => q.answerIndex === i).length);
        expect(Math.min(...positions)).toBeGreaterThanOrEqual(15);
    });

    it('is idempotent and rejects drill questions without a set or memory aid', async () => {
        const again = await importQuestions({ data: drillFile, sourceFile: 'drill', bank: 'drill', dryRun: true });
        expect(again).toMatchObject({ inserted: 0, unchanged: 90, failed: 0 });
        const bad = { questions: [{ ...drillFile.questions[0], id: 'drill-bad', drillSet: undefined, memoryAid: '' }] };
        const r = await importQuestions({ data: bad, bank: 'drill', dryRun: true });
        expect(r.failed).toBe(1);
        expect(await Question.countDocuments({ bank: 'drill' })).toBe(90);
    });
});

describe('drill stays out of the main bank', () => {
    it('never serves drill questions in practice, timed or mock sessions', async () => {
        const u = await registerUser(app);
        for (const mode of ['practice', 'timed', 'mock']) {
            const res = await post(u, '/api/quiz/sessions', { kind: 'custom', mode, questionCount: 100 });
            expect(res.status).toBe(201);
            expect(res.body.questions.some((q) => q.questionId.startsWith('drill-'))).toBe(false);
            await post(u, `/api/quiz/sessions/${res.body.sessionId}/abandon`, {});
        }
    });
});

describe('drill API', () => {
    it('serves the questions without answers and scores on the server', async () => {
        const u = await registerUser(app);
        const { body } = await get(u, '/api/drill/questions');
        expect(body.questions).toHaveLength(90);
        expect(body.questions[0]).not.toHaveProperty('answerIndex');
        expect(body.questions[0]).not.toHaveProperty('explanation');
        expect(body.questions[0]).not.toHaveProperty('memoryAid');

        const right = await post(u, '/api/drill/answer', { questionId: 'drill-n01', selectedIndex: key.get('drill-n01').answerIndex });
        expect(right.body).toMatchObject({ isCorrect: true, correctIndex: key.get('drill-n01').answerIndex });
        expect(right.body.memoryAid).toBe(key.get('drill-n01').memoryAid);
        const wrong = await post(u, '/api/drill/answer', { questionId: 'drill-p05', selectedIndex: wrongIndex('drill-p05') });
        expect(wrong.body.isCorrect).toBe(false);

        const prog = await get(u, '/api/drill/progress');
        expect(prog.body.stats['drill-n01']).toEqual({ seen: 1, right: 1, last: 1 });
        expect(prog.body.missed).toEqual(['drill-p05']);
    });

    it('rejects main-bank questions and bad indexes', async () => {
        const u = await registerUser(app);
        expect((await post(u, '/api/drill/answer', { questionId: 'fx-d1-0', selectedIndex: 0 })).status).toBe(404);
        expect((await post(u, '/api/drill/answer', { questionId: 'drill-n01', selectedIndex: 9 })).status).toBe(400);
        expect((await request(app).get('/api/drill/questions')).status).toBe(401);
    });

    it('reset clears the drill cards but keeps the miss on Review Incorrect', async () => {
        const u = await registerUser(app);
        await post(u, '/api/drill/answer', { questionId: 'drill-m09', selectedIndex: wrongIndex('drill-m09') });
        await post(u, '/api/drill/reset', {});
        const prog = await get(u, '/api/drill/progress');
        expect(prog.body).toEqual({ stats: {}, missed: [] });
        const inc = await get(u, '/api/study/incorrect?limit=500');
        expect(inc.body.items.map((i) => i.questionId)).toContain('drill-m09');
    });
});

describe('Review Incorrect grouped by domain', () => {
    it('labels each miss with its domain, section and source and keeps the drill out of the dashboard', async () => {
        const u = await registerUser(app);
        await post(u, '/api/drill/answer', { questionId: 'drill-n10', selectedIndex: wrongIndex('drill-n10') });

        const inc = await get(u, '/api/study/incorrect?limit=500');
        const drillItem = inc.body.items.find((i) => i.questionId === 'drill-n10');
        expect(drillItem).toMatchObject({ source: 'drill', domainId: 'domain-3', sectionId: 'd3-focal-generalized-patterns' });
        expect(drillItem.memoryAid).toBeTruthy();
        const d3 = inc.body.byDomain.find((d) => d.domainId === 'domain-3');
        expect(d3.outstanding).toBeGreaterThanOrEqual(1);
        expect(d3.sections.find((x) => x.sectionId === 'd3-focal-generalized-patterns').outstanding).toBe(1);

        const dash = await get(u, '/api/study/dashboard');
        expect(dash.status).toBe(200);
        // The drill miss is not part of the main-bank analytics.
        expect(dash.body.incorrectOutstanding).toBe(0);
    });
});

describe('pure helpers', () => {
    it('drillProgress follows the latest answer', () => {
        const p = drillProgress([
            { questionId: 'a', isCorrect: false, timestamp: 1 },
            { questionId: 'a', isCorrect: true, timestamp: 2 },
            { questionId: 'b', isCorrect: false, timestamp: 3 },
        ]);
        expect(p.stats.a).toEqual({ seen: 2, right: 1, last: 1 });
        expect(p.missed).toEqual(['b']);
    });

    it('attemptSource and weaknessBreakdown', () => {
        expect(attemptSource({ mode: 'mock' }, { bank: 'challenge' })).toBe('mock');
        expect(attemptSource({ mode: 'practice' }, { bank: 'challenge' })).toBe('challenge');
        expect(attemptSource({ mode: 'practice' }, { bank: 'drill' })).toBe('drill');
        expect(attemptSource({ mode: 'review' }, {})).toBe('bank');
        const ev = (domainId, sectionId, isCorrect) => ({ domainId, sectionId, isCorrect });
        const events = [ev('domain-1', 'a', true), ev('domain-1', 'a', true), ev('domain-2', 'b', false), ev('domain-2', 'c', true)];
        const out = weaknessBreakdown(events, [ev('domain-2', 'b', false)]);
        expect(out[0]).toMatchObject({ domainId: 'domain-2', attempts: 2, correct: 1, accuracy: 50, outstanding: 1 });
        expect(out[0].sections[0]).toMatchObject({ sectionId: 'b', outstanding: 1, accuracy: 0 });
        expect(out[1]).toMatchObject({ domainId: 'domain-1', accuracy: 100, outstanding: 0 });
    });
});
