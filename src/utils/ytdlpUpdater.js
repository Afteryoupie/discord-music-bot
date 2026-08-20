const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Check and auto-update yt-dlp on bot startup.
 * Non-blocking, fails gracefully if permissions or package managers restrict self-update.
 */
function autoUpdateYtDlp() {
  const localYtdlp = path.join(__dirname, '..', '..', 'yt-dlp');
  const bin = process.env.YTDLP_PATH || (fs.existsSync(localYtdlp) ? localYtdlp : 'yt-dlp');

  // Check current version
  exec(`"${bin}" --version`, (verErr, verStdout) => {
    const currentVer = verStdout ? verStdout.trim() : 'unknown';
    console.log(`[yt-dlp] 當前版本: ${currentVer}`);

    // Attempt self-update in background
    exec(`"${bin}" -U`, (updateErr, updateStdout, updateStderr) => {
      if (updateErr) {
        return;
      }
      const output = (updateStdout || updateStderr || '').trim();
      if (output && !output.includes('is up to date')) {
        console.log(`[yt-dlp auto-update] ${output}`);
      }
    });
  });
}

module.exports = { autoUpdateYtDlp };
