import React, { useRef, useState } from "react";
import { Avatar } from "./Avatar.jsx";
import feedService from "../../services/feedService";

const MAX = 2000;
const MAX_IMAGES = 4;

export default function StatusComposer({ user, onPosted }) {
  const [text, setText] = useState("");
  const [images, setImages] = useState([]); // { file, preview }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const pick = (e) => {
    const files = [...(e.target.files || [])].filter((f) => f.type.startsWith("image/"));
    setImages((prev) => [...prev, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))].slice(0, MAX_IMAGES));
    e.target.value = "";
  };
  const removeImage = (i) => setImages((prev) => {
    URL.revokeObjectURL(prev[i].preview);
    return prev.filter((_, k) => k !== i);
  });

  const submit = async (e) => {
    e.preventDefault();
    if (busy || (!text.trim() && images.length === 0)) return;
    setBusy(true);
    setError("");
    try {
      const attachments = [];
      for (const img of images) attachments.push(await feedService.uploadImage(img.file));
      const { post } = await feedService.create(text, attachments);
      images.forEach((img) => URL.revokeObjectURL(img.preview));
      setText("");
      setImages([]);
      onPosted(post);
    } catch (err) {
      setError(err.message || "Could not post. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const left = MAX - text.length;
  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <Avatar name={user.name} />
        <div className="min-w-0 flex-1">
          <label htmlFor="status-text" className="sr-only">Share a status</label>
          <textarea
            id="status-text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX))}
            rows={text ? 3 : 2}
            placeholder={`What are you studying today, ${user.name?.split(" ")[0] || "there"}?`}
            className="w-full resize-none rounded-xl border-0 bg-slate-50 px-3 py-2 text-[15px] text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {images.length > 0 && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {images.map((img, i) => (
                <div key={img.preview} className="relative">
                  <img src={img.preview} alt="" className="h-20 w-full rounded-lg object-cover" />
                  <button type="button" onClick={() => removeImage(i)} aria-label="Remove photo"
                    className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs font-bold text-white hover:bg-black/80">×</button>
                </div>
              ))}
            </div>
          )}
          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={images.length >= MAX_IMAGES}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Photo
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={pick} />
            </div>
            <div className="flex items-center gap-3">
              {text.length > MAX - 200 && <span className={`text-xs ${left < 50 ? "text-rose-600" : "text-slate-400"}`}>{left}</span>}
              <button type="submit" disabled={busy || (!text.trim() && images.length === 0)}
                className="rounded-full bg-indigo-600 px-5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
                {busy ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
