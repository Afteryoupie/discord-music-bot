#!/bin/bash

# TARS Music Bot - Toggle Start/Stop
# Double-click this file in Finder to start or stop the bot
# Closing this window will also stop the bot

BOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$BOT_DIR/.bot.pid"
NODE="$BOT_DIR/node/bin/node"

# Fallback to system node if local binary not found
if [ ! -f "$NODE" ]; then
  NODE="node"
fi

# ── Cleanup function: stop bot and remove PID file ─────────────
cleanup() {
  if [ -n "$BOT_PID" ] && kill -0 "$BOT_PID" 2>/dev/null; then
    echo ""
    echo "⏹  Stopping TARS Music Bot..."
    kill "$BOT_PID"
    wait "$BOT_PID" 2>/dev/null
  fi
  rm -f "$PID_FILE"
  echo "✅ Bot stopped."
}

# Catch: window close, kill signal
trap cleanup TERM HUP EXIT

# ── Check if bot is already running ────────────────────────────
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "⏹  TARS Bot is running (PID: $PID). Stopping..."
    kill "$PID"
    rm -f "$PID_FILE"
    echo "✅ Bot stopped."
    echo ""
    echo "Press any key to close..."
    read -n 1
    trap - EXIT  # disable cleanup on exit since we already stopped
    exit 0
  else
    rm -f "$PID_FILE"
  fi
fi

# ── Start the bot ───────────────────────────────────────────────
echo "🎵 Starting TARS Music Bot..."
echo "📁 $BOT_DIR"
echo ""
echo "  • Close this window to stop the bot"
echo "─────────────────────────────────────"
echo ""

# ── Auto-update yt-dlp ─────────────────────────────────────────
echo "🔄 檢查 yt-dlp 更新..."
YTDLP_BIN="yt-dlp"
if [ -f "$BOT_DIR/yt-dlp" ]; then
  YTDLP_BIN="$BOT_DIR/yt-dlp"
fi

if command -v "$YTDLP_BIN" &>/dev/null || [ -f "$YTDLP_BIN" ]; then
  "$YTDLP_BIN" -U 2>/dev/null || true
  YTDLP_VER=$("$YTDLP_BIN" --version 2>/dev/null || echo "未知")
  echo "📦 yt-dlp 當前版本: $YTDLP_VER"
else
  echo "⚠️ 未找到 yt-dlp，請確認已安裝。"
fi
echo ""

# ── Auto-update Safe NPM Packages ──────────────────────────────
echo "🔄 檢查安全套件更新 (yt-search, dotenv, better-sqlite3)..."
npm update yt-search dotenv better-sqlite3 --prefix "$BOT_DIR" --silent 2>/dev/null || true
echo ""

cd "$BOT_DIR"
"$NODE" src/index.js &
BOT_PID=$!
echo $BOT_PID > "$PID_FILE"

echo "✅ Bot online! (PID: $BOT_PID)"
echo ""

# Wait for bot process (keeps window open)
wait $BOT_PID
