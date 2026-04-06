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

cd "$BOT_DIR"
"$NODE" src/index.js &
BOT_PID=$!
echo $BOT_PID > "$PID_FILE"

echo "✅ Bot online! (PID: $BOT_PID)"
echo ""

# Wait for bot process (keeps window open)
wait $BOT_PID
