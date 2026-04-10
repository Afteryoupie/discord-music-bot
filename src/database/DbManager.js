/**
 * DbManager.js
 * 
 * Simple SQLite database manager for storing guild playback history.
 * Uses better-sqlite3 for performance and synchronous API.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'database.sqlite');
const db = new Database(DB_PATH);

// Initialize schema
function init() {
  console.log(`[Database] Initializing ${DB_PATH}...`);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS play_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      video_id TEXT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      duration TEXT,
      requested_by_id TEXT,
      requested_by_name TEXT,
      played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Index for performance onguild-specific lookups
  db.exec(`CREATE INDEX IF NOT EXISTS idx_guild ON play_history(guild_id);`);

  // Guild settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      playlist_limit INTEGER DEFAULT 50
    );
  `);
}

/**
 * Record a song to history.
 */
function recordHistory(guildId, song) {
  try {
    const insert = db.prepare(`
      INSERT INTO play_history (guild_id, video_id, title, url, duration, requested_by_id, requested_by_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Extract video ID from URL if possible
    let videoId = null;
    try {
      if (song.url.includes('v=')) {
        videoId = new URL(song.url).searchParams.get('v');
      } else if (song.url.includes('youtu.be/')) {
        videoId = song.url.split('youtu.be/')[1]?.split('?')[0];
      }
    } catch {}

    insert.run(
      guildId,
      videoId,
      song.title,
      song.url,
      song.duration || '?',
      song.requestedById || null,
      song.requestedByName || song.requestedBy || 'Unknown'
    );
    
    console.log(`[Database] Recorded history for guild ${guildId}: ${song.title}`);
  } catch (error) {
    console.error('[Database Error] recordHistory failed:', error.message);
  }
}

/**
 * Get recent history for a guild.
 */
function getHistory(guildId, limit = 20) {
  try {
    const query = db.prepare(`
      SELECT * FROM play_history 
      WHERE guild_id = ? 
      ORDER BY played_at DESC 
      LIMIT ?
    `);
    return query.all(guildId, limit);
  } catch (error) {
    console.error('[Database Error] getHistory failed:', error.message);
    return [];
  }
}

/**
 * Get a random song from guild history for Auto-play / Radio Mode fallback.
 */
function getRandomFromHistory(guildId) {
  try {
    const query = db.prepare(`
      SELECT * FROM play_history 
      WHERE guild_id = ? 
      ORDER BY RANDOM() 
      LIMIT 1
    `);
    return query.get(guildId);
  } catch (error) {
    return null;
  }
}

/**
 * Update guild playlist limit.
 */
function setPlaylistLimit(guildId, limit) {
  try {
    const stmt = db.prepare(`
      INSERT INTO guild_settings (guild_id, playlist_limit)
      VALUES (?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET playlist_limit = excluded.playlist_limit
    `);
    stmt.run(guildId, limit);
  } catch (error) {
    console.error('[Database Error] setPlaylistLimit failed:', error.message);
  }
}

/**
 * Get guild playlist limit.
 */
function getPlaylistLimit(guildId) {
  try {
    const stmt = db.prepare(`SELECT playlist_limit FROM guild_settings WHERE guild_id = ?`);
    const row = stmt.get(guildId);
    return row ? row.playlist_limit : 50;
  } catch (error) {
    console.error('[Database Error] getPlaylistLimit failed:', error.message);
    return 50;
  }
}

init();

module.exports = {
  recordHistory,
  getHistory,
  getRandomFromHistory,
  setPlaylistLimit,
  getPlaylistLimit
};
