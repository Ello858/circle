import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../api";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import type { Conversation, MessageRow, User } from "../types";
import Sidebar from "../components/Sidebar";
import ChatView from "../components/ChatView";
import AdminPanel from "../components/AdminPanel";

export default function ChatApp() {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<number>>(new Set());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [nextPurgeAt, setNextPurgeAt] = useState<number | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  const selectedIdRef = useRef<number | null>(null);
  selectedIdRef.current = selectedId;

  const refreshLists = useCallback(async () => {
    const [conv, u] = await Promise.all([apiClient.conversations(), apiClient.users()]);
    setConversations(conv);
    setUsers(u);
    setOnlineIds(new Set(u.filter((x) => x.online).map((x) => x.id)));
    setSelectedId((sid) => {
      if (!sid && conv.length) return conv[0].id;
      if (sid && !conv.some((c) => c.id === sid)) return conv[0]?.id ?? null;
      return sid;
    });
  }, []);

  useEffect(() => {
    refreshLists().catch(() => {});
  }, [refreshLists]);

  const onAfterRead = useCallback(() => {
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedIdRef.current ? { ...c, unread_count: 0 } : c))
    );
  }, []);

  useEffect(() => {
    if (!socket || !user) return;

    const onMessage = (payload: { message: MessageRow }) => {
      const m = payload.message;
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === m.conversation_id);
        if (idx === -1) {
          refreshLists().catch(() => {});
          return prev;
        }
        const next = [...prev];
        const c = { ...next[idx] };
        const preview = m.image_path ? "Photo" : (m.body ?? "").slice(0, 120);
        c.last_message = {
          id: m.id,
          body: m.body,
          image_path: m.image_path,
          sender_id: m.sender_id,
          created_at: m.created_at,
          preview,
        };
        c.updated_at = m.created_at;
        if (m.sender_id !== user.id && m.conversation_id !== selectedIdRef.current) {
          c.unread_count = (c.unread_count ?? 0) + 1;
        }
        next[idx] = c;
        next.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
        return next;
      });
    };

    const onConversationsRefresh = () => {
      refreshLists().catch(() => {});
    };

    const onPurgeTick = (payload: { nextPurgeAt: number }) => {
      setNextPurgeAt(payload.nextPurgeAt);
    };

    const onPresenceSync = (p: { onlineUserIds: number[] }) => {
      setOnlineIds(new Set(p.onlineUserIds));
    };

    const onPresenceUser = (p: { userId: number; online: boolean }) => {
      setOnlineIds((prev) => {
        const n = new Set(prev);
        if (p.online) n.add(p.userId);
        else n.delete(p.userId);
        return n;
      });
    };

    socket.on("message:new", onMessage);
    socket.on("conversations:refresh", onConversationsRefresh);
    socket.on("purge:tick", onPurgeTick);
    socket.on("presence:sync", onPresenceSync);
    socket.on("presence:user", onPresenceUser);
    return () => {
      socket.off("message:new", onMessage);
      socket.off("conversations:refresh", onConversationsRefresh);
      socket.off("purge:tick", onPurgeTick);
      socket.off("presence:sync", onPresenceSync);
      socket.off("presence:user", onPresenceUser);
    };
  }, [socket, user, refreshLists]);

  const active = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-app-bg md:flex-row">
      <Sidebar
        user={user!}
        conversations={conversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onlineIds={onlineIds}
        onLogout={logout}
        onOpenAdmin={user?.username === "admin" ? () => setShowAdmin(true) : undefined}
      />
      <ChatView
        conversation={active}
        currentUser={user!}
        socket={socket}
        onAfterRead={onAfterRead}
        nextPurgeAt={nextPurgeAt}
      />
      {showAdmin && (
        <AdminPanel
          users={users}
          onClose={() => setShowAdmin(false)}
          onRefresh={() => { refreshLists().catch(() => {}); }}
        />
      )}
    </div>
  );
}
