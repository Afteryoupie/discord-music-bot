/**
 * playlistHelper.js
 * 
 * Extracts video URLs and titles from a YouTube playlist URL.
 * Uses yt-dlp --flat-playlist for fast extraction without downloading metadata for every video.
 */

const { exec } = require('child_process');
const path = require('path');

const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp';
const YTDLP_CACHE = path.join(__dirname, '..', '..', '.ytdlp-cache');

/**
 * Fetch all items in a playlist.
 * @param {string} playlistUrl 
 * @returns {Promise<Array<{title: string, url: string}>>}
 */
function fetchPlaylist(playlistUrl) {
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    const args = [
      '--no-warnings',
      '--cache-dir', YTDLP_CACHE,
      '--flat-playlist',
      '--print', '%(title)s|%(id)s',
      playlistUrl,
    ];
    
    console.log(`[Playlist] Extracting: ${playlistUrl}`);
    
    const child = spawn(YTDLP_PATH, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => stdout += data.toString());
    child.stderr.on('data', data => stderr += data.toString());

    const timeout = setTimeout(() => {
      child.kill();
      console.error('[Playlist timeout]');
      resolve([]);
    }, 60000); // Playlists can be large, 60s timeout

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        if (stderr.trim()) console.error('[Playlist Error]', stderr.trim());
        return resolve([]);
      }

      const lines = stdout.trim().split('\n');
      const songs = lines
        .map(line => {
          const parts = line.split('|');
          if (parts.length >= 2) {
            return {
              title: parts[0],
              url: `https://www.youtube.com/watch?v=${parts[1]}`
            };
          }
          return null;
        })
        .filter(Boolean);

      console.log(`[Playlist] Found ${songs.length} songs`);
      resolve(songs);
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      console.error('[Playlist spawn error]', err.message);
      resolve([]);
    });
  });
}

/**
 * Check if a URL is a YouTube playlist.
 */
function isPlaylist(url) {
  return url.includes('list=') && !url.includes('index=');
}

module.exports = {
  fetchPlaylist,
  isPlaylist
};
