# Circle

> A private, invite-only real-time messaging app for small, trusted groups — your own space, your own rules.


---

## What is Circle?

Circle is a self-hosted, local-first chat application designed for tight-knit groups of up to 10 people. Think of it as your own private corner of the internet — no algorithms, no ads, no strangers. Just your circle.

Every message disappears after 24 hours, keeping conversations fresh and your history clean. The admin has full control over who's in, what's shared, and how the space is managed.

---

## Features

- **Real-time messaging** — instant delivery via WebSockets, no refresh needed
- **Group chat + direct messages** — one shared "Everyone" room plus automatic 1-on-1 DMs with every member
- **Image sharing** — send photos inline in any conversation
- **24-hour auto-purge** — all messages are automatically deleted after 24 hours; a live countdown shows exactly when the next sweep runs
- **Read receipts** — see when the other person has read your message
- **Online presence** — green/grey dot indicators show who's active right now
- **Invite-only** — capped at 10 members; no one can join once the circle is full
- **Forgot password flow** — password reset via a shared secret key set by the admin
- **Admin account** with a full control panel (see below)
- **Dark theme** — clean, modern UI that's easy on the eyes

---

## Admin Account

Circle ships with a hardcoded `admin` account that is created automatically on first startup.

**Default credentials:**
```
Username: admin
Password: adminadmin
```

> ⚠️ **PLEASE CHANGE THE DEFAULT PASSWORD.** Set the `ADMIN_PASSWORD` environment variable in your Replit Secrets before deploying, or change it via the admin panel immediately after first login. Leaving it as `adminadmin` is a security risk — don't be that person.

### What the admin can do

- **Purge all chats** — wipe every message across every conversation instantly (with a confirmation step)
- **Reset any user's password** — no reset key required
- **Edit any user's username or display name**
- **Delete any user account**
- **Change their own display name**
- **Chat normally** like any other member

Admin messages are visually tagged with an **ADMIN** badge in chat so everyone always knows who they're talking to.

---

## How It Works

1. **Admin boots the app** — the `admin` account is created automatically in the background on first run
2. **Members sign up** — each person registers with their own username and password (up to 10 people total)
3. **Conversations auto-create** — every new member instantly gets a DM with every existing member, plus membership in the shared "Everyone" group chat
4. **Chat in real-time** — messages, images, and read receipts are all delivered live via WebSockets
5. **Auto-delete runs** — a background job purges all messages older than 24 hours every 60 seconds; a countdown widget shows how long until the next sweep
6. **Admin panel** — log in as `admin` and tap the shield icon in the sidebar to manage users and conversations

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS |
| Backend | Node.js + Express |
| Real-time | Socket.io |
| Database | SQLite (via better-sqlite3) |
| Auth | JWT + bcrypt |

---

## Hosting

> **This app is built for [Replit](https://replit.com) and works best there.** Replit handles the runtime, persistent storage, and networking out of the box. For the best chance of everything working correctly — especially the database, file uploads, and WebSocket connections — host it on Replit.

### Deploy on Replit

1. Import this repo into Replit
2. Open **Secrets** and set the following environment variables:
   - `JWT_SECRET` — a long random string for signing auth tokens (required)
   - `ADMIN_PASSWORD` — your admin password (**do not skip this**)
   - `RESET_KEY` — the shared passphrase used for the forgot-password flow
3. Hit **Run** — the server starts on port 3000, the frontend on port 5000
4. Use Replit's **Deploy** button to publish to a permanent `.replit.app` URL that stays online 24/7

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Secret key for signing auth tokens. Use a long random string. |
| `ADMIN_PASSWORD` | **Strongly recommended** | Password for the admin account. Defaults to `adminadmin` — change it. |
| `RESET_KEY` | Optional | Passphrase for the forgot-password flow. Has a built-in default. |

---

## Project Structure

```
circle/
├── client/               # React + Vite frontend
│   └── src/
│       ├── components/   # Sidebar, ChatView, AdminPanel, MessageInput, …
│       ├── pages/        # ChatApp, AuthScreen
│       ├── context/      # Auth + Socket React contexts
│       └── api.ts        # Typed API client
└── server/               # Express + Socket.io backend
    ├── src/
    │   ├── index.js      # Entry point
    │   ├── routes.js     # REST API routes
    │   ├── socket.js     # WebSocket event handlers
    │   ├── queries.js    # All SQLite queries
    │   └── admin.js      # Admin account bootstrap
    └── db/
        └── schema.sql    # Database schema
```

---

## License

MIT

---

*Built with React, Express, Socket.io, and SQLite. Hosted on Replit.*
