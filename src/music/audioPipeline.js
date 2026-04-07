/**
 * audioPipeline.js
 *
 * yt-dlp + ffmpeg audio pipeline (extracted from play.js).
 * Provides a PCM audio stream for Discord voice playback.
 */

const { spawn } = require('child_process');
const path = require('path');

// Resolve binary paths: env var → fallback to bare command (relies on PATH)
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp';
// Writable cache dir inside the project
const YTDLP_CACHE = path.join(__dirname, '..', '..', '.ytdlp-cache');

/**
 * Check if a string looks like a YouTube URL.
 */
function isYouTubeURL(str) {
  try {
    const url = new URL(str);
    return url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be');
  } catch {
    return false;
  }
}

/**
 * Create a piped audio stream: yt-dlp stdout → ffmpeg stdin → ffmpeg stdout (PCM s16le)
 *
 * Returns an object: { stream, cleanup }
 *   - stream: readable PCM audio stream (ffmpeg stdout)
 *   - cleanup(): kills both child processes
 */
function createAudioPipeline(videoUrl) {
  const ytdlp = spawn(YTDLP_PATH, [
    '--cache-dir', YTDLP_CACHE,
    '-f', 'bestaudio/best',
    '--no-playlist',
    '-o', '-',       // pipe to stdout
    videoUrl,
  ]);

  const ffmpeg = spawn(FFMPEG_PATH, [
    '-i', 'pipe:0',  // read from stdin
    '-f', 's16le',   // PCM signed 16-bit little-endian
    '-ar', '48000',  // 48kHz sample rate (Discord standard)
    '-ac', '2',      // stereo
    'pipe:1',        // output to stdout
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  // Swallow errors on all pipe streams to prevent EPIPE crashes
  // when cleanup kills processes mid-stream
  const noop = () => {};
  ytdlp.stdout.on('error', noop);
  ffmpeg.stdin.on('error', noop);
  ffmpeg.stdout.on('error', noop);

  // Pipe yt-dlp output into ffmpeg
  ytdlp.stdout.pipe(ffmpeg.stdin);

  // Log yt-dlp progress (keep minimal)
  ytdlp.stderr.on('data', d => {
    const line = d.toString().trim();
    if (line.includes('[download]') || line.includes('ERROR')) {
      process.stdout.write(`[yt-dlp] ${line}\n`);
    }
  });

  // Suppress ffmpeg banner noise, only log errors
  ffmpeg.stderr.on('data', d => {
    const line = d.toString().trim();
    if (line.includes('Error') || line.includes('error')) {
      console.error(`[ffmpeg] ${line}`);
    }
  });

  ytdlp.on('error', err => console.error('[yt-dlp spawn error]', err.message));
  ffmpeg.on('error', err => console.error('[ffmpeg spawn error]', err.message));

  // Cleanup function: unpipe first, then kill both processes
  function cleanup() {
    try { ytdlp.stdout.unpipe(ffmpeg.stdin); } catch {}
    try { ffmpeg.stdin.destroy(); } catch {}
    try { ytdlp.kill('SIGKILL'); } catch {}
    try { ffmpeg.kill('SIGKILL'); } catch {}
  }

  return { stream: ffmpeg.stdout, cleanup };
}

/**
 * Fetch video title and duration using yt-dlp to bypass 429 rate limits.
 * @param {string} videoUrl
 * @returns {Promise<{title: string, duration: string} | null>}
 */
function getVideoMetadata(videoUrl) {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    const cmd = `"${YTDLP_PATH}" --no-warnings --cache-dir "${YTDLP_CACHE}" --print "%(title)s|%(duration_string)s" "${videoUrl}"`;
    exec(cmd, { timeout: 15000 }, (error, stdout) => {
      if (error) {
        console.error('[yt-dlp metadata error]', error.message);
        return resolve(null);
      }
      const parts = stdout.trim().split('|');
      if (parts.length >= 2) {
        resolve({ title: parts[0], duration: parts[1] });
      } else {
        resolve({ title: parts[0] || 'Unknown', duration: '?' });
      }
    });
  });
}

module.exports = { isYouTubeURL, createAudioPipeline, getVideoMetadata };
