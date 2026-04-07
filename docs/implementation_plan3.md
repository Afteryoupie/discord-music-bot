# Phase 3: 持久化與進階探索 — 「打造專屬音樂庫」

此階段將從「單純播放」進化為「具備記憶力」的點歌機。透過引入 SQLite 資料庫，實現自動歷史紀錄、智慧推薦，並大幅擴充播放源（播放清單與外部連結）。

## 1. 現有狀態分析

- ✅ **核心播放**：穩定使用 `yt-dlp` + `ffmpeg libopus` 串流。
- ✅ **狀態管理**：每個伺服器具備獨立的 `GuildPlayer` 與 Queue。
- ✅ **基礎控制**：播放、暫停、跳過、查看清單已完備。
- ✅ **Metadata 修復**：已解決 429 造成的 Unknown Title 問題。

---

## 2. 核心改動內容

### A. 資料庫整合 (SQLite)
使用 `better-sqlite3` 建立輕量化資料庫。
- **儲存位置**：`data/music-bot.db`。
- **資料表設計**：
  - `History`: 紀錄 `guild_id`, `video_id`, `title`, `url`, `requested_by`, `played_at`。

### B. 自動播放紀錄 (Listening History)
- 當歌曲開始播放時，自動寫入資料庫。
- 使用者無需手動操作，機器人會自動「記住」大家喜歡聽什麼。

### C. 電台模式 (Radio Mode)
- 當播放清單空了，機器人會根據最後一首歌的 ID 抓取 YouTube 推薦影片。
- 自動從歷史紀錄中抽歌播放。

### D. 播放清單與外部連結支援
- **YouTube Playlist**：支援一次性匯入整個清單。
- **Spotify 轉換**：支援 Spotify 網址轉換為 YouTube 搜尋播放。

---

## 3. 專案結構擬定

```
music-bot/
├── data/
│   └── music-bot.db       # [NEW] 資料庫檔案
├── src/
│   ├── database/
│   │   └── DbManager.js   # [NEW] 資料庫操作封裝
│   ├── commands/
│   │   ├── history.js     # [NEW] 查看歷史紀錄
│   │   └── radio.js       # [NEW] 開關電台模式
│   ├── music/
│   │   ├── playlist.js    # [NEW] 播放清單解析工具
│   │   └── GuildPlayer.js # [MODIFY] 整合紀錄邏輯
│   └── index.js           # [MODIFY] 初始化 DB
```

---

## 4. 驗證計畫

- [ ] 第一首歌播完後，資料庫內是否有產生資料。
- [ ] 執行 `/history` 能否正確列出結果。
- [ ] 開啟電台模式後，清單結束時是否會自動跳出下一首推薦。
- [ ] 貼入 `list=` 網址是否能解析出多首歌曲。

---

> [!TIP]
> 整合自：`architecture_design.md` + `implementation_plan2.md` + `phase2_dev_notes.md`
