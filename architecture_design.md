# Discord 音樂機器人長期開發架構設計

為了讓機器人具備高擴充性、容易除錯，且能夠支援未來的多人或多伺服器使用，建議將開發拆分成 **四個階段 (Phases)**。這種漸進式的架構設計可以確保我們每一步都有可獨立運作的產出。

## 整體系統架構圖 (最終目標)

```mermaid
graph TD
    User([使用者 User]) -->|輸入 /play| DiscordAPI(Discord API)
    DiscordAPI --> CommandHandler[Command Handler 指令解析]
    
    CommandHandler --> QueueManager[Queue Manager 播放清單管理]
    CommandHandler --> VoiceManager[Voice Manager 語音連接管理]
    
    QueueManager <--> DB[(Database 關聯資料庫)\n- 用戶設定\n- 歷史歌單]
    
    QueueManager --> YouTubeSearch[yt-dlp / YouTube API\n(解析網址/搜尋)]
    YouTubeSearch --> AudioStream[音訊串流獲取]
    
    AudioStream --> FFmpeg[FFmpeg 轉碼器\n(套用音效 filters)]
    VoiceManager --> FFmpeg
    
    FFmpeg -->|Opus 音訊| DiscordVoice(Discord 語音伺服器)
    DiscordVoice --> User
```

---

## Phase 1: 最小可行性產品 (MVP) - 「能發出聲音」
此階段的目標是**打通最核心的技術流程**。暫時不考慮複雜的待播清單或錯誤處理，只要能讓機器人進來頻道並播放一首歌即可。

### 📌 目標功能
- [ ] 基礎機器人連線與指令註冊。
- [ ] `/play <網址>` 指令。
- [ ] `/leave` (強制機器人離開頻道) 指令。

### 🛠️ 架構與設計
- **專案結構**：所有程式碼暫時寫在單一或兩個檔案中（例如 `main.py` 或 `index.js`），快速驗證。
- **功能模組**：
  1. 監聽指令。
  2. 檢查使用者是否有在語音頻道內。
  3. 呼叫 `yt-dlp` 下載音訊格式串流。
  4. 使用 `FFmpeg` 管道播放。
- **狀態管理**：無。一首歌播完就結束，再點一首會直接取代目前的歌。

---

## Phase 2: 核心播放體驗 - 「能當點歌機」
當我們可以穩定播放音樂後，接下來需要實作**狀態管理 (State Management)**，這是最容易出 Bug 的地方。

### 📌 目標功能
- [ ] 完整的播放清單 (Queue) 系統：支援陣列暫存。
- [ ] 基礎指令擴充：`/skip`, `/pause`, `/resume`, `/queue` (查看當前清單), `/nowplaying`。
- [ ] 支援從 YouTube「關鍵字」搜尋，不限於網址。
- [ ] 歌單自動輪播：一首結束後自動觸發下一首的事件 (Event Listener)。

### 🛠️ 架構與設計
- **模組化 (Modularization)**：引進「Cogs (Python)」或「Command Handlers (Node.js)」來將指令分檔管理。
- **狀態管理器 (Guild State)**：
  - 由於機器人可能同時被加入多個伺服器 (Guild)，你需要使用一個 `Dictionary` 或 `Map` 來儲存**每個伺服器各自的播放狀態**。
  - 資料結構設計概念：
    ```json
    GuildStates = {
      "伺服器A_ID": {
        "queue": [ song1, song2, song3 ],
        "now_playing": song1,
        "is_paused": false,
        "voice_channel": "頻道_ID",
        "loop_mode": "off"
      }
    }
    ```
- **錯誤處理**：如果 YouTube 連結失效、或串流中斷，要有容錯機制自動跳下一首，並防範機器人崩潰。

---

## Phase 3: 持久化與使用者體驗 - 「能記住你」
將機器人提升至專業水準，開始引入資料庫與更佳的視覺互動。

### 📌 目標功能
- [ ] **嵌入式訊息 UI (Embeds)**：使用美觀的卡片顯示正在播放的歌曲封面、時長 (進度條) 以及點歌者。
- [ ] **權限系統 (DJ 系統)**：只有擁有 `DJ` 身份組或點歌者本人可以切歌 (`/skip`)。
- [ ] **資料庫整合**：
  - 引進 SQLite 或 PostgreSQL。
  - 功能：個人收藏歌單 (`/favorite`)、伺服器預設音量、統計誰點了最多歌。
- [ ] **多平台支援 (選配)**：若輸入 Spotify 或 Apple Music 連結，自動在後台轉換成搜尋 YouTube 音源並播放。

### 🛠️ 架構與設計
- **資料庫層 (ORM)**：使用 Prisma (Node.js) 或 SQLAlchemy (Python) 處理資料庫讀寫。
- **事件驅動架構**：切割「指令層」與「音樂播放層」。當發現狀態改變時（例如換歌），發送事件更新 Discord 聊天室的面板。

---

## Phase 4: 進階功能與大規模擴充 - 「能對外發布」
如果你打算讓機器人給成千上萬個伺服器使用，就必須考慮這個階段。

### 📌 目標功能
- [ ] **音效濾波器 (Filters)**：`/bassboost` (低音增強), `/nightcore` (加速變聲), `/8d` (環繞音效)。
- [ ] **分片機制 (Sharding)**：當機器人加入超過 2000 個伺服器時，Discord 強制要求進行分片（將計算分散到不同程序）。
- [ ] **網頁儀表板 (Web Dashboard)**：架設一個網站，讓使用者登入後可以視覺化地拖曳調整播放清單。

### 🛠️ 架構與設計
- **Lavalink (強烈建議)**：
  - 到這個階段，單機處理 `yt-dlp` 和 `FFmpeg` 會消耗極巨量的 CPU。
  - **Lavalink** 是一個獨立的 Java 語音節點伺服器。你可以將「尋找歌曲與音訊推流」的工作全部丟給 Lavalink 處理，你的機器人只負責收發 Discord 訊息。這會大幅降低主機壓力。
- **微服務架構**：將資料庫、Discord Bot 核心、Web API 切割成獨立的 Docker 容器。

---

## 🚀 給你的第一步建議

要開始這段開發旅程，我們應該專注在 **Phase 1**。
你可以先建立一個資料夾，並且開始初始化專案。

**下一步你可以告訴我：**
「我想用 (Python 或 Node.js) 開始 Phase 1，請幫我產生基礎的專案結構與指令！」
