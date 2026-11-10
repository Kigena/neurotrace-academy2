import mongoose from 'mongoose';

// Community status posts. Author identity always comes from the verified
// token (req.user); names are denormalized for fast feed rendering.

const commentSchema = new mongoose.Schema({
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    content: { type: String, required: true, maxlength: 500 },
}, { timestamps: { createdAt: true, updatedAt: false } });

const postSchema = new mongoose.Schema({
    authorId: { type: String, required: true, index: true },
    authorName: { type: String, required: true },
    content: { type: String, default: '', maxlength: 2000 },
    attachments: [{
        _id: false,
        type: { type: String, enum: ['image', 'file', 'document'] },
        filename: String,
        url: String,
        size: Number,
    }],
    likes: [{ type: String }], // user ids
    comments: [commentSchema],
}, { timestamps: true });

postSchema.index({ createdAt: -1 });

export default mongoose.models.Post || mongoose.model('Post', postSchema);
