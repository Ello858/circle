import bcrypt from "bcryptjs";
import * as q from "./queries.js";

export const ADMIN_USERNAME = "admin";

export function isAdmin(username) {
  return String(username).toLowerCase() === ADMIN_USERNAME;
}

export function ensureAdminUser(db) {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "adminadmin";
  const existing = q.getUserByUsername(db, ADMIN_USERNAME);
  if (existing) return;

  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
  db.transaction(() => {
    const uid = q.insertUserRow(db, {
      username: ADMIN_USERNAME,
      password_hash: hash,
      display_name: "Admin",
      avatar_color: "#6366f1",
    });
    const otherIds = db
      .prepare("SELECT id FROM users WHERE id != ?")
      .all(uid)
      .map((r) => r.id);
    for (const oid of otherIds) {
      if (!q.findDmIdBetween(db, uid, oid)) {
        const cid = q.insertConversationRow(db, "dm", null);
        q.insertConversationMember(db, cid, uid);
        q.insertConversationMember(db, cid, oid);
      }
    }
    let gid = q.getGroupConversationId(db);
    if (!gid) {
      gid = q.insertConversationRow(db, "group", "Everyone");
      for (const u of q.listAllUserIds(db)) {
        q.insertConversationMember(db, gid, u);
      }
    } else {
      q.insertConversationMember(db, gid, uid);
    }
  })();

  console.log(
    `[admin] Created admin account — username: "${ADMIN_USERNAME}", password: "${ADMIN_PASSWORD}"`
  );
  console.log(`[admin] Set ADMIN_PASSWORD env var to change the password (takes effect on next startup if account doesn't exist yet).`);
}
