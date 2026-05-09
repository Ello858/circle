import { verifyToken } from "./middleware/auth.js";
import * as q from "./queries.js";

const PURGE_INTERVAL_MS = 60 * 1000;

export function attachSocketIO(io, db) {
  const online = new Map();
  let nextPurgeAt = Date.now() + PURGE_INTERVAL_MS;

  function runPurge() {
    try {
      const affectedConvIds = q.getConversationsWithExpiredMessages(db);
      const deleted = q.deleteOldMessages(db);
      nextPurgeAt = Date.now() + PURGE_INTERVAL_MS;
      if (deleted > 0) {
        for (const cid of affectedConvIds) {
          io.to(`conv:${cid}`).emit("messages:purged", { conversationId: cid });
        }
        io.emit("conversations:refresh");
      }
      io.emit("purge:tick", { nextPurgeAt });
    } catch (e) {
      console.error("[purge] error:", e?.message);
    }
  }

  setInterval(runPurge, PURGE_INTERVAL_MS);

  function broadcastPresence() {
    io.emit("presence:sync", {
      onlineUserIds: [...online.keys()],
    });
  }

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers.authorization?.startsWith("Bearer ")
        ? socket.handshake.headers.authorization.slice(7)
        : null);
    if (!token) {
      return next(new Error("Unauthorized"));
    }
    const decoded = verifyToken(token);
    if (!decoded?.sub) {
      return next(new Error("Unauthorized"));
    }
    socket.userId = Number(decoded.sub);
    socket.username = decoded.username;
    next();
  });

  io.on("connection", (socket) => {
    const uid = socket.userId;
    const prev = online.get(uid) ?? 0;
    online.set(uid, prev + 1);
    if (prev === 0) {
      io.emit("presence:user", { userId: uid, online: true });
    }

    const convIds = q.listConversationIdsForUser(db, uid);
    for (const cid of convIds) {
      socket.join(`conv:${cid}`);
    }

    socket.emit("presence:sync", { onlineUserIds: [...online.keys()] });
    socket.emit("purge:tick", { nextPurgeAt });

    socket.on("message:send", (payload, ack) => {
      try {
        const conversationId = Number(payload?.conversationId);
        const body = payload?.body != null ? String(payload.body).trim() : "";
        const imagePath = payload?.imagePath != null ? String(payload.imagePath) : "";
        if (!q.isMember(db, conversationId, uid)) {
          ack?.({ error: "Forbidden" });
          return;
        }
        const hasText = body.length > 0;
        const hasImage = imagePath.length > 0;
        if (!hasText && !hasImage) {
          ack?.({ error: "Empty message" });
          return;
        }
        let storedPath = null;
        if (hasImage) {
          if (!imagePath.startsWith("/uploads/")) {
            ack?.({ error: "Invalid image path" });
            return;
          }
          storedPath = imagePath;
        }
        const mid = q.insertMessage(db, {
          conversationId,
          senderId: uid,
          body: hasText ? body : null,
          imagePath: storedPath,
        });
        const row = q.enrichMessage(db, mid);
        const message = {
          id: row.id,
          conversation_id: row.conversation_id,
          sender_id: row.sender_id,
          body: row.body,
          image_path: row.image_path,
          created_at: row.created_at,
          sender_display_name: row.sender_display_name,
          sender_username: row.sender_username,
          sender_avatar_color: row.sender_avatar_color,
        };
        io.to(`conv:${conversationId}`).emit("message:new", { message });
        q.updateLastRead(db, conversationId, uid, mid);
        io.to(`conv:${conversationId}`).emit("read:receipt", {
          conversationId,
          userId: uid,
          lastReadMessageId: mid,
        });
        ack?.({ ok: true, message });
      } catch (e) {
        ack?.({ error: e?.message ?? "Failed" });
      }
    });

    socket.on("typing", (payload) => {
      const conversationId = Number(payload?.conversationId);
      const typing = Boolean(payload?.typing);
      if (!q.isMember(db, conversationId, uid)) return;
      const conv = q.getConversationRow(db, conversationId);
      if (conv?.type !== "group") return;
      const user = q.getUserById(db, uid);
      socket.to(`conv:${conversationId}`).emit("typing", {
        conversationId,
        userId: uid,
        username: user?.username ?? socket.username,
        displayName: user?.display_name ?? socket.username,
        typing,
      });
    });

    socket.on("read", (payload) => {
      const conversationId = Number(payload?.conversationId);
      const messageId = Number(payload?.messageId);
      if (!q.isMember(db, conversationId, uid)) return;
      if (!Number.isFinite(messageId)) return;
      const msg = q.getMessageById(db, messageId);
      if (!msg || msg.conversation_id !== conversationId) return;
      q.updateLastRead(db, conversationId, uid, messageId);
      io.to(`conv:${conversationId}`).emit("read:receipt", {
        conversationId,
        userId: uid,
        lastReadMessageId: messageId,
      });
    });

    socket.on("disconnect", () => {
      const n = online.get(uid) ?? 1;
      if (n <= 1) {
        online.delete(uid);
        io.emit("presence:user", { userId: uid, online: false });
      } else {
        online.set(uid, n - 1);
      }
    });
  });

  function joinUserToConversation(userId, conversationId) {
    for (const socket of io.sockets.sockets.values()) {
      if (socket.userId === userId) {
        socket.join(`conv:${conversationId}`);
      }
    }
  }

  function broadcastConversationsRefresh() {
    io.emit("conversations:refresh");
  }

  function broadcastPurgeAll(conversationIds) {
    for (const cid of conversationIds) {
      io.to(`conv:${cid}`).emit("messages:purged", { conversationId: cid });
    }
    io.emit("conversations:refresh");
  }

  return {
    getOnlineUserIds: () => new Set(online.keys()),
    joinUserToConversation,
    broadcastConversationsRefresh,
    broadcastPurgeAll,
  };
}
