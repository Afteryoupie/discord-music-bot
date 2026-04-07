# Phase 3: 持久化與進階功能 — 「能記住你」

此階段將機器人從單純的播放器提升為具備記憶能力的點歌系統。重點在於資料庫整合、播放清單支援以及智慧電台功能。

## 核心功能清單

- [ ] **資料庫整合 (SQLite)**：使用 `better-sqlite3` 記錄所有點歌歷史。
- [ ] **自動紀錄系統**：播歌時自動存入資料庫，無需手動點讚。
- [ ] **智慧電台 (Radio Mode)**：Queue 空了自動抓取推薦歌曲續播。
- [ ] **播放清單支援 (Playlists)**：一次加入 YouTube 歌單內所有歌曲。
- [ ] **介面美化 (Embeds)**：使用精美的卡片訊息取代純文字回覆。

---

## 詳細執行計畫

### 1. 資料庫層實作
建立 `src/database/DbManager.js` 並設計 `play_history` 資料表。

### 2. 播放清單解析
建立 `src/music/playlistHelper.js` 利用 `yt-dlp` 提取清單內容。

### 3. 智慧電台邏輯
在 `GuildPlayer.js` 中實作相關推薦歌曲的抓取與自動播歌機制。

### 4. UI 視覺化升級
建立 `src/utils/embedGenerator.js` 統一管理 Discord Embeds 樣式。

---

## 指令擴充
- `/radio`：切換模式。
- `/history`：查看點歌榜與歷史紀錄。
- `/play`：升級支援 `list=` 參數。
