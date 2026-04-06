# 🎵 TARS 音樂機器人

一個輕量級的 Discord 音樂機器人，基於 Node.js 開發，可直接將 YouTube 音訊串流到語音頻道。

**繁體中文** | [English](./README.en.md)

---

## ✨ 功能特色

- 🔗 支援 YouTube 網址直接播放
- 🔍 支援關鍵字搜尋 YouTube
- ⚡ 透過 `yt-dlp` + `ffmpeg` 管道實現快速串流
- 🌐 支援多個 Discord 伺服器（全域 Slash Commands）
- 🛡️ 完善的錯誤處理機制

## 🛠️ 技術棧

| 組件 | 版本 |
|------|------|
| Node.js | 20.18.3+ |
| discord.js | 14.x |
| @discordjs/voice | 0.19.x |
| yt-dlp | 最新版 |
| ffmpeg | 最新版 |
| yt-search | 2.x |

## 📋 環境需求

執行機器人前，請確認已安裝以下軟體：

- **Node.js** v20.18.3 或更高版本
- **yt-dlp** → `brew install yt-dlp`
- **ffmpeg** → `brew install ffmpeg`
- 一個 **Discord Bot Token**（從 [Discord 開發者平台](https://discord.com/developers/applications) 取得）

## 🚀 安裝與設定

### 1. 克隆專案

```bash
git clone https://github.com/Afteryoupie/discord-music-bot.git
cd discord-music-bot
```

### 2. 安裝依賴套件

```bash
npm install
```

### 3. 設定環境變數

複製範例設定檔並填入你的資訊：

```bash
cp .env.example setting.env
```

編輯 `setting.env`：

```env
DISCORD_TOKEN=你的機器人Token
CLIENT_ID=你的應用程式ID
GUILD_ID=你的測試伺服器ID
```

| 變數 | 取得位置 |
|------|---------|
| `DISCORD_TOKEN` | [開發者平台](https://discord.com/developers/applications) → 你的應用程式 → Bot → Token |
| `CLIENT_ID` | 開發者平台 → 你的應用程式 → General Information → Application ID |
| `GUILD_ID` | 在 Discord 右鍵點擊伺服器 → 複製伺服器 ID（需先開啟開發者模式） |

### 4. 部署 Slash Commands

```bash
node scripts/deploy-commands.js
```

> 全域指令最長需等待 1 小時才會在所有伺服器生效。

### 5. 啟動機器人

```bash
node src/index.js
```

## 🎮 指令列表

| 指令 | 說明 | 範例 |
|------|------|------|
| `/play` | 播放 YouTube 音樂（支援網址或關鍵字） | `/play song: 告白氣球` |
| `/leave` | 讓機器人離開語音頻道 | `/leave` |

## 📁 專案結構

```
discord-music-bot/
├── src/
│   ├── index.js              # 主程式入口
│   ├── commands/
│   │   ├── play.js           # /play 指令
│   │   └── leave.js          # /leave 指令
│   └── handlers/
│       └── commandHandler.js # 自動載入指令
├── scripts/
│   └── deploy-commands.js    # 向 Discord 註冊 Slash Commands
├── .env.example              # 環境變數範例
├── package.json
└── README.md
```

## 🔧 運作原理

1. 使用者執行 `/play` 並輸入 YouTube 網址或關鍵字
2. 若為關鍵字，`yt-search` 搜尋最相符的影片
3. `yt-dlp` 提取音訊串流並管道輸出至 `ffmpeg`
4. `ffmpeg` 將音訊轉換為 Discord 所需的 PCM 格式
5. `@discordjs/voice` 將音訊串流到語音頻道

## ⚠️ 注意事項

- **絕對不要 commit `setting.env`** — 它包含你的 Bot Token，已透過 `.gitignore` 排除。
- 機器人需要先被**邀請加入你的伺服器**才能加入語音頻道。
- 請確認機器人在語音頻道有 **連接** 和 **說話** 的權限。

## 🤖 邀請機器人

產生邀請連結（將 `你的CLIENT_ID` 替換為你的 Application ID）：

```
https://discord.com/oauth2/authorize?client_id=你的CLIENT_ID&permissions=36768768&scope=bot+applications.commands
```

## 📄 授權

MIT
