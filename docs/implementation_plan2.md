# Phase 2: 核心播放體驗 — 「能當點歌機」

將現有的 Phase 1 MVP 升級為完整的點歌機系統，支援播放清單 (Queue)、基礎播放控制指令、以及自動輪播。

## 現有狀態分析

Phase 1 已完成：
- ✅ `/play <URL或關鍵字>` — 搜尋 + yt-dlp → ffmpeg pipeline 播放
- ✅ `/leave` — 離開語音頻道
- ✅ 基礎 Command Handler 自動載入機制
- ✅ YouTube 關鍵字搜尋（已透過 `yt-search` 實現）

Phase 1 的問題：
- 每次 `/play` 都建立新的 player + connection，無法排隊
- 播完一首就自動斷線，沒有自動播放下一首
- 沒有 pause/resume/skip 控制
- player 和 connection 沒有跨指令共用

---

## User Review Required

> [!IMPORTANT]
> 此次改動會**重構** `play.js`，將音訊管道 (audio pipeline) 邏輯抽離到獨立的 `GuildPlayer` 模組中。`/play` 指令變成只負責「加歌到 Queue」，實際播放邏輯由 GuildPlayer 負責。

> [!WARNING]
> 新增 5 個 Slash Commands，部署後需要重新執行 `node scripts/deploy-commands.js` 來註冊。Global commands 最多需要 1 小時才會生效。

---

## 專案結構（Phase 2 改動後）

```
music-bot/
├── src/
│   ├── commands/
│   │   ├── play.js        # [MODIFY] 改為加入 queue，不直接管 player
│   │   ├── leave.js       # [MODIFY] 離開時清空 queue
│   │   ├── skip.js        # [NEW] 跳過當前歌曲
│   │   ├── pause.js       # [NEW] 暫停播放
│   │   ├── resume.js      # [NEW] 恢復播放
│   │   ├── queue.js       # [NEW] 查看播放清單
│   │   └── nowplaying.js  # [NEW] 正在播放的歌曲資訊
│   ├── handlers/
│   │   └── commandHandler.js  # (不變)
│   ├── music/
│   │   ├── GuildPlayer.js     # [NEW] 每個伺服器的播放狀態管理器
│   │   └── audioPipeline.js   # [NEW] yt-dlp + ffmpeg pipeline (從 play.js 抽離)
│   └── index.js               # (不變)
├── scripts/
│   └── deploy-commands.js     # (不變，但需重新執行)
└── package.json               # (不變)
```

---

## Proposed Changes

### 音樂核心模組 (`src/music/`)

這是 Phase 2 最重要的新增模組，將播放邏輯從指令中獨立出來。

---

#### [NEW] `src/music/audioPipeline.js`

從 `play.js` 中抽取出來的 `createAudioPipeline()` 函式與 `isYouTubeURL()` 工具函式。
保持相同邏輯，僅搬移位置以便多處共用。

---

#### [NEW] `src/music/GuildPlayer.js`

**核心設計：每個伺服器（Guild）擁有獨立的 GuildPlayer 實例。**

使用 `Map<guildId, GuildPlayer>` 管理所有伺服器的狀態。

```js
// GuildPlayer 資料結構概念
class GuildPlayer {
  guildId;          // 伺服器 ID
  queue = [];       // Song[] — 待播清單
  nowPlaying = null; // 當前歌曲 { title, url, duration, requestedBy }
  connection;       // VoiceConnection
  player;           // AudioPlayer
  textChannel;      // 用來發送「正在播放」通知的文字頻道

  enqueue(song);        // 加歌到 queue 尾端
  skip();               // 跳過 → 觸發播放下一首
  pause();              // player.pause()
  resume();             // player.unpause()
  playNext();           // 從 queue 取出第一首來播放
  destroy();            // 清空並斷線
}
```

**關鍵行為：**

1. **`enqueue(song)`**：將歌曲加入 queue。若目前沒有在播放（player 處於 Idle），立即呼叫 `playNext()`。
2. **`playNext()`**：
   - 從 queue 取出第一首歌。
   - 呼叫 `createAudioPipeline(url)` 建立串流。
   - 建立 `AudioResource` 並 `player.play(resource)`。
   - 在文字頻道發送「🎵 正在播放：**歌名**」通知。
3. **Player `Idle` 事件監聽**：
   - 播放結束時，自動呼叫 `playNext()`。
   - 若 queue 已空，等待 3 分鐘後自動斷線離開語音頻道（避免佔用資源）。
4. **Player `error` 事件**：
   - 記錄錯誤日誌。
   - 發送錯誤訊息到文字頻道。
   - 自動呼叫 `playNext()` 跳到下一首（容錯機制）。

**全域管理：**
```js
// 模組底部 export
const guildPlayers = new Map();

function getOrCreate(guildId) {
  if (!guildPlayers.has(guildId)) {
    guildPlayers.set(guildId, new GuildPlayer(guildId));
  }
  return guildPlayers.get(guildId);
}

module.exports = { GuildPlayer, getOrCreate, guildPlayers };
```

---

### 指令修改

---

#### [MODIFY] `src/commands/play.js`

**重構重點**：不再自己管 player/connection，改為呼叫 GuildPlayer。

邏輯簡化為：
1. 確認使用者在語音頻道。
2. 解析 URL 或搜尋關鍵字（保留現有邏輯）。
3. 取得或建立 GuildPlayer，確保已連線到語音頻道。
4. 呼叫 `guildPlayer.enqueue({ title, url, duration, requestedBy })`。
5. 回覆「✅ 已加入播放清單」或「🎵 正在播放」。

---

#### [MODIFY] `src/commands/leave.js`

增加對 GuildPlayer 的清理：
```js
const gp = getOrCreate(interaction.guildId);
gp.destroy();
```

---

#### [NEW] `src/commands/skip.js`

- `/skip` — 跳過當前歌曲。
- 邏輯：呼叫 `guildPlayer.skip()`，若 queue 有下一首則自動播放。
- 回覆「⏭️ 已跳過：**歌名**」。

---

#### [NEW] `src/commands/pause.js`

- `/pause` — 暫停播放。
- 邏輯：呼叫 `guildPlayer.pause()`。
- 回覆「⏸️ 已暫停」，如果已經是暫停狀態則提示。

---

#### [NEW] `src/commands/resume.js`

- `/resume` — 恢復播放。
- 邏輯：呼叫 `guildPlayer.resume()`。
- 回覆「▶️ 繼續播放」，如果未暫停則提示。

---

#### [NEW] `src/commands/queue.js`

- `/queue` — 顯示當前播放清單。
- 顯示格式：

```
🎵 正在播放：歌名A (3:42) — 點歌者
━━━━━━━━━━━━━━━━━
📋 播放清單 (3 首等待中)：
 1. 歌名B (4:15) — 點歌者
 2. 歌名C (2:58) — 點歌者
 3. 歌名D (5:30) — 點歌者
```

- 若清單超過 10 首，只顯示前 10 首並標注「…還有 N 首」。

---

#### [NEW] `src/commands/nowplaying.js`

- `/nowplaying` — 顯示正在播放的歌曲詳情。
- 顯示：歌名、時長、YouTube 網址、點歌者。

---

## Open Questions

> [!IMPORTANT]
> **yt-dlp / ffmpeg 路徑**：目前 `play.js` 硬寫了 `/opt/homebrew/bin/` 的路徑。在 Oracle Cloud VPS 上路徑不同。Phase 2 要把這些路徑改成環境變數 (`FFMPEG_PATH`, `YTDLP_PATH`)，還是改用 `which` 動態偵測？建議改為環境變數 + fallback 到 PATH 搜尋。

> [!NOTE]
> **自動斷線計時器**：機器人在 queue 播完後，預設等 3 分鐘再自動離開語音頻道。這個時間可以接受嗎？

---

## Verification Plan

### 自動驗證
```bash
# 重新部署指令到 Discord
node scripts/deploy-commands.js

# 啟動機器人
node src/index.js
```

### 手動驗證
1. `/play <歌1>` → 機器人加入語音頻道並開始播放。
2. `/play <歌2>` → 回覆「已加入播放清單」，不中斷當前播放。
3. `/queue` → 顯示歌1正在播放、歌2等待中。
4. `/nowplaying` → 顯示歌1的詳細資訊。
5. `/pause` → 暫停播放。
6. `/resume` → 恢復播放。
7. `/skip` → 跳過歌1，自動播放歌2。
8. 歌2播完後 → 3分鐘無新歌自動離開。
9. `/leave` → 立即離開並清空 queue。
10. 測試錯誤容錯：輸入無效 URL → 應跳過並播下一首。
