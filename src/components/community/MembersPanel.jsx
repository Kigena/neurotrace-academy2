import React, { useEffect, useState } from "react";
import { Avatar } from "./Avatar.jsx";
import feedService from "../../services/feedService";

/**
 * People to message: members online now, plus a search across all members.
 * `unread` maps a member id to their unread message count.
 */
export default function MembersPanel({ me, onlineUsers, unread = {}, activeId, onSelect, title = "Online now" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const online = onlineUsers.filter((u) => u.id !== me.id);
  const onlineIds = new Set(online.map((u) => u.id));

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return undefined;
    const t = setTimeout(async () => {
      try {
        const found = await feedService.searchMembers(q);
        setResults(found.filter((u) => u._id !== me.id).map((u) => ({ id: u._id, name: u.name })));
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, me.id]);

  const searching = query.trim().length >= 2;
  const list = searching ? results : online;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {title}
          {!searching && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">{online.length}</span>}
        </h2>
        <label htmlFor="member-search" className="sr-only">Search members</label>
        <input id="member-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members…"
          className="mt-3 w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <ul className="max-h-[26rem] overflow-y-auto p-2">
        {list.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-slate-500">
            {searching ? "No members found" : "Nobody else is online right now. Search to message any member."}
          </li>
        )}
        {list.map((u) => (
          <li key={u.id}>
            <button type="button" onClick={() => onSelect({ id: u.id, name: u.name })}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 ${activeId === u.id ? "bg-indigo-50" : ""}`}>
              <Avatar name={u.name} size="sm" online={onlineIds.has(u.id)} />
              <span className={`min-w-0 flex-1 truncate text-sm ${unread[u.id] ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>{u.name}</span>
              {unread[u.id] > 0 && (
                <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">{unread[u.id]}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
