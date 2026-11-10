import express from 'express';
import Post from '../models/Post.js';
import auth from '../middleware/auth.js';
import { cleanAttachments } from '../services/chatAccess.js';
import { isObjectIdLike } from '../utils/validation.js';
import { getIO } from '../socket.js';

// Community feed: members post short statuses, like them and comment.
// The acting user is always req.user; any author fields sent by the client
// are ignored.

export const MAX_POST_LENGTH = 2000;
export const MAX_COMMENT_LENGTH = 500;
export const MAX_COMMENTS = 200;
export const MAX_POST_IMAGES = 4;
const PAGE_SIZE = 20;

const clean = (value, max) => {
    if (typeof value !== 'string') return '';
    const text = value.trim();
    return text.length > max ? null : text;
};

const isAdmin = (user) => user.role === 'admin';

/** Shape a post for one viewer. */
export function serializePost(post, viewer) {
    const likes = post.likes || [];
    return {
        id: post._id.toString(),
        authorId: post.authorId,
        authorName: post.authorName,
        content: post.content,
        attachments: post.attachments || [],
        createdAt: post.createdAt,
        likeCount: likes.length,
        liked: viewer ? likes.includes(viewer.id) : false,
        canDelete: viewer ? post.authorId === viewer.id || isAdmin(viewer) : false,
        comments: (post.comments || []).map((c) => ({
            id: c._id.toString(),
            authorId: c.authorId,
            authorName: c.authorName,
            content: c.content,
            createdAt: c.createdAt,
            canDelete: viewer ? c.authorId === viewer.id || post.authorId === viewer.id || isAdmin(viewer) : false,
        })),
    };
}

/** Broadcast a change to connected members; a viewer-neutral shape (no liked/canDelete). */
function broadcast(event, payload) {
    try {
        getIO().emit(event, payload);
    } catch {
        // Socket server not running (tests, scripts): the REST response still succeeds.
    }
}
const publicShape = (post) => {
    const shaped = serializePost(post, null);
    delete shaped.liked;
    delete shaped.canDelete;
    shaped.comments.forEach((c) => { delete c.canDelete; });
    return shaped;
};

export function createFeedRouter({ limiters }) {
    const router = express.Router();
    router.use(auth);

    // Newest first; `before` (ISO date) pages backwards.
    router.get('/', async (req, res) => {
        try {
            const query = {};
            if (req.query.before) {
                const before = new Date(req.query.before);
                if (Number.isNaN(before.getTime())) return res.status(400).json({ error: 'Invalid before date' });
                query.createdAt = { $lt: before };
            }
            const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || PAGE_SIZE, 1), 50);
            const posts = await Post.find(query).sort({ createdAt: -1 }).limit(limit + 1).lean();
            const hasMore = posts.length > limit;
            res.json({ posts: posts.slice(0, limit).map((p) => serializePost(p, req.user)), hasMore });
        } catch (error) {
            console.error('feed list error:', error.message);
            res.status(500).json({ error: 'Failed to load the feed' });
        }
    });

    router.post('/', limiters.post, async (req, res) => {
        try {
            const content = clean(req.body?.content, MAX_POST_LENGTH);
            if (content === null) return res.status(400).json({ error: `Posts can be up to ${MAX_POST_LENGTH} characters` });
            const attachments = cleanAttachments(req.body?.attachments)
                .filter((a) => a.type === 'image')
                .slice(0, MAX_POST_IMAGES);
            if (!content && attachments.length === 0) return res.status(400).json({ error: 'Write something or add a photo' });

            const post = await Post.create({ authorId: req.user.id, authorName: req.user.name, content, attachments });
            broadcast('feed:post', publicShape(post));
            res.status(201).json({ post: serializePost(post, req.user) });
        } catch (error) {
            console.error('feed create error:', error.message);
            res.status(500).json({ error: 'Failed to post' });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            if (!isObjectIdLike(req.params.id)) return res.status(404).json({ error: 'Post not found' });
            const post = await Post.findById(req.params.id);
            if (!post) return res.status(404).json({ error: 'Post not found' });
            if (post.authorId !== req.user.id && !isAdmin(req.user)) return res.status(403).json({ error: 'You can only delete your own posts' });
            await post.deleteOne();
            broadcast('feed:delete', { id: req.params.id });
            res.json({ ok: true });
        } catch (error) {
            console.error('feed delete error:', error.message);
            res.status(500).json({ error: 'Failed to delete the post' });
        }
    });

    // Toggle the caller's like.
    router.post('/:id/like', async (req, res) => {
        try {
            if (!isObjectIdLike(req.params.id)) return res.status(404).json({ error: 'Post not found' });
            const me = req.user.id;
            const existing = await Post.findById(req.params.id).select('likes').lean();
            if (!existing) return res.status(404).json({ error: 'Post not found' });
            const liked = !(existing.likes || []).includes(me);
            const post = await Post.findByIdAndUpdate(
                req.params.id,
                liked ? { $addToSet: { likes: me } } : { $pull: { likes: me } },
                { new: true },
            ).lean();
            if (!post) return res.status(404).json({ error: 'Post not found' });
            broadcast('feed:update', publicShape(post));
            res.json({ liked, likeCount: post.likes.length });
        } catch (error) {
            console.error('feed like error:', error.message);
            res.status(500).json({ error: 'Failed to update the like' });
        }
    });

    router.post('/:id/comments', limiters.post, async (req, res) => {
        try {
            if (!isObjectIdLike(req.params.id)) return res.status(404).json({ error: 'Post not found' });
            const content = clean(req.body?.content, MAX_COMMENT_LENGTH);
            if (!content) return res.status(400).json({ error: `Comments must be 1-${MAX_COMMENT_LENGTH} characters` });
            const post = await Post.findById(req.params.id);
            if (!post) return res.status(404).json({ error: 'Post not found' });
            if (post.comments.length >= MAX_COMMENTS) return res.status(400).json({ error: 'This post has reached the comment limit' });
            post.comments.push({ authorId: req.user.id, authorName: req.user.name, content });
            await post.save();
            broadcast('feed:update', publicShape(post));
            res.status(201).json({ post: serializePost(post, req.user) });
        } catch (error) {
            console.error('feed comment error:', error.message);
            res.status(500).json({ error: 'Failed to comment' });
        }
    });

    // Comment author, post author or an admin may remove a comment.
    router.delete('/:id/comments/:commentId', async (req, res) => {
        try {
            if (!isObjectIdLike(req.params.id) || !isObjectIdLike(req.params.commentId)) return res.status(404).json({ error: 'Comment not found' });
            const post = await Post.findById(req.params.id);
            const comment = post?.comments.id(req.params.commentId);
            if (!comment) return res.status(404).json({ error: 'Comment not found' });
            const allowed = comment.authorId === req.user.id || post.authorId === req.user.id || isAdmin(req.user);
            if (!allowed) return res.status(403).json({ error: 'You cannot delete this comment' });
            comment.deleteOne();
            await post.save();
            broadcast('feed:update', publicShape(post));
            res.json({ post: serializePost(post, req.user) });
        } catch (error) {
            console.error('feed comment delete error:', error.message);
            res.status(500).json({ error: 'Failed to delete the comment' });
        }
    });

    return router;
}
