export function getUserByUsername(db, username) {
  return db
    .prepare("SELECT * FROM users WHERE lower(username) = lower(?)")
    .get(username);
}

export function getUserById(db, id) {
  return db.prepare("SELECT id, username, display_name, avatar_color, created_at FROM users WHERE id = ?").get(id);
}

export function listConversationIdsForUser(db, userId) {
  return db
    .prepare(
      `SELECT conversation_id FROM conversation_members WHERE user_id = ?`
    )
    .all(userId)
    .map((r) => r.conversation_id);
}

export function isMember(db, conversationId, userId) {
  const row = db
    .prepare(
      `SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?`
    )
    .get(conversationId, userId);
  return Boolean(row);
}

export function getConversationRow(db, conversationId) {
  return db.prepare("SELECT * FROM conversations WHERE id = ?").get(conversationId);
}

export function getLastMessage(db, conversationId) {
  return db
    .prepare(
      `SELECT m.*, u.display_name AS sender_display_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ?
       ORDER BY m.id DESC
       LIMIT 1`
    )
    .get(conversationId);
}

export function getPeerInDm(db, conversationId, myUserId) {
  return db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.avatar_color
       FROM conversation_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.conversation_id = ? AND cm.user_id != ?`
    )
    .get(conversationId, myUserId);
}

export function getMemberLastRead(db, conversationId, userId) {
  const row = db
    .prepare(
      `SELECT last_read_message_id FROM conversation_members
       WHERE conversation_id = ? AND user_id = ?`
    )
    .get(conversationId, userId);
  return row?.last_read_message_id ?? null;
}

export function updateLastRead(db, conversationId, userId, messageId) {
  db.prepare(
    `UPDATE conversation_members
     SET last_read_message_id = CASE
       WHEN last_read_message_id IS NULL OR last_read_message_id < @mid THEN @mid
       ELSE last_read_message_id
     END
     WHERE conversation_id = @cid AND user_id = @uid`
  ).run({ mid: messageId, cid: conversationId, uid: userId });
}

export function unreadCount(db, conversationId, userId) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM messages
       WHERE conversation_id = @cid
         AND sender_id != @uid
         AND id > COALESCE(
           (SELECT last_read_message_id FROM conversation_members
            WHERE conversation_id = @cid AND user_id = @uid), 0)`
    )
    .get({ cid: conversationId, uid: userId });
  return row.c;
}

export function insertMessage(db, { conversationId, senderId, body, imagePath }) {
  const r = db
    .prepare(
      `INSERT INTO messages (conversation_id, sender_id, body, image_path)
       VALUES (@conversationId, @senderId, @body, @imagePath)`
    )
    .run({
      conversationId,
      senderId,
      body: body ?? null,
      imagePath: imagePath ?? null,
    });
  return Number(r.lastInsertRowid);
}

export function getMessageById(db, messageId) {
  return db.prepare("SELECT * FROM messages WHERE id = ?").get(messageId);
}

export function listMessages(db, conversationId, { limit = 80, beforeId = null } = {}) {
  if (beforeId) {
    return db
      .prepare(
        `SELECT m.*, u.display_name AS sender_display_name, u.username AS sender_username, u.avatar_color AS sender_avatar_color
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.conversation_id = ? AND m.id < ?
         ORDER BY m.id DESC
         LIMIT ?`
      )
      .all(conversationId, beforeId, limit)
      .reverse();
  }
  return db
    .prepare(
      `SELECT m.*, u.display_name AS sender_display_name, u.username AS sender_username, u.avatar_color AS sender_avatar_color
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ?
       ORDER BY m.id DESC
       LIMIT ?`
    )
    .all(conversationId, limit)
    .reverse();
}

export function listAllUsers(db) {
  return db
    .prepare(
      `SELECT id, username, display_name, avatar_color FROM users ORDER BY id`
    )
    .all();
}

export function enrichMessage(db, messageId) {
  return db
    .prepare(
      `SELECT m.*, u.display_name AS sender_display_name, u.username AS sender_username, u.avatar_color AS sender_avatar_color
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.id = ?`
    )
    .get(messageId);
}

export function countUsers(db) {
  return db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
}

export function findDmIdBetween(db, userIdA, userIdB) {
  const row = db
    .prepare(
      `SELECT c.id
       FROM conversations c
       WHERE c.type = 'dm'
         AND (SELECT COUNT(*) FROM conversation_members cm WHERE cm.conversation_id = c.id) = 2
         AND EXISTS (
           SELECT 1 FROM conversation_members cm
           WHERE cm.conversation_id = c.id AND cm.user_id = @a
         )
         AND EXISTS (
           SELECT 1 FROM conversation_members cm2
           WHERE cm2.conversation_id = c.id AND cm2.user_id = @b
         )
       LIMIT 1`
    )
    .get({ a: userIdA, b: userIdB });
  return row?.id ?? null;
}

export function insertConversationRow(db, type, name) {
  const r = db
    .prepare(`INSERT INTO conversations (type, name) VALUES (@type, @name)`)
    .run({ type, name });
  return Number(r.lastInsertRowid);
}

export function insertConversationMember(db, conversationId, userId) {
  db.prepare(
    `INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)`
  ).run(conversationId, userId);
}

export function getGroupConversationId(db) {
  const row = db
    .prepare(`SELECT id FROM conversations WHERE type = 'group' LIMIT 1`)
    .get();
  return row?.id ?? null;
}

export function getAllConversationIds(db) {
  return db.prepare("SELECT id FROM conversations").all().map((r) => r.id);
}

export function deleteAllMessages(db) {
  return db.prepare("DELETE FROM messages").run().changes;
}

export function deleteMessagesBySender(db, senderId) {
  db.prepare("DELETE FROM messages WHERE sender_id = ?").run(senderId);
}

export function deleteUser(db, userId) {
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
}

export function getConversationsWithExpiredMessages(db) {
  return db
    .prepare(
      `SELECT DISTINCT conversation_id FROM messages
       WHERE created_at < datetime('now', '-24 hours')`
    )
    .all()
    .map((r) => r.conversation_id);
}

export function deleteOldMessages(db) {
  return db
    .prepare(`DELETE FROM messages WHERE created_at < datetime('now', '-24 hours')`)
    .run().changes;
}

export function updateUserProfile(db, userId, { username, display_name }) {
  if (username) {
    db.prepare("UPDATE users SET username = ? WHERE id = ?").run(username, userId);
  }
  if (display_name) {
    db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(display_name, userId);
  }
}

export function updatePasswordHash(db, userId, passwordHash) {
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(passwordHash, userId);
}

export function listAllUserIds(db) {
  return db
    .prepare(`SELECT id FROM users ORDER BY id`)
    .all()
    .map((r) => r.id);
}

export function insertUserRow(db, { username, password_hash, display_name, avatar_color }) {
  const r = db
    .prepare(
      `INSERT INTO users (username, password_hash, display_name, avatar_color)
       VALUES (@username, @password_hash, @display_name, @avatar_color)`
    )
    .run({ username, password_hash, display_name, avatar_color });
  return Number(r.lastInsertRowid);
}
