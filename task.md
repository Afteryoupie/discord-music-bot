# Music Bot — Ponytail 審查待辦事項

> 來源：`/ponytail check` 審查結果（2026-08-21）

---

## 🔴 Bug（優先處理）

- `[ ]` **`guildPlayers.delete` 移出類別方法**
  - 問題：`_startIdleTimer` L410 和 `startEmptyChannelTimer` L434 在 `GuildPlayer` 實例方法內直接呼叫 `guildPlayers.delete(this.guildId)`，屬於自刪耦合
  - 修法：在呼叫 `destroy()` 的地方（`index.js` 的 idle timeout callback 等）執行 `guildPlayers.delete()`，類別本身不持有 registry 引用
  - 檔案：[GuildPlayer.js L402-L435](file:///Users/linjiade/.gemini/antigravity/scratch/music-bot/src/music/GuildPlayer.js#L402-L435)

---

## 🟡 清理（依序處理）

- `[ ]` **移除未使用的依賴**
  - `npm uninstall play-dl spotify-url-info`
  - 檔案：[package.json L26-27](file:///Users/linjiade/.gemini/antigravity/scratch/music-bot/package.json#L26-27)

- `[ ]` **刪除 `getVideoMetadata` 內部重複的 `require('child_process')`**
  - `spawn` 在 L8 已 import，L113 的內部 require 多餘
  - 檔案：[audioPipeline.js L113](file:///Users/linjiade/.gemini/antigravity/scratch/music-bot/src/music/audioPipeline.js#L113)

- `[ ]` **合併重複的 `extractVideoId` 邏輯**
  - `audioPipeline.js` 的 `isYouTubeURL` 和 `embedGenerator.js` 的 `extractVideoId` 都在解析 YouTube URL
  - 修法：從 `audioPipeline.js` export `extractVideoId`，`embedGenerator.js` 改為 import 使用
  - 檔案：[audioPipeline.js L20-27](file:///Users/linjiade/.gemini/antigravity/scratch/music-bot/src/music/audioPipeline.js#L20-27)、[embedGenerator.js L13-19](file:///Users/linjiade/.gemini/antigravity/scratch/music-bot/src/utils/embedGenerator.js#L13-19)

- `[ ]` **刪除 WS prototype monkey-patch**
  - 這是舊的診斷程式碼，patch 了全域 `ws.prototype.on`，影響所有內部連線
  - 如不再需要診斷斷線 code → 直接刪掉
  - 如仍需要 → 改用 Discord client 的 `shardDisconnect` 事件
  - 檔案：[index.js L16-27](file:///Users/linjiade/.gemini/antigravity/scratch/music-bot/src/index.js#L16-27)
