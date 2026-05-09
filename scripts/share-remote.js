const port = process.env.PORT || "3000";

console.log(`
\x1b[35mRemote friends — one link\x1b[0m
\x1b[2m(They do not need your Wi‑Fi.)\x1b[0m

\x1b[1mTerminal 1\x1b[0m — leave this running (builds + serves everything on port ${port}):

  npm run share

\x1b[1mTerminal 2\x1b[0m — leave this running (creates a public https URL):

  cloudflared tunnel --url http://127.0.0.1:${port}

  \x1b[2mDon’t have cloudflared? Install from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
  Or use:  ngrok http ${port}\x1b[0m

\x1b[1mThen\x1b[0m copy the \x1b[1mhttps://…\x1b[0m URL from that second terminal and text it to your friends.

\x1b[1mBefore you share:\x1b[0m set a strong secret so random people can’t forge tokens, e.g.

  export JWT_SECRET=$(openssl rand -hex 32)
  npm run share

Your PC must stay on and both terminals must keep running while people chat.
`);
