import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    // Never selected by default; auth code opts in with `.select('+passwordHash')`.
    passwordHash: {
        type: String,
        required: true,
        select: false
    },
    // 'argon2id'      - server-side Argon2id hash (current)
    // 'legacy-sha256' - unsalted SHA-256 hex computed by the old browser client.
    //                   Accounts with no scheme and a 64-hex hash are also legacy.
    //                   Upgraded to argon2id on the next successful login.
    passwordScheme: {
        type: String,
        enum: ['argon2id', 'legacy-sha256'],
        default: undefined,
        select: false
    },
    passwordUpdatedAt: {
        type: Date,
        default: null,
        select: false
    },
    // Three-Day Drill: answers before this moment no longer count towards the
    // drill's progress cards (they stay in the attempt history).
    drillResetAt: {
        type: Date,
        default: null
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    profile: {
        avatar: {
            type: String,
            default: null
        },
        bio: {
            type: String,
            maxlength: 500,
            default: ''
        },
        location: {
            type: String,
            default: ''
        },
        institution: {
            type: String,
            default: ''
        },
        certifications: {
            type: [String],
            default: []
        },
        specializations: {
            type: [String],
            default: []
        },
        socialLinks: {
            linkedin: {
                type: String,
                default: ''
            },
            twitter: {
                type: String,
                default: ''
            },
            website: {
                type: String,
                default: ''
            }
        },
        isPublic: {
            type: Boolean,
            default: true
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date,
        default: null
    }
});

const stripSecrets = (doc, ret) => {
    delete ret.passwordHash;
    delete ret.passwordScheme;
    delete ret.passwordUpdatedAt;
    delete ret.__v;
    return ret;
};
userSchema.set('toJSON', { transform: stripSecrets });
userSchema.set('toObject', { transform: stripSecrets });

export const User = mongoose.model('User', userSchema);
