# Roblox Leaderboard — Railway Backend

Express + TypeScript server that receives leaderboard data from Roblox every 5 minutes, posts it to Discord channels, and serves a live web leaderboard page.

## Setup

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "init"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Deploy on Railway
1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select your repo — Railway auto-detects Node.js and uses `nixpacks.toml`

### 3. Set Environment Variables in Railway
Go to your service → **Variables** tab and add:

| Variable         | Value                                      |
|------------------|--------------------------------------------|
| `SECRET_CODE`    | Your secret from the Roblox script         |
| `DISCORD_TOKEN`  | Your Discord bot token                     |
| `DISCORD_GUILD_ID` | Your Discord server (guild) ID           |
| `CHANNEL_LB1`    | Channel ID for All-Time Kills              |
| `CHANNEL_LB2`    | Channel ID for Monthly Kills               |
| `CHANNEL_LB3`    | Channel ID for Monthly Donations           |
| `CHANNEL_LB4`    | Channel ID for All-Time Donations          |

> `PORT` is set automatically by Railway — don't override it.

### 4. Get your Railway URL
After deploy, Railway gives you a URL like:
```
https://your-app.up.railway.app
```
Update the `BotUrl` in your Roblox script to match.

### 5. Invite your Discord bot
Your bot needs the **Send Messages** and **Read Message History** permissions in each leaderboard channel.

---

## Endpoints

| Method | Path                  | Auth     | Description                    |
|--------|-----------------------|----------|-------------------------------|
| POST   | `/update-leaderboard1` | x-secret | Total kills leaderboard        |
| POST   | `/update-leaderboard2` | x-secret | Monthly kills leaderboard      |
| POST   | `/update-leaderboard3` | x-secret | Monthly donations leaderboard  |
| POST   | `/update-leaderboard4` | x-secret | Total donations leaderboard    |
| GET    | `/api/leaderboards`   | none     | All leaderboard data (JSON)    |
| GET    | `/`                   | none     | Live web leaderboard page      |
| GET    | `/health`             | none     | Health check                   |

## Discord Behaviour
- On first post to a channel, the bot sends a new embed message
- On subsequent updates, it **edits** the existing message (no spam)
- Each leaderboard channel gets its own pinned embed

## Notes
- Data is stored **in-memory**. A server restart clears it (next Roblox push refills it within 5 mins)
- For persistence across restarts, add a Railway Postgres or Redis plugin and replace the `store` object
