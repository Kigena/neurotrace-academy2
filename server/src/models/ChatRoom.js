import mongoose from 'mongoose';

const chatRoomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['public', 'group', 'private'],
        default: 'group'
    },
    description: String,
    participants: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        role: {
            type: String,
            enum: ['admin', 'member'],
            default: 'member'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    avatar: String, // Group image URL
    lastMessage: {
        content: String,
        timestamp: Date,
        senderId: mongoose.Schema.Types.ObjectId
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for quick participant lookups
chatRoomSchema.index({ 'participants.userId': 1 });
chatRoomSchema.index({ type: 1, isActive: 1 });

export default mongoose.model('ChatRoom', chatRoomSchema);
