const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const BOT_DIR = path.join(__dirname, '..', '..');

// ── 1. yt-dlp: needs frequent updates (YouTube modifies extraction logic frequently) ──

/**
 * Check and auto-update yt-dlp on bot startup.
 * Non-blocking, fails gracefully if permissions or package managers restrict self-update.
 */
function autoUpdateYtDlp() {
  const localYtdlp = path.join(BOT_DIR, 'yt-dlp');
  const bin = process.env.YTDLP_PATH || (fs.existsSync(localYtdlp) ? localYtdlp : 'yt-dlp');

  execFile(bin, ['--version'], (verErr, verStdout) => {
    const currentVer = verStdout ? verStdout.trim() : 'unknown';
    console.log(`[yt-dlp] 當前版本: ${currentVer}`);

    execFile(bin, ['-U'], (updateErr, updateStdout, updateStderr) => {
      if (updateErr) return;
      const output = (updateStdout || updateStderr || '').trim();
      if (output && !output.includes('is up to date')) {
        console.log(`[yt-dlp auto-update] ${output}`);
      }
    });
  });
}

// ── 2. Safe npm packages to auto-update within semver ──
//
// ✅ yt-search      — YouTube search parser, updates frequently to adapt to YouTube changes
// ✅ dotenv         — .env loader, very stable API
// ✅ better-sqlite3 — SQLite C binding, stable API & security patches
const SAFE_NPM_PACKAGES = ['yt-search', 'dotenv', 'better-sqlite3'];

/**
 * Run `npm update` for the safe package list in the background.
 * Non-blocking operation so bot startup is not delayed.
 */
function autoUpdateNpmPackages() {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = ['update', ...SAFE_NPM_PACKAGES, '--prefix', BOT_DIR];

  console.log(`[npm auto-update] 檢查安全套件更新: ${SAFE_NPM_PACKAGES.join(', ')}...`);

  execFile(npmCmd, args, { cwd: BOT_DIR }, (err, stdout, stderr) => {
    if (err) {
      // Quietly log if offline or npm fails; does not affect bot operation
      return;
    }
    const out = (stdout || stderr || '').trim();
    if (out) {
      console.log(`[npm auto-update] ${out}`);
    } else {
      console.log('[npm auto-update] ✅ 安全名單套件皆已是最新版');
    }
  });
}

/**
 * Run all startup updates (yt-dlp + safe npm dependencies).
 */
function runStartupUpdates() {
  autoUpdateYtDlp();
  autoUpdateNpmPackages();
}

module.exports = {
  runStartupUpdates,
  autoUpdateYtDlp,
  autoUpdateNpmPackages,
  SAFE_NPM_PACKAGES,
};
