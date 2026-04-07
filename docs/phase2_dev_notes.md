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

## 6. YouTube 播放清單支援 (Playlist Support)
為了支援一次加入多首歌曲，我們對 `audioPipeline` 和 `GuildPlayer` 進行了擴充：
- **高效 Metadata 抓取**：利用 `yt-dlp --flat-playlist --dump-single-json`。這可以在不解析每一部影片詳細資訊的情況下，快速列出清單中所有歌曲的標題與網址。
- **批量處理效能**：在 `GuildPlayer` 中新增了 `enqueueMany(songs)` 方法。這能一次性將歌曲陣列 `push` 到 `queue` 中，並只在必要時觸發播放，避免了連續呼叫單一 `enqueue` 造成的效能損耗。
- **防止過度加載**：目前程式碼預設限制單一清單最多載入 50 首歌，以確保伺服器穩定性。

## 7. 未來擴充想法：電台功能 (Radio Mode)
為了提升使用者體驗，未來可以考慮加入以下幾種電台實作：

- **YouTube 自動續播 (Auto-play Radio)**：
  - **核心邏輯**：當 `queue` 空了，根據最後一首歌的 `videoId` 透過 API 抓取推薦歌曲（Related Videos）。
  - **技術關鍵**：在 `GuildPlayer` 內新增 `isRadioMode` 開關，並在 `playNext()` 結尾觸發推薦抓取。
- **網路串流電台 (Internet Radio)**：
  - **核心邏輯**：支援 `.m3u8` 或 `.pls` 的串流連結，或是 YouTube 長時間直播。
  - **技術關鍵**：檢測 `yt-dlp` 的 `is_live` 屬性，並對直播串流關閉自動下一首邏輯。

---

> **未來的接手建議**：如果發現 `/play <關鍵字>` 又時常找不到歌，可以考慮把關鍵字搜尋也改成套用 `yt-dlp "ytsearch1:關鍵字"`，或者引進 Lavalink 外部伺服器 (Phase 4 目標)。
