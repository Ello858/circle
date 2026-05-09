import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { apiClient } from "../api";
import type { Conversation, MessageRow, User } from "../types";
import MessageInput from "./MessageInput";
import { formatHoverTime, initials } from "../utils/format";

type Props = {
  conversation: Conversation | null;
  currentUser: User;
  socket: Socket | null;
  onAfterRead: () => void;
  nextPurgeAt: number | null;
};

function useCountdown(targetMs: number | null) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (targetMs === null) return;
    function tick() {
      setRemaining(Math.max(0, targetMs! - Date.now()));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  return remaining;
}

function formatCountdown(ms: number) {
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ChatView({
  conversation,
  currentUser,
  socket,
  onAfterRead,
  nextPurgeAt,
}: Props) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [peerReadUpTo, setPeerReadUpTo] = useState<number | null>(null);
  const [typingName, setTypingName] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  const remaining = useCountdown(nextPurgeAt);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
  }, []);

  const load = useCallback(async () => {
    if (!conversation) {
      setMessages([]);
      setPeerReadUpTo(null);
      return;
    }
    const { messages: rows, dm_peer_read_up_to } = await apiClient.messages(conversation.id);
    setMessages(rows);
    setPeerReadUpTo(dm_peer_read_up_to);
    const last = rows[rows.length - 1];
    if (last) {
      await apiClient.read(conversation.id, last.id);
      onAfterRead();
    }
    requestAnimationFrame(() => scrollToBottom(false));
  }, [conversation, onAfterRead, scrollToBottom]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    if (!socket || !conversation) return;
    const onNew = (payload: { message: MessageRow }) => {
      if (payload.message.conversation_id !== conversation.id) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.message.id)) return prev;
        return [...prev, payload.message];
      });
      if (payload.message.sender_id !== currentUser.id) {
        apiClient.read(conversation.id, payload.message.id).then(() => onAfterRead()).catch(() => {});
      }
      requestAnimationFrame(() => scrollToBottom(true));
    };
    const onRead = (payload: {
      conversationId: number;
      userId: number;
      lastReadMessageId: number;
    }) => {
      if (payload.conversationId !== conversation.id) return;
      if (conversation.type !== "dm" || !conversation.peer) return;
      if (payload.userId !== conversation.peer.id) return;
      setPeerReadUpTo((prev) =>
        prev == null ? payload.lastReadMessageId : Math.max(prev, payload.lastReadMessageId)
      );
    };
    const onTyping = (payload: {
      conversationId: number;
      userId: number;
      displayName: string;
      typing: boolean;
    }) => {
      if (payload.conversationId !== conversation.id) return;
      if (payload.userId === currentUser.id) return;
      if (conversation.type !== "group") return;
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (payload.typing) {
        setTypingName(payload.displayName);
        typingTimer.current = setTimeout(() => setTypingName(null), 3000);
      } else {
        setTypingName(null);
      }
    };
    const onPurged = (payload: { conversationId: number }) => {
      if (payload.conversationId !== conversationRef.current?.id) return;
      load().catch(() => {});
    };
    socket.on("message:new", onNew);
    socket.on("read:receipt", onRead);
    socket.on("typing", onTyping);
    socket.on("messages:purged", onPurged);
    return () => {
      socket.off("message:new", onNew);
      socket.off("read:receipt", onRead);
      socket.off("typing", onTyping);
      socket.off("messages:purged", onPurged);
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [socket, conversation, currentUser.id, scrollToBottom, onAfterRead, load]);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length, scrollToBottom]);

  if (!conversation) {
    return (
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 bg-app-chat text-zinc-500 max-md:min-h-[50vh]">
        <p className="text-sm">Select a conversation</p>
        {nextPurgeAt !== null && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-800 bg-app-sidebar px-6 py-4 text-center shadow-glow-sm">
            <svg className="h-5 w-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
            </svg>
            <p className="text-xs font-medium text-zinc-400">Messages auto-delete after 24 hours</p>
            <p className="font-mono text-lg font-semibold text-white">{formatCountdown(remaining)}</p>
            <p className="text-[11px] text-zinc-600">until next cleanup</p>
          </div>
        )}
      </main>
    );
  }

  const title = conversation.title;
  const subtitle =
    conversation.type === "dm" && conversation.peer
      ? `@${conversation.peer.username}`
      : "Group chat";

  return (
    <main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-app-chat max-md:min-h-[50vh]">
      <header className="flex shrink-0 items-center border-b border-zinc-800 px-4 py-3 md:px-6">
        <div>
          <h2 className="font-semibold text-white">{title}</h2>
          <p className="text-xs text-zinc-500">{subtitle}</p>
        </div>
      </header>

      <div className="msg-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {messages.map((m) => {
            const mine = m.sender_id === currentUser.id;
            const showMeta = conversation.type === "group" && !mine;
            const seen =
              mine &&
              conversation.type === "dm" &&
              peerReadUpTo != null &&
              peerReadUpTo >= m.id;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                {showMeta ? (
                  <div className="mb-1 flex items-center gap-2 pl-1">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: m.sender_avatar_color }}
                    >
                      {initials(m.sender_display_name)}
                    </div>
                    <span className="text-xs font-medium text-zinc-400">
                      {m.sender_display_name}
                    </span>
                    {m.sender_username === "admin" && (
                      <span className="rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                        Admin
                      </span>
                    )}
                  </div>
                ) : null}
                <div
                  className={`group relative max-w-[85%] rounded-2xl px-3 py-2 md:max-w-[70%] ${
                    mine
                      ? "rounded-br-md bg-app-bubbleOut text-white shadow-glow-sm"
                      : "rounded-bl-md border border-zinc-700 bg-app-bubbleIn text-zinc-100"
                  }`}
                >
                  {m.image_path ? (
                    <button
                      type="button"
                      className="block overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      onClick={() => setLightbox(m.image_path)}
                      aria-label="View full image"
                    >
                      <img
                        src={m.image_path}
                        alt=""
                        className="max-h-56 w-auto max-w-full rounded-lg object-cover"
                      />
                    </button>
                  ) : null}
                  {m.body ? (
                    <p className={`whitespace-pre-wrap text-sm ${m.image_path ? "mt-2" : ""}`}>
                      {m.body}
                    </p>
                  ) : null}
                  <div
                    className={`mt-1 flex items-center justify-end gap-2 ${
                      mine ? "text-indigo-100/80" : "text-zinc-500"
                    }`}
                  >
                    <span className="text-[10px] opacity-0 transition group-hover:opacity-100">
                      {formatHoverTime(m.created_at)}
                    </span>
                    {mine && conversation.type === "dm" ? (
                      <span
                        className="text-[11px] text-indigo-100/90"
                        title={seen ? "Seen" : "Delivered"}
                      >
                        {seen ? "✓✓" : "✓"}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {typingName ? (
        <p className="shrink-0 px-4 pb-1 text-xs italic text-zinc-500 md:px-6">
          {typingName} is typing…
        </p>
      ) : null}

      <MessageInput
        conversation={conversation}
        socket={socket}
        onSent={() => scrollToBottom(true)}
      />

      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
          aria-label="Close image"
        >
          <img
            src={lightbox}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain shadow-glow"
            onClick={(e) => e.stopPropagation()}
          />
        </button>
      ) : null}
    </main>
  );
}
