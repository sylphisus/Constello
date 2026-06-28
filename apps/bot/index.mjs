// Constello Discord listener — the conversational ear.
//
// Discord only delivers real message content over a gateway websocket (with the
// MESSAGE_CONTENT privileged intent), which Vercel serverless can't hold open.
// This tiny always-on process holds it and forwards exactly the messages a user
// directs at the bot — an @mention or a reply to the bot — to Constello's
// inbound webhook. Nothing else: no replies, no state. The web app does the rest
// (resolve constellation, assemble match context, Ethan answers by hand).
//
// Run it anywhere always-on (e.g. the VPS):
//   cd apps/bot && npm install && npm start
// Env (apps/bot/.env or real env):
//   DISCORD_BOT_TOKEN        the bot token (same bot as the web app uses)
//   CONSTELLO_INBOUND_URL    https://constello.xyz/api/inbound/discord
//   DISCORD_INBOUND_SECRET   shared secret == the web app's DISCORD_INBOUND_SECRET

import { Client, GatewayIntentBits, Events, Partials } from "discord.js";
import { readFileSync } from "node:fs";

// Minimal .env loader (no dependency): KEY=VALUE lines, ignores # comments.
try {
  for (const line of readFileSync(new URL("./.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* no .env file — rely on real environment */
}

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const INBOUND_URL = process.env.CONSTELLO_INBOUND_URL;
const SECRET = process.env.DISCORD_INBOUND_SECRET;

if (!TOKEN || !INBOUND_URL || !SECRET) {
  console.error(
    "[listener] missing env — need DISCORD_BOT_TOKEN, CONSTELLO_INBOUND_URL, DISCORD_INBOUND_SECRET",
  );
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  // We may need to inspect a replied-to message that isn't cached.
  partials: [Partials.Message],
});

// Is this message directed at the bot? Either it @mentions the bot, or it's a
// reply to one of the bot's own messages.
async function directedAtBot(message) {
  if (message.mentions.has(client.user)) return true;
  const ref = message.reference?.messageId;
  if (!ref) return false;
  try {
    const replied = await message.channel.messages.fetch(ref);
    return replied.author?.id === client.user.id;
  } catch {
    return false;
  }
}

// Strip a leading/embedded <@botid> mention so the forwarded content is the clean
// question ("@bot who's my closest match?" → "who's my closest match?").
function cleanContent(message) {
  return message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
    .replace(/\s+/g, " ")
    .trim();
}

client.once(Events.ClientReady, (c) => {
  console.log(`[listener] ready as ${c.user.tag} — listening for @mentions and replies`);
});

client.on(Events.MessageCreate, async (message) => {
  // Ignore our own messages and other bots.
  if (message.author.bot) return;
  if (!message.guild) return; // server only
  if (!(await directedAtBot(message))) return;

  const content = cleanContent(message);
  if (!content) return; // a bare @mention with no question — nothing to answer

  const payload = {
    messageId: message.id,
    userId: message.author.id,
    username: message.author.username,
    channelId: message.channelId,
    guildId: message.guildId,
    content,
  };

  try {
    const res = await fetch(`${INBOUND_URL}?secret=${encodeURIComponent(SECRET)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[listener] inbound POST ${res.status}: ${await res.text()}`);
    } else {
      console.log(`[listener] forwarded message ${message.id} from @${message.author.username}`);
    }
  } catch (err) {
    console.error("[listener] inbound POST failed:", err);
  }
});

client.login(TOKEN);
