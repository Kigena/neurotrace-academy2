import React, { useCallback, useEffect, useState } from "react";
import StatusComposer from "./StatusComposer.jsx";
import PostCard from "./PostCard.jsx";
import feedService from "../../services/feedService";

/** Add the viewer-specific flags that socket broadcasts leave out. */
function forViewer(post, user, previous) {
  const admin = user.role === "admin";
  return {
    ...post,
    liked: post.liked ?? previous?.liked ?? false,
    canDelete: post.authorId === user.id || admin,
    comments: post.comments.map((c) => ({ ...c, canDelete: c.authorId === user.id || post.authorId === user.id || admin })),
  };
}

export default function Feed({ user, socket, onlineIds, onMessage }) {
  const [posts, setPosts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (before) => {
    setLoading(true);
    setError("");
    try {
      const res = await feedService.list(before);
      setPosts((prev) => (before ? [...prev, ...res.posts.filter((p) => !prev.some((q) => q.id === p.id))] : res.posts));
      setHasMore(res.hasMore);
    } catch (err) {
      setError(err.message || "Could not load the feed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live updates from other members.
  useEffect(() => {
    if (!socket) return undefined;
    const added = (p) => setPosts((prev) => (prev.some((q) => q.id === p.id) ? prev : [forViewer(p, user), ...prev]));
    const updated = (p) => setPosts((prev) => prev.map((q) => (q.id === p.id ? forViewer(p, user, q) : q)));
    const removed = ({ id }) => setPosts((prev) => prev.filter((q) => q.id !== id));
    socket.on("feed:post", added);
    socket.on("feed:update", updated);
    socket.on("feed:delete", removed);
    return () => {
      socket.off("feed:post", added);
      socket.off("feed:update", updated);
      socket.off("feed:delete", removed);
    };
  }, [socket, user]);

  const change = (p) => setPosts((prev) => prev.map((q) => (q.id === p.id ? forViewer(p, user, q) : q)));

  return (
    <div className="space-y-4">
      <StatusComposer user={user} onPosted={(p) => setPosts((prev) => [p, ...prev.filter((q) => q.id !== p.id)])} />
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={() => load()} className="font-semibold underline">Try again</button>
        </div>
      )}
      {!loading && !error && posts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-base font-semibold text-slate-800">No posts yet</p>
          <p className="mt-1 text-sm text-slate-500">Share what you are studying, a tip that helped, or a question for other members.</p>
        </div>
      )}
      {posts.map((p) => (
        <PostCard key={p.id} post={p} isOwn={p.authorId === user.id} isOnline={onlineIds.has(p.authorId)}
          onChange={change} onRemove={(id) => setPosts((prev) => prev.filter((q) => q.id !== id))} onMessage={onMessage} />
      ))}
      {loading && (
        <div className="space-y-4" aria-label="Loading posts">
          {[0, 1].map((k) => (
            <div key={k} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex gap-3"><div className="h-10 w-10 rounded-full bg-slate-200" /><div className="h-4 w-32 rounded bg-slate-200" /></div>
              <div className="mt-4 h-3 w-full rounded bg-slate-100" /><div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      )}
      {hasMore && !loading && (
        <button type="button" onClick={() => load(posts[posts.length - 1]?.createdAt)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Load older posts
        </button>
      )}
    </div>
  );
}
