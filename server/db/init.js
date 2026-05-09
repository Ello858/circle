import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "data", "app.db");
const schemaPath = path.join(__dirname, "schema.sql");

export function openDatabase() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(schemaPath, "utf8");
  db.exec(schema);
  return db;
}

export function getDbPath() {
  return dbPath;
}
