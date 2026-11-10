import React, { useState } from "react";
import { Avatar } from "./Avatar.jsx";
import { fileUrl, timeAgo } from "./utils.js";
import feedService from "../../services/feedService";

const COLLAPSE_AT = 320;

export default function PostCard({ post, isOwn, onChange, onRemove, onMessage, isOnline }) {
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const long = post.content.length > COLLAPSE_AT;
  const body = long && !expanded ? `${post.content.slice(0, COLLAPSE_AT).trimEnd()}…` : post.content;
  const images = post.attachments.filter((a) => a.type === "image");

  const like = async () => {
    // Optimistic: flip now, reconcile with the server's answer.
    onChange({ ...post, liked: !post.liked, likeCount: post.likeCount + (post.liked ? -1 : 1) });
    try {
      const res = await feedService.toggleLike(post.id);
      onChange({ ...post, liked: res.liked, likeCount: res.likeCount });
    } catch {
      onChange(post);
    }
  };

  const comment = async (e) => {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await feedService.comment(post.id, draft);
      setDraft("");
      onChange(res.post);
    } catch (err) {
      setError(err.message || "Could not comment");
    } finally {
      setBusy(false);
    }
  };

  const removeComment = async (commentId) => {
    try {
      const res = await feedService.removeComment(post.id, commentId);
      onChange(res.post);
    } catch (err) {
      setError(err.message || "Could not delete the comment");
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    try {
      await feedService.remove(post.id);
      onRemove(post.id);
    } catch (err) {
      setError(err.message || "Could not delete the post");
    }
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start gap-3 px-4 pt-4">
        <Avatar name={post.authorName} online={isOnline} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold text-slate-900">{post.authorName}</span>
            <time className="text-xs text-slate-500" dateTime={post.createdAt} title={new Date(post.createdAt).toLocaleString()}>
              {timeAgo(post.createdAt)}
            </time>
          </div>
        </div>
        {post.canDelete && (
          <button type="button" onClick={remove} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:bg-rose-50 hover:text-rose-600">
            Delete
          </button>
        )}
      </header>

      {post.content && (
        <div className="px-4 pt-2 text-[15px] leading-relaxed text-slate-800">
          <p className="whitespace-pre-wrap break-words">{body}</p>
          {long && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-sm font-semibold text-indigo-600 hover:underline">
              {expanded ? "Show less" : "See more"}
            </button>
          )}
        </div>
      )}

      {images.length > 0 && (
        <div className={`mt-3 grid gap-0.5 overflow-hidden ${images.length > 1 ? "grid-cols-2" : ""}`}>
          {images.map((img) => (
            <a key={img.url} href={fileUrl(img.url)} target="_blank" rel="noopener noreferrer" className="block bg-slate-100">
              <img src={fileUrl(img.url)} alt={img.filename || "Shared photo"} loading="lazy"
                className={`w-full object-cover ${images.length > 1 ? "aspect-square" : "max-h-[28rem]"}`} />
            </a>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between px-4 pt-3 text-xs text-slate-500">
        <span>{post.likeCount > 0 ? `${post.likeCount} ${post.likeCount === 1 ? "like" : "likes"}` : ""}</span>
        {post.comments.length > 0 && (
          <button type="button" onClick={() => setShowComments((v) => !v)} className="hover:underline">
            {post.comments.length} {post.comments.length === 1 ? "comment" : "comments"}
          </button>
        )}
      </div>

      <div className="mx-4 mt-2 grid grid-cols-3 border-t border-slate-100 py-1 text-sm font-medium text-slate-600">
        <button type="button" onClick={like} aria-pressed={post.liked}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 hover:bg-slate-50 ${post.liked ? "text-indigo-600" : ""}`}>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill={post.liked ? "currentColor" : "none"} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          {post.liked ? "Liked" : "Like"}
        </button>
        <button type="button" onClick={() => setShowComments(true)} className="flex items-center justify-center gap-1.5 rounded-lg py-2 hover:bg-slate-50">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Comment
        </button>
        <button type="button" onClick={() => onMessage(post)} disabled={isOwn} title={isOwn ? "This is your post" : `Message ${post.authorName}`}
          className="flex items-center justify-center gap-1.5 rounded-lg py-2 hover:bg-slate-50 disabled:cursor-default disabled:opacity-40">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Message
        </button>
      </div>

      {showComments && (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3">
          {post.comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar name={c.authorName} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="inline-block max-w-full rounded-2xl bg-slate-100 px-3 py-2">
                  <div className="text-sm font-semibold text-slate-900">{c.authorName}</div>
                  <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{c.content}</p>
                </div>
                <div className="mt-0.5 flex gap-3 pl-3 text-xs text-slate-500">
                  <span>{timeAgo(c.createdAt)}</span>
                  {c.canDelete && <button type="button" onClick={() => removeComment(c.id)} className="font-medium hover:text-rose-600">Delete</button>}
                </div>
              </div>
            </div>
          ))}
          <form onSubmit={comment} className="flex items-center gap-2">
            <label htmlFor={`c-${post.id}`} className="sr-only">Write a comment</label>
            <input id={`c-${post.id}`} value={draft} maxLength={500} onChange={(e) => setDraft(e.target.value)} placeholder="Write a comment…"
              className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button type="submit" disabled={busy || !draft.trim()} className="rounded-full px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-40">
              Reply
            </button>
          </form>
        </div>
      )}
      {error && <p className="px-4 pb-3 text-sm text-rose-600">{error}</p>}
    </article>
  );
}
