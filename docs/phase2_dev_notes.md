# Phase 2 開發筆記 (Dev Notes)

這份文件記錄了 **Phase 2 (點歌機系統)** 所做的架構改動、遇到的坑與解決方案，供未來（Phase 3 等後續開發）參考。

## 1. 架構重構：全域播放狀態管理 (`GuildPlayer`)
從原先單一指令內管理播放生命週期，改為使用獨立模組 `src/music/GuildPlayer.js` 管理。
- 每當機器人加入新伺服器時，會以 `guildId` 建立專屬的 `GuildPlayer` 實例。
- 負責維護 `queue` (待播清單)、`nowPlaying` (當前歌曲)、`connection` (語音連線)、`player` (音頻播放器)。
- **自動輪播**：綁定 `AudioPlayerStatus.Idle` 事件，若清單內還有歌曲則自動執行 `playNext()`。
- **自動斷線設計**：如果清單空了，會啟動一個 3 分鐘的 `_idleTimer` 計時器，逾時後自動 `destroy()` 語音連線以節省資源。

## 2. 解決 YouTube 爬蟲限制 (HTTP 429)
- **問題**：原本透過 `yt-search` (背後去爬 YouTube 網頁) 抓取網址對應影片標題，但 VPS 的 IP 容易被 YouTube 偵測並以 `429 Too Many Requests` 阻擋，導致 `/nowplaying` 和頻道通知變成 `<Unknown>`。
- **解法**：在 `audioPipeline.js` 寫了一個 `getVideoMetadata(url)` 函數。當使用者直接提供 URL 時，改用我們安裝的硬核下載器 `yt-dlp` (加上 `--print "%(title)s|%(duration_string)s"` 參數) 來提取資訊，成功繞過單純的網頁 rate limit。

## 3. 修復 EPIPE 崩潰問題 (管道關閉錯誤)
- **問題**：當使用者執行 `/skip` 或遇到錯誤時，我們手動 kill 了 FFmpeg 子程序。然而 `yt-dlp` 發現 stdout 管線 (Pipe) 被切斷了，卻依然試圖寫入，導致 Node.js 控制台拋出 `EPIPE` 未擷取例外 (Unhandled Promise/Event Rejection) 進而造成機器人重啟。
- **解法**：在 `createAudioPipeline` 函式中，為 `yt-dlp.stdout` 及 `ffmpeg.stdin/stdout` 明確註冊了 `.on('error', noop)` 事件。且在 cleanup 時採取「先 `unpipe()` 再 `destroy()` stdin，最後再 kill` 的優雅結束法。

## 4. 解決語音卡頓 (音頻編碼最佳化)
- **問題**：最初直接餵給 Discord 的格式是 `StreamType.Raw` (PCM 純音檔)，這迫使 `@discordjs/voice` 底層使用 Node.js 的進程再次編碼為 Opus 格式。當系統略為忙碌、或垃圾回收 (GC) 觸發時，就會引發極短暫的音訊不同步或卡頓。
- **解法**：
  1. 修改 FFmpeg 指令：加上 `-c:a libopus` (使用 libopus 處理器)，加上 `-frame_duration 20` 且封裝為 `-f opus` (Ogg Opus 容器)。
  2. 修改 Discord 的輸入要求：將 `inputType: StreamType.Raw` 替換為原生的 `StreamType.OggOpus`。
  3. **成果**：CPU 使用率大幅下降（Node 只負責搬運分封包，不負責編碼），音質極其穩定不再卡頓。也順便加入了 `inlineVolume: false` 進一步節省效能。

## 5. 指令結構與操作
- 新增：`/queue` (查看前10首)、`/skip` (跳過當前觸發自動播放)、`/pause` (暫停)、`/resume` (恢復)、`/nowplaying` (詳情)。
- 指令都變得極度輕量化（幾乎只有回傳文字與呼叫 `GuildPlayer` 方法），將複雜的商業邏輯全部抽離到了 `src/music` 之下。

## 6. 未來擴充想法：電台功能 (Radio Mode)
為了提升使用者體驗，未來可以考慮加入以下幾種電台實作：

- **YouTube 自動續播 (Auto-play Radio)**：
  - **核心邏輯**：當 `queue` 空了，根據最後一首歌的 `videoId` 透過 API 抓取推薦歌曲（Related Videos）。
  - **技術關鍵**：在 `GuildPlayer` 內新增 `isRadioMode` 開關，並在 `playNext()` 結尾觸發推薦抓取。
- **網路串流電台 (Internet Radio)**：
  - **核心邏輯**：支援 `.m3u8` 或 `.pls` 的串流連結，或是 YouTube 長時間直播。
  - **技術關鍵**：檢測 `yt-dlp` 的 `is_live` 屬性，並對直播串流關閉自動下一首邏輯。

- **伺服器專屬歌單 (Server Shuffle)**：
  - **核心邏輯**：整合資料庫，當清單空時從伺服器「最愛」或「熱門」歌曲中隨機抽樣播放。

## 7. 未來擴充想法：支援播放清單 (Playlist Support)
讓使用者一次加入多首歌曲，常見於 YouTube 或 Spotify 清單導入。

- **YouTube 播放清單**：
  - **偵測**：檢查判斷 URL 是否包含 `&list=` 參數。
  - **技術實作**：使用 `yt-dlp --get-id --flat-playlist` 一次獲取清單內所有影片 ID，並在迴圈中逐一呼叫 `enqueue()`。
  - **使用者體驗**：需注意效能，若清單過長（如 100 首以上），建議增加批次處理提示，避免指令等待超時。
- **技術關鍵**：可使用 `spotify-url-info` 等套件。

## 8. 未來擴充想法：自動播放紀錄與資料庫 (Listening History & DB)
為了實現更聰明的點歌機，計畫引進輕量級資料庫（如 SQLite）。

- **技術優勢**：SQLite 是一個單一檔案資料庫，不需額外安裝資料庫伺服器，非常適合小型機器人且方便備份。
- **自動紀錄 (Auto-Recording)**：
  - **核心邏輯**：在 `GuildPlayer.js` 的 `playNext()` 成功啟動播放後，自動將該歌曲的 Metadata（網址、標題、點歌者、時間戳）寫入 `play_history` 資料表。
  - **好處**：使用者不需要手動「按喜歡」，機器人就能自動建立伺服器的專屬歌庫。
- **應用場景**：
  - **歷史指令**：新增 `/history` 查看最近播過的 10 首歌。
  - **智慧電台**：當播放清單為空時，從歷史紀錄中隨機抽取高頻率播放的歌曲進行「隨機播放 (Shuffle)」。
  - **數據統計**：統計伺服器內最受歡迎的歌曲或點歌王。

---

> **未來的接手建議**：如果發現 `/play <關鍵字>` 又時常找不到歌，可以考慮把關鍵字搜尋也改成套用 `yt-dlp "ytsearch1:關鍵字"`，或者引進 Lavalink 外部伺服器 (Phase 4 目標)。
