#!/usr/bin/env node
// Build the Three-Day Drill import file from the drill's source module.
//
// Usage (from server/):
//   node scripts/buildDrillBank.mjs
//
// Reads ../src/data/drill/drillQuestions.js (where option 0 is the correct
// answer) and writes src/data/drill/three-day-drill.json in the importer's
// format. The correct option is moved to a position derived from the id, so
// the stored answer key is balanced and the output is the same on every run.
// Each question also gets the ABRET domain and section it tests, which is how
// missed drill questions are grouped with the rest of the question bank.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { DRILL } = await import(new URL('../../src/data/drill/drillQuestions.js', import.meta.url));

const SET_OF = { neuro: 'neuro', peds: 'peds', meds: 'meds' };

// Default section per drill set, then per-question overrides.
const DEFAULT_SECTION = {
    neuro: 'd1-neuroanatomy-eeg-localization',
    peds: 'd3-eeg-syndromes-classification',
    meds: 'd1-neurophysiology-seizure-mechanisms',
};
const SECTION_OVERRIDES = {
    // Neuroanatomy and correlation
    n10: 'd3-focal-generalized-patterns', n11: 'd3-focal-generalized-patterns',
    n12: 'd3-sleep-graphoelements', n13: 'd3-normal-variants', n14: 'd3-normal-variants',
    n16: 'd3-ictal-eeg-seizure-patterns', n17: 'd3-ictal-eeg-seizure-patterns',
    n18: 'd1-brain-structures-functions', n19: 'd1-brain-structures-functions',
    n20: 'd3-encephalopathy-differentials', n21: 'd3-encephalopathy-differentials',
    n22: 'd3-encephalopathy-differentials', n23: 'd3-encephalopathy-differentials',
    n24: 'd3-artifacts-recognition', n25: 'd3-artifacts-recognition',
    n26: 'd3-encephalopathy-differentials', n27: 'd1-brain-structures-functions',
    n28: 'd3-ictal-eeg-seizure-patterns', n30: 'd3-ictal-eeg-seizure-patterns',
    // Paediatric syndromes
    p02: 'd3-ictal-eeg-seizure-patterns', p28: 'd3-epileptiform-discharges', p30: 'd3-epileptiform-discharges',
    // Medications
    m01: 'd1-normal-eeg-rhythms', m02: 'd3-focal-generalized-patterns', m13: 'd1-normal-eeg-rhythms',
    m18: 'd1-normal-eeg-rhythms', m23: 'd1-normal-eeg-rhythms',
    m21: 'd3-sleep-graphoelements', m22: 'd3-sleep-graphoelements',
    m03: 'd2-s8', m04: 'd2-s8', m17: 'd2-s8', m26: 'd2-s8', m28: 'd2-s8', m30: 'd2-s8',
    m06: 'd2-s4', m07: 'd2-s4',
    m09: 'd3-encephalopathy-differentials', m14: 'd3-encephalopathy-differentials',
    m16: 'd3-encephalopathy-differentials', m29: 'd3-encephalopathy-differentials',
    m12: 'd3-eeg-syndromes-classification',
};
const domainOf = (sectionId) => `domain-${sectionId.slice(1, 2)}`;

/** Deterministic Fisher-Yates driven by a hash of the id. */
function seededOrder(id, n) {
    const bytes = crypto.createHash('sha256').update(`drill:${id}`).digest();
    const order = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) {
        const j = bytes[i] % (i + 1);
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
}

const questions = DRILL.map((q) => {
    const sectionId = SECTION_OVERRIDES[q.id] || DEFAULT_SECTION[q.t];
    const order = seededOrder(q.id, q.o.length);
    return {
        id: `drill-${q.id}`,
        domainId: domainOf(sectionId),
        sectionId,
        topicTags: ['three-day-drill', `drill-${q.t}`],
        drillSet: SET_OF[q.t],
        difficulty: 'medium',
        stem: q.q,
        options: order.map((i) => q.o[i]),
        answerIndex: order.indexOf(0),
        explanation: q.why,
        memoryAid: q.mem,
        author: 'NeuroLinea Three-Day Drill (AI-drafted, fact-checked; requires expert review)',
        qaStatus: 'UNREVIEWED',
    };
});

const out = {
    version: '1.0.0',
    generatedAt: '2026-11-13',
    bank: 'drill',
    description: 'The Three-Day Drill: neuroanatomy and clinical correlation, paediatric epilepsy syndromes, and medication effects on the EEG. Kept apart from the main question bank and served only on the drill page.',
    totalQuestions: questions.length,
    questions,
};

const target = path.join(serverRoot, 'src', 'data', 'drill', 'three-day-drill.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
const positions = questions.reduce((m, q) => ({ ...m, [q.answerIndex]: (m[q.answerIndex] || 0) + 1 }), {});
console.log(`Wrote ${questions.length} questions to ${path.relative(serverRoot, target)}; answer positions`, positions);
