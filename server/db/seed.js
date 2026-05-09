import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./init.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Ensures SQLite schema + uploads folder exist.
 * Users are created via the app (Register) — max 5 accounts; each gets DMs + the Everyone group automatically.
 */
const db = openDatabase();

const uploadsDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const n = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
console.log("Database ready.");
console.log(`  Users: ${n} (max 5). New people use Register in the web app.`);
console.log("  Uploads directory:", uploadsDir);
