import express, { Request, Response, NextFunction } from "express";
import { Client, GatewayIntentBits, TextChannel, EmbedBuilder } from "discord.js";
import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  username: string;
  score: number;
  unit: "kills" | "robux";
}

interface LeaderboardPayload {
  leaderboard: LeaderboardEntry[];
}

interface StoredLeaderboard {
  entries: LeaderboardEntry[];
  updatedAt: string;
}

// ─── Config (set these as Railway environment variables) ──────────────────────

const PORT           = process.env.PORT || 3000;
const SECRET_CODE    = process.env.SECRET_CODE || "sadfdsdsfdjsnghsigmababytuffhoneyfdsd";
const DISCORD_TOKEN  = process.env.DISCORD_TOKEN || "";
const DISCORD_GUILD  = process.env.DISCORD_GUILD_ID || "";

// One channel ID per leaderboard — set these env vars in Railway
const CHANNEL_IDS: Record<string, string> = {
  "/update-leaderboard1": process.env.CHANNEL_LB1 || "", // Total Kills
  "/update-leaderboard2": process.env.CHANNEL_LB2 || "", // Monthly Kills
  "/update-leaderboard3": process.env.CHANNEL_LB3 || "", // Monthly Donations
  "/update-leaderboard4": process.env.CHANNEL_LB4 || "", // Total Donations
};

const LEADERBOARD_TITLES: Record<string, string> = {
  "/update-leaderboard1": "🗡️ All-Time Kills",
  "/update-leaderboard2": "⚔️ Monthly Kills",
  "/update-leaderboard3": "💎 Monthly Donations",
  "/update-leaderboard4": "👑 All-Time Donations",
};

// ─── In-memory store (persists until server restarts) ─────────────────────────
// For persistence across restarts, replace with a DB (e.g. Railway Postgres/Redis)

const store: Record<string, StoredLeaderboard> = {};

// ─── Discord Client ───────────────────────────────────────────────────────────

const discord = new Client({ intents: [GatewayIntentBits.Guilds] });

let discordReady = false;

if (DISCORD_TOKEN) {
  discord.once("ready", () => {
    console.log(`✅ Discord bot logged in as ${discord.user?.tag}`);
    discordReady = true;
  });
  discord.login(DISCORD_TOKEN).catch((e) =>
    console.error("Discord login failed:", e.message)
  );
} else {
  console.warn("⚠️  DISCORD_TOKEN not set — Discord posting disabled.");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rankEmoji(i: number): string {
  return ["🥇", "🥈", "🥉"][i] ?? `**${i + 1}.**`;
}

function formatScore(score: number, unit: "kills" | "robux"): string {
  const formatted = score.toLocaleString();
  return unit === "robux" ? `${formatted} R$` : `${formatted} kills`;
}

async function postToDiscord(
  endpoint: string,
  entries: LeaderboardEntry[]
): Promise<void> {
  if (!discordReady) return;

  const channelId = CHANNEL_IDS[endpoint];
  if (!channelId) {
    console.warn(`No CHANNEL_ID configured for ${endpoint}`);
    return;
  }

  const channel = await discord.channels.fetch(channelId).catch(() => null);
  if (!channel || !(channel instanceof TextChannel)) {
    console.warn(`Channel ${channelId} not found or not a text channel`);
    return;
  }

  const title = LEADERBOARD_TITLES[endpoint] ?? "Leaderboard";
  const description = entries
    .map(
      (e, i) =>
        `${rankEmoji(i)} **${e.username}** — ${formatScore(e.score, e.unit)}`
    )
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description || "*No entries yet.*")
    .setColor(entries[0]?.unit === "robux" ? 0xf5d442 : 0xe74c3c)
    .setFooter({ text: "Updated every 5 minutes" })
    .setTimestamp();

  // Try to find and edit the last bot message, otherwise send a new one
  const messages = await channel.messages.fetch({ limit: 10 });
  const existing = messages.find((m: { author: { id: string } }) => m.author.id === discord.user?.id);

  if (existing) {
    await existing.edit({ embeds: [embed] });
  } else {
    await channel.send({ embeds: [embed] });
  }
}

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Auth middleware
function requireSecret(req: Request, res: Response, next: NextFunction): void {
  if (req.headers["x-secret"] !== SECRET_CODE) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// ─── Leaderboard update endpoints ─────────────────────────────────────────────

const endpoints = [
  "/update-leaderboard1",
  "/update-leaderboard2",
  "/update-leaderboard3",
  "/update-leaderboard4",
];

for (const ep of endpoints) {
  app.post(ep, requireSecret, async (req: Request, res: Response) => {
    const body = req.body as LeaderboardPayload;

    if (!body?.leaderboard || !Array.isArray(body.leaderboard)) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    // Store in memory
    store[ep] = {
      entries: body.leaderboard,
      updatedAt: new Date().toISOString(),
    };

    console.log(`📊 ${ep} updated — ${body.leaderboard.length} entries`);

    // Post to Discord (fire and forget)
    postToDiscord(ep, body.leaderboard).catch((e) =>
      console.error(`Discord post failed for ${ep}:`, e.message)
    );

    res.json({ ok: true, count: body.leaderboard.length });
  });
}

// ─── Read endpoints (for the web UI) ─────────────────────────────────────────

app.get("/api/leaderboards", (_req: Request, res: Response) => {
  const result: Record<string, StoredLeaderboard & { title: string }> = {};
  for (const ep of endpoints) {
    result[ep] = {
      title: LEADERBOARD_TITLES[ep],
      entries: store[ep]?.entries ?? [],
      updatedAt: store[ep]?.updatedAt ?? "",
    };
  }
  res.json(result);
});

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
  
