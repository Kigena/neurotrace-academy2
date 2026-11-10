import React, { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import Feed from "../components/community/Feed.jsx";
import ChatThread from "../components/community/ChatThread.jsx";
import MembersPanel from "../components/community/MembersPanel.jsx";
import { Avatar } from "../components/community/Avatar.jsx";

const TABS = [
  ["feed", "Feed"],
  ["room", "Community room"],
  ["messages", "Messages"],
];

/** Community hub: a status feed, the public room and private messages. */
export default function Chat() {
  const { user } = useAuth();
  const { onlineUsers = [], unreadCounts = {}, socket, isConnected } = useSocket() || {};
  const [params, setParams] = useSearchParams();
  const [partner, setPartner] = useState(null); // { id, name } for private messages

  const tab = TABS.some(([id]) => id === params.get("tab")) ? params.get("tab") : "feed";
  const onlineIds = new Set(onlineUsers.map((u) => u.id));
  const privateUnread = Object.entries(unreadCounts).filter(([id]) => id !== "public").reduce((s, [, n]) => s + n, 0);

  if (!user) return <Navigate to="/login" />;

  const go = (id) => setParams(id === "feed" ? {} : { tab: id });
  const openChat = (member) => {
    setPartner(member);
    go("messages");
  };

  const profileCard = (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar name={user.name} size="lg" online={isConnected} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{user.name}</p>
          <p className="text-xs text-slate-500">{isConnected ? "Connected" : "Connecting…"}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        Share progress, tips and questions with other technologists preparing for the exam. Keep it professional and never post patient information.
      </p>
    </section>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Community</h1>
          <p className="mt-1 text-sm text-slate-600">Post a status, join the room, or message another member.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-200">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
          {Math.max(0, onlineUsers.filter((u) => u.id !== user.id).length)} online
        </span>
      </header>

      <nav className="flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Community sections">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => go(id)}
            className={`relative flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${tab === id ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
            {label}
            {id === "messages" && privateUnread > 0 && (
              <span className="ml-1.5 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[11px] font-bold text-white">{privateUnread}</span>
            )}
            {id === "room" && unreadCounts.public > 0 && tab !== "room" && (
              <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-indigo-600" aria-label="New messages" />
            )}
          </button>
        ))}
      </nav>

      {tab === "messages" ? (
        <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
          <div className={partner ? "hidden lg:block" : ""}>
            <MembersPanel me={user} onlineUsers={onlineUsers} unread={unreadCounts} activeId={partner?.id} onSelect={setPartner} title="Members online" />
          </div>
          <div className={`min-w-0 ${partner ? "" : "hidden lg:block"}`}>
            {partner ? (
              <ChatThread key={partner.id} me={user} chat={{ type: "private", id: partner.id, name: partner.name }} isOnline={onlineIds.has(partner.id)} onBack={() => setPartner(null)} />
            ) : (
              <div className="flex h-full min-h-[20rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <p className="font-semibold text-slate-800">Your messages</p>
                <p className="mt-1 max-w-sm text-sm text-slate-500">Pick a member on the left, or search for anyone, to start a private conversation.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0">
            {tab === "feed"
              ? <Feed user={user} socket={socket} onlineIds={onlineIds} onMessage={(p) => openChat({ id: p.authorId, name: p.authorName })} />
              : <ChatThread me={user} chat={{ type: "public", id: "public" }} />}
          </div>
          <aside className="hidden space-y-5 lg:block">
            {profileCard}
            <MembersPanel me={user} onlineUsers={onlineUsers} unread={unreadCounts} onSelect={openChat} />
          </aside>
        </div>
      )}
    </div>
  );
}
