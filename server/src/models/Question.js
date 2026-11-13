import mongoose from 'mongoose';

// Server-side question bank.
//
// `answerIndex` and `explanation` are `select: false` so that an ordinary
// query can never leak the answer key. Code that needs them must ask for
// them explicitly with `.select('+answerIndex +explanation')`.
//
// Future-facing metadata (objective IDs, cognitive level, media, references,
// review workflow) is present in the schema but deliberately left null/empty
// for the legacy bank. It must not be populated by guessing.

const mediaSchema = new mongoose.Schema({
    type: { type: String, enum: ['image', 'eeg-tracing'], required: true },
    url: { type: String, required: true },
    caption: { type: String, default: null },
    altText: { type: String, default: null },
}, { _id: false });

const referenceSchema = new mongoose.Schema({
    citation: { type: String, required: true },
    url: { type: String, default: null },
    note: { type: String, default: null },
}, { _id: false });

const questionSchema = new mongoose.Schema({
    // Stable identifier. For the legacy bank this is the original JSON `id`.
    questionId: { type: String, required: true, unique: true, index: true },

    status: {
        type: String,
        enum: ['active', 'draft', 'under_review', 'retired'],
        default: 'active',
        index: true,
    },

    // Which bank the question belongs to.
    //   foundation - the legacy NeuroLinea bank (mostly recall/understanding);
    //                documents imported before this field existed count as foundation
    //   challenge  - higher-order ABRET Challenge Bank (L3-L6)
    //   drill      - the Three-Day Drill; served only on the drill page, never
    //                mixed into practice, mocks, reviews or analytics
    bank: { type: String, enum: ['foundation', 'challenge', 'drill'], default: 'foundation', index: true },
    // Drill only: which drill set the question belongs to, and its memory aid.
    drillSet: { type: String, enum: ['neuro', 'peds', 'meds', null], default: null },
    memoryAid: { type: String, default: null, select: false },

    // Editorial QA state. NEEDS_REVISION and REJECTED questions are never
    // served in quiz sessions. Automatic audit flags never change this field.
    qaStatus: {
        type: String,
        enum: ['UNREVIEWED', 'VERIFIED', 'NEEDS_REVISION', 'REJECTED'],
        default: 'UNREVIEWED',
        index: true,
    },
    qaFlags: {
        type: [new mongoose.Schema({
            code: { type: String, required: true },
            detail: { type: String, default: null },
            source: { type: String, enum: ['auto', 'manual'], required: true },
            createdAt: { type: Date, default: Date.now },
        }, { _id: false })],
        default: [],
    },

    origin: {
        type: { type: String, required: true }, // e.g. 'legacy-neurolinea-bank'
        sourceFile: { type: String, default: null },
        sourceVersion: { type: String, default: null },
        sourceGeneratedAt: { type: String, default: null },
        sourceOrder: { type: Number, default: null },
        importedAt: { type: Date, default: null },
    },

    // Current classification (legacy taxonomy)
    domainId: { type: String, required: true, index: true },
    sectionId: { type: String, required: true, index: true },
    topicTags: { type: [String], default: [] },
    difficulty: { type: String, required: true },

    // Current content
    stem: { type: String, required: true },
    options: {
        type: [String],
        required: true,
        validate: { validator: (v) => Array.isArray(v) && v.length >= 2, message: 'at least 2 options required' },
    },
    answerIndex: { type: Number, required: true, select: false },
    explanation: { type: String, default: '', select: false },

    // Versioning
    version: { type: Number, required: true, default: 1 },
    contentHash: { type: String, required: true },

    // Future-ready metadata (null until authored/reviewed)
    blueprintNodeCode: { type: String, default: null },
    abretObjectiveId: { type: String, default: null },
    learningObjective: { type: String, default: null },
    // L1 Recall, L2 Understanding, L3 Application/Calculation, L4 Troubleshooting,
    // L5 Montage/Localization, L6 Clinical Integration
    cognitiveLevel: { type: Number, min: 1, max: 6, default: null },
    // Readiness competency the question evidences
    competency: {
        type: String,
        enum: ['foundation', 'technical', 'montage', 'troubleshooting', 'clinical', null],
        default: null,
    },
    questionType: { type: String, default: null }, // e.g. calculation, instrumentation, artifact
    reasoningSteps: { type: Number, min: 1, max: 6, default: null },
    clinicalVignette: { type: String, default: null },
    media: { type: [mediaSchema], default: [] },
    references: { type: [referenceSchema], default: [] },
    author: { type: String, default: null },
    reviewer: { type: String, default: null },
    reviewStatus: {
        type: String,
        enum: ['unreviewed', 'in_review', 'approved', 'changes_requested'],
        default: 'unreviewed',
    },
    qaNotes: { type: String, default: null },
}, { timestamps: true });

questionSchema.index({ domainId: 1, status: 1 });
questionSchema.index({ bank: 1, cognitiveLevel: 1 });

export const Question = mongoose.model('Question', questionSchema);
