# 🎵 TARS Music Bot

A lightweight Discord music bot built with Node.js that streams YouTube audio directly to voice channels.

[繁體中文](./README.md) | **English**

## ✨ Features

- 🔗 Play music from YouTube URLs
- 🔍 Search YouTube by keywords
- 🔗 Play music from YouTube URLs
- 🔍 Search YouTube by keywords
- 📋 Full queue system, auto-play, and state management (Phase 2)
- ⚡ Fast streaming via `yt-dlp` + `ffmpeg` pipeline
- 🌐 Works across multiple Discord servers independently (Global Slash Commands)
- 🛡️ Robust error handling and unexpected disconnect protection

## 🛠️ Tech Stack

| Component | Version |
|-----------|---------|
| Node.js | 20.18.3+ |
| discord.js | 14.x |
| @discordjs/voice | 0.19.x |
| yt-dlp | Latest |
| ffmpeg | Latest |
| yt-search | 2.x |

## 📋 Prerequisites

Before running the bot, make sure you have:

- **Node.js** v20.18.3 or higher
- **yt-dlp** installed → `brew install yt-dlp`
- **ffmpeg** installed → `brew install ffmpeg`
- A **Discord Bot Token** from the [Discord Developer Portal](https://discord.com/developers/applications)

## 🚀 Setup

### 1. Clone the repository

```bash
git clone https://github.com/Afteryoupie/discord-music-bot.git
cd discord-music-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example env file and fill in your credentials:

```bash
cp .env.example setting.env
```

Edit `setting.env`:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
GUILD_ID=your_test_server_id_here
```

| Variable | Where to find it |
|----------|-----------------|
| `DISCORD_TOKEN` | [Developer Portal](https://discord.com/developers/applications) → Your App → Bot → Token |
| `CLIENT_ID` | Developer Portal → Your App → General Information → Application ID |
| `GUILD_ID` | Right-click your Discord server → Copy Server ID (Enable Developer Mode first) |

### 4. Deploy Slash Commands

```bash
node scripts/deploy-commands.js
```

> Global commands may take up to 1 hour to appear in all servers.

### 5. Start the bot

**Development Mode:**
```bash
node src/index.js
```

**Production Mode (24/7 Hosting):**
It is recommended to use PM2 to manage the bot process:
```bash
# Start and name the bot
pm2 start npm --name "music-bot" -- run start

# Setup daily auto-restart at 4 AM (for stability)
pm2 restart music-bot --cron-restart="0 4 * * *"
pm2 save
```

---

## 🛠️ Maintenance
We have prepared a [Maintenance Cheatsheet](./CHEATSHEET.md) (Traditional Chinese) which includes:
- Checking status and logs
- Manual restarts and updates
- GitHub sync workflow

## 🎮 Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/play` | Play music from YouTube URL or search keywords (Enqueues if already playing) | `/play song: never gonna give you up` |
| `/skip` | Skip the currently playing song | `/skip` |
| `/pause` | Pause the currently playing song | `/pause` |
| `/resume` | Resume the paused song | `/resume` |
| `/queue` | View the current music queue | `/queue` |
| `/nowplaying` | Show details about the currently playing song | `/nowplaying` |
| `/leave` | Disconnect the bot from the voice channel and clear queue | `/leave` |

## 📁 Project Structure

```
discord-music-bot/
├── src/
│   ├── index.js              # Main entry point
│    ├── commands/
│   │   ├── play.js           # /play command (enqueue)
│   │   ├── leave.js          # /leave command (disconnect & clear)
│   │   ├── skip.js           # /skip command
│   │   ├── pause.js          # /pause command
│   │   ├── resume.js         # /resume command
│   │   ├── queue.js          # /queue command
│   │   └── nowplaying.js     # /nowplaying command
│   ├── handlers/
│   │   └── commandHandler.js # Auto-loads commands
│   └── music/
│       ├── audioPipeline.js  # yt-dlp + ffmpeg pipeline
│       └── GuildPlayer.js    # Per-guild music state & queue manager
├── scripts/
│   └── deploy-commands.js    # Register slash commands with Discord
├── .env.example              # Environment variable template
├── package.json
└── README.md
```

## 🔧 How It Works

1. User runs `/play` with a YouTube URL or search keywords
2. If keywords are given, `yt-search` finds the best matching video
3. `yt-dlp` downloads the audio stream and pipes it to `ffmpeg`
4. `ffmpeg` converts the audio to PCM format for Discord
5. `@discordjs/voice` streams the audio to the voice channel

## ⚠️ Important Notes

- **Never commit `setting.env`** — it contains your bot token. It is already excluded via `.gitignore`.
- The bot needs to be **invited to your server** before it can join voice channels.
- Make sure the bot has **Connect** and **Speak** permissions in the voice channel.

## 🤖 Inviting the Bot

Generate an invite link:

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=36768768&scope=bot+applications.commands
```

Replace `YOUR_CLIENT_ID` with your Application ID.

## 📄 License

MIT
