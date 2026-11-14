// Idempotent import of the legacy NeuroLinea question bank into MongoDB,
// plus seeding of the canonical blueprint nodes.
//
// Guarantees:
//   - question text, options, answerIndex, explanation and classification are
//     copied exactly (no medical "fixes", no silent de-duplication)
//   - stable IDs: Question.questionId === source `id`
//   - re-running with unchanged source inserts nothing and creates no versions
//   - a changed source question is updated in place and a NEW QuestionVersion
//     is appended; earlier versions are preserved
//   - invalid records are reported as failed, never partially written

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Question } from '../models/Question.js';
import { QuestionVersion } from '../models/QuestionVersion.js';
import { BlueprintNode } from '../models/BlueprintNode.js';
import { BLUEPRINT_KEY, BLUEPRINT_SOURCE, DOMAINS, getBlueprint } from '../blueprint/abret2026.js';

export const LEGACY_ORIGIN = 'legacy-neurolinea-bank';
export const CHALLENGE_ORIGIN = 'neurolinea-challenge-bank';
export const DRILL_ORIGIN = 'neurolinea-focus-drills';
export const BANKS = ['foundation', 'challenge', 'drill'];
export const DRILL_SETS = ['neuro', 'peds', 'meds', 'acns'];
const COMPETENCIES = ['foundation', 'technical', 'montage', 'troubleshooting', 'clinical'];
const SAFE_ID = /^[A-Za-z0-9_-]{1,120}$/;

/** Canonical scored content of a question, in a fixed key order. */
export function contentSnapshot(q) {
    return {
        domainId: q.domainId,
        sectionId: q.sectionId,
        topicTags: [...(q.topicTags || [])],
        difficulty: q.difficulty,
        stem: q.stem,
        options: [...q.options],
        answerIndex: q.answerIndex,
        explanation: q.explanation ?? '',
        // Only present for questions that declare them; undefined keys are
        // dropped by JSON.stringify, so legacy hashes are unchanged.
        cognitiveLevel: q.cognitiveLevel ?? undefined,
        competency: q.competency ?? undefined,
        drillSet: q.drillSet ?? undefined,
        memoryAid: q.memoryAid ?? undefined,
    };
}

export function contentHash(q) {
    return crypto.createHash('sha256').update(JSON.stringify(contentSnapshot(q))).digest('hex');
}

export function validateSourceQuestion(q, { bank = 'foundation' } = {}) {
    const problems = [];
    if (!q || typeof q !== 'object') return ['not an object'];
    if (bank === 'challenge') {
        if (!Number.isInteger(q.cognitiveLevel) || q.cognitiveLevel < 2 || q.cognitiveLevel > 6) {
            problems.push('challenge questions need cognitiveLevel 2-6');
        }
        if (!COMPETENCIES.includes(q.competency) || q.competency === 'foundation') {
            problems.push('challenge questions need a higher-order competency');
        }
    } else if (bank === 'drill') {
        if (!DRILL_SETS.includes(q.drillSet)) problems.push(`drill questions need drillSet ${DRILL_SETS.join('/')}`);
        if (typeof q.memoryAid !== 'string' || !q.memoryAid.trim()) problems.push('drill questions need a memoryAid');
    }
    if (bank !== 'challenge' && q.cognitiveLevel !== undefined && (!Number.isInteger(q.cognitiveLevel) || q.cognitiveLevel < 1 || q.cognitiveLevel > 6)) {
        problems.push('cognitiveLevel must be 1-6');
    }
    if (typeof q.id !== 'string' || !SAFE_ID.test(q.id)) problems.push('invalid id');
    for (const f of ['domainId', 'sectionId', 'difficulty', 'stem']) {
        if (typeof q[f] !== 'string' || !q[f].trim()) problems.push(`missing ${f}`);
    }
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.some((o) => typeof o !== 'string')) {
        problems.push('options must be an array of at least 2 strings');
    }
    if (!Number.isInteger(q.answerIndex) || !Array.isArray(q.options) || q.answerIndex < 0 || q.answerIndex >= q.options.length) {
        problems.push('answerIndex out of range');
    }
    if (q.topicTags !== undefined && (!Array.isArray(q.topicTags) || q.topicTags.some((t) => typeof t !== 'string'))) {
        problems.push('topicTags must be an array of strings');
    }
    return problems;
}

/**
 * QA observations reported alongside the import. Nothing here changes data.
 */
export function analyseQuality(questions) {
    const stems = new Map();
    const ids = new Map();
    let correctIsLongest = 0;
    const answerPosition = {};
    const difficulty = {};

    for (const q of questions) {
        ids.set(q.id, (ids.get(q.id) || 0) + 1);
        if (typeof q.stem === 'string') {
            const key = q.stem.trim().toLowerCase();
            if (!stems.has(key)) stems.set(key, []);
            stems.get(key).push(q.id);
        }
        if (Array.isArray(q.options) && Number.isInteger(q.answerIndex)) {
            const lens = q.options.map((o) => String(o).length);
            if (lens[q.answerIndex] === Math.max(...lens)) correctIsLongest += 1;
            answerPosition[q.answerIndex] = (answerPosition[q.answerIndex] || 0) + 1;
        }
        difficulty[q.difficulty] = (difficulty[q.difficulty] || 0) + 1;
    }

    const duplicateStemGroups = [...stems.entries()]
        .filter(([, list]) => list.length > 1)
        .map(([stem, list]) => ({ stem, questionIds: list }));

    return {
        duplicateStemGroups: duplicateStemGroups.length,
        duplicateStemExtraCopies: duplicateStemGroups.reduce((s, g) => s + g.questionIds.length - 1, 0),
        duplicateStems: duplicateStemGroups,
        duplicateSourceIds: [...ids.entries()].filter(([, n]) => n > 1).map(([id, n]) => ({ id, occurrences: n })),
        correctOptionIsLongest: correctIsLongest,
        answerPositionDistribution: answerPosition,
        difficultyDistribution: difficulty,
    };
}

export async function seedBlueprint() {
    const bp = getBlueprint();
    const source = {
        organization: BLUEPRINT_SOURCE.organization,
        credential: BLUEPRINT_SOURCE.credential,
        document: BLUEPRINT_SOURCE.document,
        year: BLUEPRINT_SOURCE.year,
    };
    const rootCode = 'ABRET-REEGT-2026';
    const nodes = [
        {
            code: rootCode, blueprintKey: BLUEPRINT_KEY, nodeType: 'exam', parentCode: null,
            title: bp.title, weightPercent: 100, sortOrder: 0, source,
        },
        ...DOMAINS.map((d) => ({
            code: d.code, blueprintKey: BLUEPRINT_KEY, nodeType: 'domain', parentCode: rootCode,
            title: d.title, romanNumeral: d.romanNumeral, legacyDomainId: d.legacyDomainId,
            weightPercent: d.weightPercent, sortOrder: d.sortOrder, source,
        })),
    ];
    for (const node of nodes) {
        await BlueprintNode.updateOne({ code: node.code }, { $set: node }, { upsert: true });
    }
    return nodes.length;
}

export function loadSourceFile(sourcePath) {
    let raw = fs.readFileSync(sourcePath, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // strip UTF-8 BOM
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.questions)) {
        throw new Error('Source file must contain a top-level "questions" array');
    }
    return data;
}

/**
 * Import questions.
 * @param {object}  opts
 * @param {object}  opts.data        parsed source ({ version, generatedAt, questions })
 * @param {string}  opts.sourceFile  label stored in origin/source metadata
 * @param {boolean} opts.dryRun      compute the reconciliation without writing
 */
export async function importQuestions({ data, sourceFile = 'src/data/abret-questions.json', dryRun = false, bank }) {
    const questions = data.questions;
    const targetBank = bank || data.bank || 'foundation';
    if (!BANKS.includes(targetBank)) throw new Error(`Unknown bank: ${targetBank}`);
    const originType = { challenge: CHALLENGE_ORIGIN, drill: DRILL_ORIGIN }[targetBank] || LEGACY_ORIGIN;
    const sourceVersion = data.version ?? null;
    const report = {
        sourceFile,
        sourceVersion,
        sourceGeneratedAt: data.generatedAt ?? null,
        declaredTotal: data.totalQuestions ?? null,
        sourceCount: questions.length,
        bank: targetBank,
        dryRun,
        inserted: 0,
        unchanged: 0,
        updated: 0,
        failed: 0,
        failures: [],
        versionsCreated: 0,
        domainCounts: {},
        sectionCounts: {},
        qa: analyseQuality(questions),
    };

    const seen = new Set();
    const existingDocs = await Question.find({}).select('questionId contentHash version').lean();
    const existing = new Map(existingDocs.map((d) => [d.questionId, d]));

    for (let order = 0; order < questions.length; order++) {
        const q = questions[order];
        const problems = validateSourceQuestion(q, { bank: targetBank });
        if (!problems.length && seen.has(q.id)) problems.push('duplicate id in source (first occurrence imported)');
        if (problems.length) {
            report.failed += 1;
            report.failures.push({ index: order, id: q?.id ?? null, problems });
            continue;
        }
        seen.add(q.id);

        report.domainCounts[q.domainId] = (report.domainCounts[q.domainId] || 0) + 1;
        report.sectionCounts[q.sectionId] = (report.sectionCounts[q.sectionId] || 0) + 1;

        const hash = contentHash(q);
        const snapshot = contentSnapshot(q);
        const current = existing.get(q.id);
        const versionSource = { type: originType, sourceFile, sourceVersion };

        if (current && current.contentHash === hash) {
            report.unchanged += 1;
            // Self-heal an interrupted earlier run that wrote the question but
            // not its version record.
            if (!dryRun) {
                const res = await QuestionVersion.updateOne(
                    { questionId: q.id, version: current.version },
                    { $setOnInsert: { contentHash: hash, snapshot, changeType: current.version === 1 ? 'import-initial' : 'import-update', source: versionSource } },
                    { upsert: true }
                );
                if (res.upsertedCount) report.versionsCreated += 1;
            }
            continue;
        }

        const version = current ? current.version + 1 : 1;
        if (!dryRun) {
            const res = await QuestionVersion.updateOne(
                { questionId: q.id, version },
                { $setOnInsert: { contentHash: hash, snapshot, changeType: current ? 'import-update' : 'import-initial', source: versionSource } },
                { upsert: true }
            );
            if (res.upsertedCount) report.versionsCreated += 1;

            await Question.updateOne(
                { questionId: q.id },
                {
                    $set: {
                        ...snapshot,
                        ...metadataOf(q),
                        version,
                        contentHash: hash,
                        'origin.sourceFile': sourceFile,
                        'origin.sourceVersion': sourceVersion,
                        'origin.sourceGeneratedAt': data.generatedAt ?? null,
                        'origin.sourceOrder': order,
                        'origin.importedAt': new Date(),
                    },
                    $setOnInsert: {
                        questionId: q.id,
                        status: 'active',
                        bank: targetBank,
                        qaStatus: q.qaStatus || 'UNREVIEWED',
                        'origin.type': originType,
                        reviewStatus: 'unreviewed',
                    },
                },
                { upsert: true, runValidators: true }
            );
        }
        if (current) report.updated += 1;
        else report.inserted += 1;
    }

    report.reconciled =
        report.inserted + report.unchanged + report.updated + report.failed === report.sourceCount;
    return report;
}

/** Optional authoring metadata copied onto the question when present. */
function metadataOf(q) {
    const out = {};
    for (const key of ['questionType', 'reasoningSteps', 'learningObjective', 'author', 'clinicalVignette']) {
        if (q[key] !== undefined) out[key] = q[key];
    }
    if (Array.isArray(q.references)) out.references = q.references;
    return out;
}

export function defaultSourcePath(serverRoot) {
    return path.resolve(serverRoot, '..', 'src', 'data', 'abret-questions.json');
}
