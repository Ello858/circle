import express from "express";
import cors from "cors";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { openDatabase } from "../db/init.js";
import { createRouter } from "./routes.js";
import { attachSocketIO } from "./socket.js";
import { ensureAdminUser } from "./admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

const db = openDatabase();
ensureAdminUser(db);
const { getOnlineUserIds, joinUserToConversation, broadcastConversationsRefresh, broadcastPurgeAll } = attachSocketIO(io, db);
app.locals.getOnlineUserIds = getOnlineUserIds;
app.locals.joinUserToConversation = joinUserToConversation;
app.locals.broadcastConversationsRefresh = broadcastConversationsRefresh;
app.locals.broadcastPurgeAll = broadcastPurgeAll;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

const uploadsDir = path.join(__dirname, "..", "uploads");
app.use("/uploads", express.static(uploadsDir));

app.use("/api", createRouter(db));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

const clientDist = path.join(__dirname, "..", "..", "client", "dist");
const indexHtml = path.join(clientDist, "index.html");

if (fs.existsSync(indexHtml)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/uploads") ||
      req.path.startsWith("/socket.io")
    ) {
      return next();
    }
    res.sendFile(indexHtml, (err) => (err ? next(err) : undefined));
  });
} else {
  console.warn(
    "[private-messenger] No client/dist — API only. Run `npm run build` in client/ to serve the web UI on this port."
  );
}

server.listen(PORT, HOST, () => {
  console.log(`Server on http://${HOST}:${PORT}`);
  if (fs.existsSync(indexHtml)) {
    console.log(`  Web UI + API + Socket.io (open http://localhost:${PORT} locally)`);
  } else {
    console.log(`  API + Socket.io only (use Vite on :5173 in dev, or build the client)`);
  }
});
