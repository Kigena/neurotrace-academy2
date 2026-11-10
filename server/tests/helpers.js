import mongoose from 'mongoose';
import crypto from 'crypto';
import request from 'supertest';
import { inject, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { importQuestions } from '../src/services/questionImport.js';

/** Connect this test file to its own database on the shared in-memory server. */
export function setupTestDb() {
    beforeAll(async () => {
        const dbName = `t_${crypto.randomBytes(6).toString('hex')}`;
        await mongoose.connect(inject('mongoUri'), { dbName });
        // Build the indexes the invariants under test rely on (unique email,
        // unique questionId/version, one scored attempt per session+question).
        const needed = ['User', 'Question', 'QuestionVersion', 'BlueprintNode', 'QuizSession', 'AttemptEvent', 'DailyPlan', 'CaseProgress'];
        await Promise.all(needed.map((name) => mongoose.model(name).createIndexes()));
    });
    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    });
}

export function makeApp(options = {}) {
    return createApp({
        rateLimits: {
            login: { limit: 1000 },
            register: { limit: 1000 },
            passwordChange: { limit: 1000 },
            ai: { limit: 1000 },
            post: { limit: 1000 },
            ...(options.rateLimits || {}),
        },
    });
}

let counter = 0;
export async function registerUser(app, overrides = {}) {
    counter += 1;
    const body = {
        name: overrides.name || `User ${counter}`,
        email: overrides.email || `user${counter}_${crypto.randomBytes(3).toString('hex')}@example.test`,
        password: overrides.password || 'correct-horse-battery',
    };
    const res = await request(app).post('/api/auth/register').send(body);
    if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
    return { token: res.body.token, user: res.body.user, id: res.body.user._id, password: body.password, email: body.email };
}

export async function makeAdmin(userId) {
    await User.updateOne({ _id: userId }, { $set: { role: 'admin' } });
}

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });

/**
 * Deterministic fixture bank: `perDomain` questions in each of the four
 * legacy domains, spread over 3 sections and all difficulties. Question
 * `fx-d2-7` has answerIndex (7 % 4). One position-dependent question.
 */
export function buildFixtureBank(perDomain = 70) {
    const questions = [];
    const diffs = ['easy', 'medium', 'hard'];
    for (let d = 1; d <= 4; d++) {
        for (let i = 0; i < perDomain; i++) {
            const answerIndex = i % 4;
            questions.push({
                id: `fx-d${d}-${i}`,
                domainId: `domain-${d}`,
                sectionId: `d${d}-sec-${i % 3}`,
                topicTags: [`tag-d${d}`, i % 2 ? 'odd' : 'even'],
                difficulty: diffs[i % 3],
                stem: `Fixture question ${d}-${i}?`,
                options: ['Option A', 'Option B', 'Option C', 'Option D'].map((o, k) => `${o} (${d}-${i}-${k})`),
                answerIndex,
                explanation: `Explanation for ${d}-${i}`,
            });
        }
    }
    questions.push({
        id: 'fx-both',
        domainId: 'domain-1',
        sectionId: 'd1-sec-0',
        topicTags: ['positional'],
        difficulty: 'hard',
        stem: 'Which statements are true?',
        options: ['Statement one', 'Statement two', 'Both A and B are correct', 'Neither'],
        answerIndex: 2,
        explanation: 'Both are true.',
    });
    return { version: 'fixture', generatedAt: 'test', questions };
}

export async function seedFixtureBank(perDomain = 70) {
    const data = buildFixtureBank(perDomain);
    await importQuestions({ data, sourceFile: 'tests/fixture' });
    return data;
}
