#!/bin/bash

# TARS Music Bot - Toggle Start/Stop
# Double-click this file in Finder to start or stop the bot

BOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$BOT_DIR/.bot.pid"
NODE="$BOT_DIR/node/bin/node"
LOG_FILE="$BOT_DIR/bot.log"

# Check if node binary exists, fallback to system node
if [ ! -f "$NODE" ]; then
  NODE="node"
fi

# ── Check if bot is currently running ──────────────────────────
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    # Bot is running → stop it
    echo "⏹  Stopping TARS Music Bot (PID: $PID)..."
    kill "$PID"
    rm -f "$PID_FILE"
    echo "✅ Bot stopped."
    echo ""
    echo "Press any key to close this window..."
    read -n 1
    exit 0
  else
    # PID file exists but process is dead → clean up
    rm -f "$PID_FILE"
  fi
fi

# ── Bot is not running → start it ──────────────────────────────
echo "🎵 Starting TARS Music Bot..."
echo "📁 Directory: $BOT_DIR"
echo "📋 Logs: $LOG_FILE"
echo ""
echo "Press Ctrl+C to stop the bot"
echo "─────────────────────────────────────"

cd "$BOT_DIR"
"$NODE" src/index.js &
BOT_PID=$!
echo $BOT_PID > "$PID_FILE"

echo "✅ Bot started! (PID: $BOT_PID)"
echo ""

# Follow the log output (show bot activity live)
wait $BOT_PID
rm -f "$PID_FILE"
echo ""
echo "Bot has stopped."
echo "Press any key to close this window..."
read -n 1
