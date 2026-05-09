import bcrypt from "bcryptjs";
import { MAX_USERS } from "./constants.js";
import * as q from "./queries.js";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;

const AVATAR_COLORS = [
  "#ec4899",
  "#22c55e",
  "#f59e0b",
  "#38bdf8",
  "#a78bfa",
  "#2dd4bf",
  "#f97316",
];

export function getRegistrationStatus(db) {
  const userCount = q.countUsers(db);
  return {
    open: userCount < MAX_USERS,
    userCount,
    maxUsers: MAX_USERS,
  };
}

export function parseRegisterBody(body) {
  const username = String(body?.username ?? "")
    .trim()
    .toLowerCase();
  const password = String(body?.password ?? "");
  const displayNameRaw = String(body?.display_name ?? "").trim();
  const errors = [];

  if (!USERNAME_RE.test(username)) {
    errors.push("Username must be 3–32 characters (letters, numbers, underscore only).");
  }
  if (password.length < 10) {
    errors.push("Password must be at least 10 characters.");
  }
  if (password.length > 128) {
    errors.push("Password is too long.");
  }

  let display_name = displayNameRaw.slice(0, 40);
  if (!display_name) {
    display_name =
      username.length > 0
        ? username.charAt(0).toUpperCase() + username.slice(1)
        : "Member";
  }

  return { ok: errors.length === 0, errors, username, password, display_name };
}

function ensureSocialGraph(db, newUserId) {
  const others = db
    .prepare(`SELECT id FROM users WHERE id != ?`)
    .all(newUserId)
    .map((r) => r.id);

  for (const oid of others) {
    const existing = q.findDmIdBetween(db, newUserId, oid);
    if (existing) continue;
    const cid = q.insertConversationRow(db, "dm", null);
    q.insertConversationMember(db, cid, newUserId);
    q.insertConversationMember(db, cid, oid);
  }

  let gid = q.getGroupConversationId(db);
  if (!gid) {
    gid = q.insertConversationRow(db, "group", "Everyone");
    for (const uid of q.listAllUserIds(db)) {
      q.insertConversationMember(db, gid, uid);
    }
  } else {
    q.insertConversationMember(db, gid, newUserId);
  }
}

/**
 * @returns {{ user: ReturnType<typeof q.getUserById> } | { error: string }}
 */
export function registerUser(db, { username, password, display_name }) {
  const status = getRegistrationStatus(db);
  if (!status.open) {
    return { error: `This circle is full (${MAX_USERS} members).` };
  }

  const avatar_color = AVATAR_COLORS[status.userCount % AVATAR_COLORS.length];
  const password_hash = bcrypt.hashSync(password, 12);

  try {
    const newId = db.transaction(() => {
      const uid = q.insertUserRow(db, {
        username,
        password_hash,
        display_name,
        avatar_color,
      });
      ensureSocialGraph(db, uid);
      return uid;
    })();
    const user = q.getUserById(db, newId);
    return { user };
  } catch (e) {
    const msg = String(e?.message ?? "");
    if (e?.code === "SQLITE_CONSTRAINT_UNIQUE" || msg.includes("UNIQUE")) {
      return { error: "That username is already taken." };
    }
    throw e;
  }
}
