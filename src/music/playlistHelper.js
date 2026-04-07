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
    // --flat-playlist: only list titles/IDs, don't fetch full metadata
    // --print: format output
    const cmd = `"${YTDLP_PATH}" --no-warnings --cache-dir "${YTDLP_CACHE}" --flat-playlist --print "%(title)s|%(id)s" "${playlistUrl}"`;
    
    console.log(`[Playlist] Extracting: ${playlistUrl}`);
    
    exec(cmd, { timeout: 30000 }, (error, stdout) => {
      if (error) {
        console.error('[Playlist Error]', error.message);
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
