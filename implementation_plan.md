# Phase 1 MVP — Discord 音樂機器人 (Node.js)

實作一個**最小可行性 Discord 機器人**，能夠加入語音頻道並播放 YouTube 音樂。

## User Review Required

> [!IMPORTANT]
> 執行前請確認你已在 [Discord Developer Portal](https://discord.com/developers/applications) 把機器人建立好，並準備好以下兩個資訊：
> - **Bot Token**（機器人的身分金鑰）
> - **Client ID**（Application ID）
>
> 這兩個值會寫入 `.env` 檔案，不會 commit 進 Git。

> [!WARNING]
> 系統必須已安裝 **FFmpeg**。建議透過 `brew install ffmpeg`（macOS）或在 VPS 上用 `apt-get install ffmpeg` 安裝。或者可使用 `ffmpeg-static` npm 套件（本次計劃採用此方案，不需額外系統安裝）。

---

## 專案結構（最終）

```
music-bot/
├── src/
│   ├── commands/
│   │   ├── play.js       # /play 指令
│   │   └── leave.js      # /leave 指令
│   ├── handlers/
│   │   └── commandHandler.js  # 自動載入並分發指令
│   └── index.js          # 主程式入口
├── scripts/
│   └── deploy-commands.js # 向 Discord 註冊 Slash Command
├── .env                  # Bot Token 等敏感設定（不 commit）
├── .env.example          # 範本檔案（commit 進去）
├── .gitignore
└── package.json
```

---

## 採用套件

| 套件 | 用途 |
|------|------|
| `discord.js` v14 | 與 Discord API 通訊的主框架 |
| `@discordjs/voice` | 語音頻道連線、播放音訊 |
| `@discordjs/opus` | Opus 音訊編碼（Discord 語音格式） |
| `play-dl` | 取得 YouTube 音訊串流 URL（不需外部依賴） |
| `ffmpeg-static` | 打包好的 FFmpeg binary，不需系統安裝 |
| `dotenv` | 讀取 `.env` 設定檔 |

---

## Proposed Changes

### 環境與設定檔

#### [NEW] `.env.example`
範本設定檔，包含以下三個欄位：
```
DISCORD_TOKEN=你的機器人Token
CLIENT_ID=你的應用程式ID
GUILD_ID=你的伺服器ID（開發測試用，讓指令立即生效）
```

#### [NEW] `.gitignore`
忽略 `node_modules/` 與 `.env`。

---

### 核心程式

#### [NEW] `src/index.js`
- 主程式入口。
- 引入 `discord.js` 的 `Client`，登入並監聽 `interactionCreate` 事件。
- 呼叫 `commandHandler` 載入所有指令。

#### [NEW] `src/handlers/commandHandler.js`
- 自動掃描 `src/commands/` 資料夾下的所有 `.js` 檔案。
- 將每個指令的 `data`（名稱/描述）與 `execute`（執行函式）掛載到 Client。

#### [NEW] `src/commands/play.js`
- Slash Command 定義：`/play url:<YouTube網址>`。
- 執行邏輯：
  1. 確認使用者在語音頻道內，否則回覆錯誤訊息。
  2. 使用 `play-dl` 取得串流。
  3. 使用 `@discordjs/voice` 加入語音頻道並播放。
  4. 播放結束後自動離開。

#### [NEW] `src/commands/leave.js`
- Slash Command 定義：`/leave`。
- 執行邏輯：讓機器人從目前語音頻道斷線，若不在頻道內則回覆提示。

#### [NEW] `scripts/deploy-commands.js`
- 使用 Discord REST API 向指定伺服器（`GUILD_ID`）一次性註冊所有 Slash Commands。
- 開發時使用 Guild Command（即時生效），部署上線後可改成 Global Command（生效需等最長1小時）。

---

## Verification Plan

### 自動驗證
```bash
# 安裝套件後確認無錯誤
npm install

# 部署指令到 Discord
node scripts/deploy-commands.js

# 啟動機器人（確認無啟動錯誤）
node src/index.js
```

### 手動驗證
1. 在 Discord 伺服器的語音頻道中等候。
2. 在文字頻道輸入 `/play url:https://www.youtube.com/watch?v=...`。
3. 確認機器人加入語音頻道並播放音樂。
4. 輸入 `/leave`，確認機器人離開。
