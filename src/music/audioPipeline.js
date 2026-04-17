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
    '--no-warnings',
    '-f', 'bestaudio/best',
    '--no-playlist',
    '-o', '-',       // pipe to stdout
    videoUrl,
  ]);

  const ffmpeg = spawn(FFMPEG_PATH, [
    '-i', 'pipe:0',  // read from stdin
    '-c:a', 'libopus', // use libopus encoder (Discord native)
    '-b:a', '128k',    // 128kbps bitrate
    '-frame_duration', '20', // 20ms frame duration
    '-f', 'opus',      // Ogg Opus container output
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

  // Log yt-dlp progress and errors
  ytdlp.stderr.on('data', d => {
    const line = d.toString().trim();
    if (!line) return;
    // Log errors and critical information
    if (line.includes('ERROR') || line.includes('error')) {
      console.error(`[yt-dlp error] ${line}`);
    } else if (line.includes('[download]')) {
      // Optional: Log progress sparingly if needed
    }
  });

  // Suppress ffmpeg banner noise, only log real errors
  ffmpeg.stderr.on('data', d => {
    const line = d.toString().trim();
    if (!line) return;
    // FFmpeg is very talkative on stderr, only catch fatal errors
    if (line.includes('Error') || line.includes('error')) {
      // Ignore "Invalid data found when processing input" if it looks like a pipe issue
      if (line.includes('Invalid data found') && line.includes('pipe:0')) {
        console.error(`[ffmpeg] 入源資料無效 (通常是 yt-dlp 下載失敗)`);
      } else {
        console.error(`[ffmpeg] ${line}`);
      }
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
    const { spawn } = require('child_process');
    const args = [
      '--no-warnings',
      '--cache-dir', YTDLP_CACHE,
      '--print', '%(title)s|%(duration_string)s',
      videoUrl,
    ];
    
    const child = spawn(YTDLP_PATH, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => stdout += data.toString());
    child.stderr.on('data', data => stderr += data.toString());

    const timeout = setTimeout(() => {
      child.kill();
      console.error('[yt-dlp metadata timeout]');
      resolve(null);
    }, 15000);

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        if (stderr.trim()) console.error('[yt-dlp metadata error]', stderr.trim());
        return resolve(null);
      }
      const parts = stdout.trim().split('|');
      if (parts.length >= 2) {
        resolve({ title: parts[0], duration: parts[1] });
      } else {
        resolve({ title: parts[0] || 'Unknown', duration: '?' });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      console.error('[yt-dlp metadata spawn error]', err.message);
      resolve(null);
    });
  });
}

module.exports = { isYouTubeURL, createAudioPipeline, getVideoMetadata };
