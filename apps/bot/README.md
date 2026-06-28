# Constello Discord listener

The conversational ear. Discord delivers real message content only over a gateway
websocket (with the **MESSAGE_CONTENT** privileged intent), which Vercel
serverless can't hold open. This tiny always-on process (runs on the Ubuntu box) holds it and forwards the
messages a user directs at the bot — an `@mention` or a reply to the bot — to the
web app's `/api/inbound/discord`. The web app does everything else.

## One-time Discord setup

In the [Discord developer portal](https://discord.com/developers/applications) →
your app → **Bot**:

1. Enable the **Message Content Intent** (privileged; free under 100 servers).
2. Make sure the bot is in your server with permission to **Read Messages** and
   **Send Messages** in the channel.

## Run (on the always-on Ubuntu box)

Needs Node 20+ (`node -v`; install via [nodesource](https://github.com/nodesource/distributions) if missing).

```sh
cd apps/bot
npm install
cp .env.example .env   # fill in the three values
npm start              # foreground, to confirm it connects
```

You should see `ready as <bot> — listening for @mentions and replies`.

### Keep it alive (systemd)

Once it connects, run it as a service so it survives reboots and restarts on
crash. Edit the two paths/user, then:

```sh
sudo tee /etc/systemd/system/constello-listener.service >/dev/null <<'UNIT'
[Unit]
Description=Constello Discord listener
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/home/YOUR_USER/constello/apps/bot
ExecStart=/usr/bin/node index.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now constello-listener
journalctl -u constello-listener -f   # follow logs
```

(The service reads `apps/bot/.env` automatically — it's loaded by the script.)

## Env

| var | value |
|-----|-------|
| `DISCORD_BOT_TOKEN` | the bot token (same bot the web app uses to send) |
| `CONSTELLO_INBOUND_URL` | `https://www.constello.xyz/api/inbound/discord` (canonical www — apex 308-redirects) |
| `DISCORD_INBOUND_SECRET` | shared secret; must equal the web app's `DISCORD_INBOUND_SECRET` |

## What it forwards

A guild message that @mentions the bot or replies to one of the bot's messages,
with the bot-mention stripped to a clean question. Its own messages, other bots,
DMs, and bare mentions with no text are ignored.
