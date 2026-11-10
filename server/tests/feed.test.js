import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDb, makeApp, registerUser, makeAdmin, bearer } from './helpers.js';

setupTestDb();
const app = makeApp();

let alice;
let bob;
let admin;

beforeAll(async () => {
    alice = await registerUser(app, { name: 'Alice' });
    bob = await registerUser(app, { name: 'Bob' });
    admin = await registerUser(app, { name: 'Admin' });
    await makeAdmin(admin.id);
});

const post = (user, body) => request(app).post('/api/feed').set(bearer(user.token)).send(body);

describe('community feed', () => {
    it('requires authentication', async () => {
        expect((await request(app).get('/api/feed')).status).toBe(401);
        expect((await request(app).post('/api/feed').send({ content: 'hi' })).status).toBe(401);
    });

    it('creates a post as the caller, ignoring client author fields', async () => {
        const res = await post(alice, { content: '  Passed my mock exam!  ', authorId: bob.id, authorName: 'Bob' });
        expect(res.status).toBe(201);
        expect(res.body.post).toMatchObject({ authorId: alice.id, authorName: 'Alice', content: 'Passed my mock exam!', likeCount: 0, liked: false, canDelete: true });
    });

    it('validates content and attachments', async () => {
        expect((await post(alice, { content: '   ' })).status).toBe(400);
        expect((await post(alice, { content: 'x'.repeat(2001) })).status).toBe(400);
        // Non-https and non-image attachments are dropped, so this post is empty.
        expect((await post(alice, { attachments: [{ url: 'javascript:alert(1)', type: 'image' }, { url: 'https://a.test/f.pdf', type: 'file' }] })).status).toBe(400);
        const ok = await post(alice, { attachments: [{ url: 'https://a.test/p.png', type: 'image', filename: 'p.png' }] });
        expect(ok.status).toBe(201);
        expect(ok.body.post.attachments).toHaveLength(1);
    });

    it('lists newest first and pages with before', async () => {
        for (const n of [1, 2, 3]) await post(bob, { content: `page post ${n}` });
        const first = await request(app).get('/api/feed?limit=2').set(bearer(alice.token));
        expect(first.status).toBe(200);
        expect(first.body.posts.map((p) => p.content)).toEqual(['page post 3', 'page post 2']);
        expect(first.body.hasMore).toBe(true);
        expect(first.body.posts[0].canDelete).toBe(false);
        const next = await request(app).get('/api/feed').query({ limit: 1, before: first.body.posts[1].createdAt }).set(bearer(alice.token));
        expect(next.body.posts[0].content).toBe('page post 1');
        expect((await request(app).get('/api/feed?before=nonsense').set(bearer(alice.token))).status).toBe(400);
    });

    it('toggles likes per user', async () => {
        const { body } = await post(bob, { content: 'like me' });
        const id = body.post.id;
        const like = await request(app).post(`/api/feed/${id}/like`).set(bearer(alice.token));
        expect(like.body).toEqual({ liked: true, likeCount: 1 });
        await request(app).post(`/api/feed/${id}/like`).set(bearer(bob.token));
        const unlike = await request(app).post(`/api/feed/${id}/like`).set(bearer(alice.token));
        expect(unlike.body).toEqual({ liked: false, likeCount: 1 });
        expect((await request(app).post('/api/feed/000000000000000000000000/like').set(bearer(alice.token))).status).toBe(404);
    });

    it('adds comments and limits who can delete them', async () => {
        const { body } = await post(alice, { content: 'Questions on spindles?' });
        const id = body.post.id;
        expect((await request(app).post(`/api/feed/${id}/comments`).set(bearer(bob.token)).send({ content: '' })).status).toBe(400);
        const c = await request(app).post(`/api/feed/${id}/comments`).set(bearer(bob.token)).send({ content: 'Yes: 12-14 Hz, central' });
        expect(c.status).toBe(201);
        const comment = c.body.post.comments[0];
        expect(comment).toMatchObject({ authorId: bob.id, authorName: 'Bob', canDelete: true });

        // A third member cannot remove it; the post's author can.
        const carol = await registerUser(app, { name: 'Carol' });
        expect((await request(app).delete(`/api/feed/${id}/comments/${comment.id}`).set(bearer(carol.token))).status).toBe(403);
        const del = await request(app).delete(`/api/feed/${id}/comments/${comment.id}`).set(bearer(alice.token));
        expect(del.status).toBe(200);
        expect(del.body.post.comments).toHaveLength(0);
    });

    it('lets only the author or an admin delete a post', async () => {
        const mine = (await post(alice, { content: 'delete test' })).body.post.id;
        expect((await request(app).delete(`/api/feed/${mine}`).set(bearer(bob.token))).status).toBe(403);
        expect((await request(app).delete(`/api/feed/${mine}`).set(bearer(alice.token))).status).toBe(200);
        const other = (await post(bob, { content: 'moderate me' })).body.post.id;
        expect((await request(app).delete(`/api/feed/${other}`).set(bearer(admin.token))).status).toBe(200);
        expect((await request(app).delete(`/api/feed/${other}`).set(bearer(admin.token))).status).toBe(404);
    });

    it('rate-limits posting per user', async () => {
        const strict = makeApp({ rateLimits: { post: { limit: 2 } } });
        const u = await registerUser(strict, { name: 'Spammer' });
        const send = () => request(strict).post('/api/feed').set(bearer(u.token)).send({ content: 'spam' });
        expect((await send()).status).toBe(201);
        expect((await send()).status).toBe(201);
        expect((await send()).status).toBe(429);
    });
});
