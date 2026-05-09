import express from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { v4 as uuidv4 } from "uuid";
import { authMiddleware, adminMiddleware, signToken } from "./middleware/auth.js";
import * as q from "./queries.js";
import { getRegistrationStatus, parseRegisterBody, registerUser } from "./register.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "uploads");

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const extForMime = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

export function createRouter(db) {
  const router = express.Router();

  const storage = multer.diskStorage({
    destination(_req, _file, cb) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    },
    filename(_req, file, cb) {
      const ext = extForMime[file.mimetype] || path.extname(file.originalname) || ".bin";
      cb(null, `${uuidv4()}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter(_req, file, cb) {
      if (!ALLOWED_MIME.has(file.mimetype)) {
        return cb(new Error("Only jpg, png, gif, and webp images are allowed"));
      }
      cb(null, true);
    },
  });

  router.get("/registration/status", (_req, res) => {
    res.json(getRegistrationStatus(db));
  });

  router.post("/register", (req, res) => {
    const parsed = parseRegisterBody(req.body ?? {});
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.errors.join(" ") });
    }
    const result = registerUser(db, {
      username: parsed.username,
      password: parsed.password,
      display_name: parsed.display_name,
    });
    if ("error" in result) {
      const code = result.error.includes("full") ? 403 : 400;
      return res.status(code).json({ error: result.error });
    }
    const user = result.user;
    const token = signToken({ sub: user.id, username: user.username });

    const joinUser = req.app.locals.joinUserToConversation;
    const broadcastRefresh = req.app.locals.broadcastConversationsRefresh;
    if (joinUser) {
      const convIds = q.listConversationIdsForUser(db, user.id);
      for (const cid of convIds) {
        const conv = q.getConversationRow(db, cid);
        if (conv?.type === "dm") {
          const peer = q.getPeerInDm(db, cid, user.id);
          if (peer) joinUser(peer.id, cid);
        }
      }
    }
    broadcastRefresh?.();

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_color: user.avatar_color,
      },
    });
  });

  router.post("/login", (req, res) => {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    const user = q.getUserByUsername(db, String(username).toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = signToken({ sub: user.id, username: user.username });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_color: user.avatar_color,
      },
    });
  });

  router.get("/me", authMiddleware, (req, res) => {
    const user = q.getUserById(db, req.user.id);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(user);
  });

  router.get("/users", authMiddleware, (req, res) => {
    const users = q.listAllUsers(db);
    const online = req.app.locals.getOnlineUserIds?.() ?? new Set();
    res.json(
      users.map((u) => ({
        ...u,
        online: online.has(u.id),
      }))
    );
  });

  router.get("/conversations", authMiddleware, (req, res) => {
    const uid = req.user.id;
    const convIds = q.listConversationIdsForUser(db, uid);
    const rows = convIds
      .map((cid) => {
        const conv = q.getConversationRow(db, cid);
        if (!conv) return null;
        const last = q.getLastMessage(db, cid);
        const unread = q.unreadCount(db, cid, uid);
        let title;
        let peer = null;
        if (conv.type === "group") {
          title = conv.name || "Group";
        } else {
          peer = q.getPeerInDm(db, cid, uid);
          if (!peer) return null;
          title = peer.display_name;
        }
        const updatedAt = last?.created_at ?? conv.created_at;
        return {
          id: cid,
          type: conv.type,
          name: conv.name,
          title,
          peer,
          last_message: last
            ? {
                id: last.id,
                body: last.body,
                image_path: last.image_path,
                sender_id: last.sender_id,
                created_at: last.created_at,
                preview: last.image_path
                  ? "Photo"
                  : (last.body ?? "").slice(0, 120),
              }
            : null,
          unread_count: unread,
          updated_at: updatedAt,
        };
      })
      .filter(Boolean);

    rows.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    res.json(rows);
  });

  router.get("/conversations/:id/messages", authMiddleware, (req, res) => {
    const cid = Number(req.params.id);
    if (!q.isMember(db, cid, req.user.id)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const beforeId = req.query.before ? Number(req.query.before) : null;
    const messages = q.listMessages(db, cid, {
      limit: 100,
      beforeId: Number.isFinite(beforeId) ? beforeId : null,
    });
    const conv = q.getConversationRow(db, cid);
    let dm_peer_read_up_to = null;
    if (conv?.type === "dm") {
      const other = q.getPeerInDm(db, cid, req.user.id);
      if (other) {
        dm_peer_read_up_to = q.getMemberLastRead(db, cid, other.id);
      }
    }
    res.json({ messages, dm_peer_read_up_to });
  });

  router.post("/conversations/:id/read", authMiddleware, (req, res) => {
    const cid = Number(req.params.id);
    if (!q.isMember(db, cid, req.user.id)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    let mid = req.body?.message_id != null ? Number(req.body.message_id) : null;
    if (!mid || !Number.isFinite(mid)) {
      const last = q.getLastMessage(db, cid);
      mid = last?.id ?? null;
    }
    if (!mid) {
      return res.json({ ok: true, last_read_message_id: null });
    }
    const msg = q.getMessageById(db, mid);
    if (!msg || msg.conversation_id !== cid) {
      return res.status(400).json({ error: "Invalid message" });
    }
    q.updateLastRead(db, cid, req.user.id, mid);
    res.json({ ok: true, last_read_message_id: mid });
  });

  router.post("/admin/purge-all", adminMiddleware, (req, res) => {
    const convIds = q.getAllConversationIds(db);
    const deleted = q.deleteAllMessages(db);
    req.app.locals.broadcastPurgeAll?.(convIds);
    res.json({ ok: true, deleted });
  });

  router.post("/admin/reset-password", adminMiddleware, (req, res) => {
    const { userId, newPassword } = req.body ?? {};
    if (!userId || !newPassword) {
      return res.status(400).json({ error: "userId and newPassword required." });
    }
    if (String(newPassword).length < 10) {
      return res.status(400).json({ error: "Password must be at least 10 characters." });
    }
    const user = q.getUserById(db, Number(userId));
    if (!user) return res.status(404).json({ error: "User not found." });
    const hash = bcrypt.hashSync(String(newPassword), 12);
    q.updatePasswordHash(db, user.id, hash);
    res.json({ ok: true });
  });

  router.patch("/admin/users/:id", adminMiddleware, (req, res) => {
    const targetId = Number(req.params.id);
    const { username, display_name } = req.body ?? {};
    if (!username && !display_name) {
      return res.status(400).json({ error: "Provide username or display_name to update." });
    }
    const user = q.getUserById(db, targetId);
    if (!user) return res.status(404).json({ error: "User not found." });
    if (username) {
      const clean = String(username).trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
        return res.status(400).json({ error: "Username must be 3-20 chars, letters/numbers/underscores only." });
      }
      const existing = q.getUserByUsername(db, clean);
      if (existing && existing.id !== targetId) {
        return res.status(409).json({ error: "Username already taken." });
      }
      q.updateUserProfile(db, targetId, { username: clean });
    }
    if (display_name) {
      const clean = String(display_name).trim();
      if (clean.length < 1 || clean.length > 30) {
        return res.status(400).json({ error: "Display name must be 1-30 characters." });
      }
      q.updateUserProfile(db, targetId, { display_name: clean });
    }
    req.app.locals.broadcastConversationsRefresh?.();
    res.json({ ok: true });
  });

  router.delete("/admin/users/:id", adminMiddleware, (req, res) => {
    const targetId = Number(req.params.id);
    if (targetId === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own admin account." });
    }
    const user = q.getUserById(db, targetId);
    if (!user) return res.status(404).json({ error: "User not found." });
    q.deleteMessagesBySender(db, targetId);
    q.deleteUser(db, targetId);
    req.app.locals.broadcastConversationsRefresh?.();
    res.json({ ok: true });
  });

  router.post("/reset-password", (req, res) => {
    const { username, reset_key, new_password } = req.body ?? {};
    const RESET_KEY = process.env.RESET_KEY || "youdumbass";
    if (!username || !reset_key || !new_password) {
      return res.status(400).json({ error: "Username, reset key, and new password are required." });
    }
    if (String(reset_key) !== RESET_KEY) {
      return res.status(403).json({ error: "That key is wrong. Go DM the admin." });
    }
    const user = q.getUserByUsername(db, String(username).toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "No account with that username." });
    }
    if (String(new_password).length < 10) {
      return res.status(400).json({ error: "New password must be at least 10 characters." });
    }
    if (String(new_password).length > 128) {
      return res.status(400).json({ error: "New password is too long." });
    }
    const hash = bcrypt.hashSync(String(new_password), 12);
    q.updatePasswordHash(db, user.id, hash);
    res.json({ ok: true });
  });

  router.post("/upload", authMiddleware, (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) return next(err);
      if (!req.file) {
        return res.status(400).json({ error: "No file" });
      }
      const urlPath = `/uploads/${req.file.filename}`;
      res.json({ url: urlPath, filename: req.file.filename });
    });
  });

  router.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Image must be 10MB or smaller" });
      }
    }
    if (err?.message) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Server error" });
  });

  return router;
}
