import React, { useEffect, useMemo, useRef } from "react";
import { useSocket } from "../../contexts/SocketContext";
import MessageInput from "../Chat/MessageInput";
import { Avatar } from "./Avatar.jsx";
import { fileUrl } from "./utils.js";
import apiService from "../../services/apiService";

const dayLabel = (d) => {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
};

/**
 * One conversation: the public community room ({ type: "public" }) or a
 * private chat with one member ({ type: "private", id, name }).
 */
export default function ChatThread({ me, chat, isOnline, onBack }) {
  const { messages, sendPublicMessage, sendPrivateMessage, markAsRead, loadMessageHistory, isConnected } = useSocket();
  const endRef = useRef(null);

  useEffect(() => {
    loadMessageHistory?.(chat.type, chat.id);
    markAsRead?.(chat.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.type, chat.id]);

  const thread = useMemo(() => (messages || []).filter((m) => (
    chat.type === "public"
      ? m.type === "public" || !m.type
      : m.type === "private" && ((m.senderId === me.id && m.recipientId === chat.id) || (m.senderId === chat.id && m.recipientId === me.id))
  )), [messages, chat, me.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread.length]);

  const send = async (content, attachments = []) => {
    if (chat.type === "public") await sendPublicMessage(content, attachments);
    else await sendPrivateMessage(chat.id, content, attachments);
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this message? This cannot be undone.")) return;
    try {
      await apiService.delete(`/chat/messages/${id}`);
    } catch (err) {
      window.alert(`Could not delete the message: ${err.message}`);
    }
  };

  const title = chat.type === "public" ? "Community room" : chat.name;
  const subtitle = chat.type === "public" ? "Everyone can read and post here" : isOnline ? "Online now" : "Offline: they will see it next time";

  return (
    <section className="flex h-[calc(100vh-13rem)] min-h-[26rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Back to members" className="-ml-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}
        {chat.type === "public"
          ? <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-600" aria-hidden="true">#</span>
          : <Avatar name={chat.name} online={isOnline} />}
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        {!isConnected && <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">Reconnecting…</span>}
      </header>

      <div className="flex-1 space-y-1 overflow-y-auto bg-slate-50/60 px-4 py-4">
        {thread.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
            <p className="font-medium text-slate-700">No messages yet</p>
            <p className="text-sm">{chat.type === "public" ? "Say hello to the community." : `Start a conversation with ${chat.name}.`}</p>
          </div>
        )}
        {thread.map((m, i) => {
          const prev = thread[i - 1];
          const when = m.timestamp || m.createdAt;
          const newDay = !prev || new Date(prev.timestamp || prev.createdAt).toDateString() !== new Date(when).toDateString();
          const grouped = !newDay && prev?.senderId === m.senderId;
          const own = m.senderId === me.id;
          return (
            <React.Fragment key={m._id || i}>
              {newDay && <div className="py-2 text-center text-xs font-medium text-slate-400">{dayLabel(when)}</div>}
              <div className={`group flex items-end gap-2 ${own ? "justify-end" : "justify-start"} ${grouped ? "" : "pt-2"}`}>
                {!own && <span className={`w-8 ${grouped ? "invisible" : ""}`}>{chat.type === "public" && <Avatar name={m.senderName || "?"} size="sm" />}</span>}
                <div className={`flex max-w-[78%] flex-col ${own ? "items-end" : "items-start"}`}>
                  {!own && !grouped && chat.type === "public" && <span className="mb-0.5 ml-1 text-xs font-medium text-slate-500">{m.senderName || "Member"}</span>}
                  <div className={`rounded-2xl px-3.5 py-2 text-[15px] shadow-sm ${own ? "rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-200"}`}>
                    {(m.attachments || []).map((a, k) => (
                      a.type === "image"
                        ? <a key={k} href={fileUrl(a.url)} target="_blank" rel="noopener noreferrer"><img src={fileUrl(a.url)} alt={a.filename || "Shared image"} loading="lazy" className="mb-1 max-h-64 rounded-lg object-contain" /></a>
                        : <a key={k} href={fileUrl(a.url)} target="_blank" rel="noopener noreferrer" className={`mb-1 block underline ${own ? "text-white" : "text-indigo-700"}`}>{a.filename || "Attachment"}</a>
                    ))}
                    {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 px-1 text-[11px] text-slate-400">
                    <span>{new Date(when).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    {own && m._id && !String(m._id).startsWith("temp-") && (
                      <button type="button" onClick={() => remove(m._id)} className="opacity-0 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100">Delete</button>
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-100 bg-white p-3">
        <MessageInput onSend={send} />
      </div>
    </section>
  );
}
