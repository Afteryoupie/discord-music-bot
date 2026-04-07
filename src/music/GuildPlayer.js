/**
 * GuildPlayer.js
 *
 * Per-guild music playback state manager.
 * Manages queue, audio player, voice connection, and auto-play logic.
 */

const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const { createAudioPipeline } = require('./audioPipeline');
const db = require('../database/DbManager');

// How long (ms) to wait after queue empties before auto-disconnecting
const IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

class GuildPlayer {
  /**
   * @param {string} guildId
   */
  constructor(guildId) {
    this.guildId = guildId;

    /** @type {Array<{title: string, url: string, duration: string, requestedBy: string}>} */
    this.queue = [];

    /** @type {{title: string, url: string, duration: string, requestedBy: string} | null} */
    this.nowPlaying = null;

    /** @type {import('@discordjs/voice').VoiceConnection | null} */
    this.connection = null;

    /** @type {import('@discordjs/voice').AudioPlayer | null} */
    this.player = null;

    /** @type {import('discord.js').TextBasedChannel | null} */
    this.textChannel = null;

    /** @type {Function | null} Pipeline cleanup for currently playing song */
    this._pipelineCleanup = null;

    /** @type {NodeJS.Timeout | null} */
    this._idleTimer = null;

    /** @type {boolean} Radio mode: auto-plays from history when queue is empty */
    this.isRadioMode = false;

    /** @type {string | null} Last played video ID for recommendations */
    this.lastPlayedId = null;

    this._setupPlayer();
  }

  // ─── Internal Setup ───────────────────────────────────────────

  _setupPlayer() {
    this.player = createAudioPlayer();

    // When a song finishes → play next or start idle timer
    this.player.on(AudioPlayerStatus.Idle, () => {
      console.log(`[${this.guildId}] Player idle`);
      this._cleanupPipeline();
      this.nowPlaying = null;

      if (this.queue.length > 0) {
        this.playNext();
      } else {
        this._startIdleTimer();
      }
    });

    // On player error → log, notify, skip to next
    this.player.on('error', error => {
      console.error(`[${this.guildId}] Player error:`, error.message);
      this._cleanupPipeline();
      const failedSong = this.nowPlaying?.title || 'Unknown';
      this.nowPlaying = null;

      // Notify text channel
      if (this.textChannel) {
        this.textChannel.send(`❌ 播放錯誤：**${failedSong}**，自動跳到下一首...`).catch(() => {});
      }

      // Auto-skip to next song
      if (this.queue.length > 0) {
        this.playNext();
      } else {
        this._startIdleTimer();
      }
    });

    // Log state changes
    this.player.on('stateChange', (oldState, newState) => {
      if (oldState.status !== newState.status) {
        console.log(`[${this.guildId}] Player: ${oldState.status} → ${newState.status}`);
      }
    });
  }

  // ─── Public API ───────────────────────────────────────────────

  /**
   * Set the voice connection (call when joining a voice channel).
   * @param {import('@discordjs/voice').VoiceConnection} connection
   */
  setConnection(connection) {
    this.connection = connection;
    this.connection.subscribe(this.player);

    // Handle unexpected disconnects
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.log(`[${this.guildId}] Voice disconnected, attempting reconnect...`);
      try {
        // Try to reconnect within 5 seconds
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        // Reconnecting — wait for Ready state
      } catch {
        // Could not reconnect — destroy
        console.log(`[${this.guildId}] Could not reconnect, destroying.`);
        this.destroy();
      }
    });

    this.connection.on(VoiceConnectionStatus.Destroyed, () => {
      console.log(`[${this.guildId}] Voice connection destroyed.`);
      this._reset();
    });
  }

  /**
   * Add a song to the queue. If nothing is playing, start playback immediately.
   * @param {{title: string, url: string, duration: string, requestedBy: string}} song
   * @returns {'playing' | 'queued'} Whether playback started or the song was queued.
   */
  enqueue(song) {
    this._clearIdleTimer();

    if (this.nowPlaying === null && this.player.state.status === AudioPlayerStatus.Idle) {
      // Nothing playing → play immediately
      this.queue.push(song);
      this.playNext();
      return 'playing';
    } else {
      // Something is playing → add to queue
      this.queue.push(song);
      return 'queued';
    }
  }

  /**
   * Play the next song from the queue.
   */
  playNext() {
    this._clearIdleTimer();
    this._cleanupPipeline();

    if (this.queue.length === 0) {
      if (this.isRadioMode) {
        this._startRadio();
        return;
      }
      this.nowPlaying = null;
      this._startIdleTimer();
      return;
    }

    const song = this.queue.shift();
    this.nowPlaying = song;

    // Track video ID for history and recommendations
    try {
      if (song.url.includes('v=')) {
        this.lastPlayedId = new URL(song.url).searchParams.get('v');
      } else if (song.url.includes('youtu.be/')) {
        this.lastPlayedId = song.url.split('youtu.be/')[1]?.split('?')[0];
      }
    } catch {}

    console.log(`[${this.guildId}] Playing: ${song.title} (${song.url})`);

    try {
      // Record to history
      db.recordHistory(this.guildId, song);

      const { stream, cleanup } = createAudioPipeline(song.url);
      this._pipelineCleanup = cleanup;

      const resource = createAudioResource(stream, {
        inputType: StreamType.OggOpus,
        inlineVolume: false,
      });

      this.player.play(resource);

      // Notify text channel
      if (this.textChannel) {
        const queueInfo = this.queue.length > 0
          ? `\n📋 播放清單中還有 **${this.queue.length}** 首`
          : '';
        this.textChannel.send(
          `🎵 正在播放：**${song.title}** (${song.duration})\n` +
          `👤 點歌者：${song.requestedBy}${queueInfo}`
        ).catch(() => {});
      }
    } catch (error) {
      console.error(`[${this.guildId}] Failed to start pipeline:`, error.message);
      this.nowPlaying = null;

      if (this.textChannel) {
        this.textChannel.send(`❌ 無法播放 **${song.title}**：${error.message}`).catch(() => {});
      }

      // Try next song
      if (this.queue.length > 0) {
        this.playNext();
      } else {
        this._startIdleTimer();
      }
    }
  }

  /**
   * Skip the current song. Returns the skipped song info.
   * @returns {{title: string, url: string, duration: string, requestedBy: string} | null}
   */
  skip() {
    const skipped = this.nowPlaying;
    // Stopping the player triggers the Idle event → auto-plays next
    if (this.player && this.player.state.status !== AudioPlayerStatus.Idle) {
      this.player.stop();
    }
    return skipped;
  }

  /**
   * Pause playback.
   * @returns {boolean} true if paused, false if already paused or not playing.
   */
  pause() {
    if (this.player && this.player.state.status === AudioPlayerStatus.Playing) {
      this.player.pause();
      return true;
    }
    return false;
  }

  /**
   * Resume playback.
   * @returns {boolean} true if resumed, false if not paused.
   */
  resume() {
    if (this.player && this.player.state.status === AudioPlayerStatus.Paused) {
      this.player.unpause();
      return true;
    }
    return false;
  }

  /**
   * @returns {boolean} Whether something is currently playing or paused.
   */
  isPlaying() {
    return this.player && (
      this.player.state.status === AudioPlayerStatus.Playing ||
      this.player.state.status === AudioPlayerStatus.Paused
    );
  }

  /**
   * @returns {boolean} Whether the player is paused.
   */
  isPaused() {
    return this.player && this.player.state.status === AudioPlayerStatus.Paused;
  }

  /**
   * Destroy the player and disconnect from voice. Cleans up all state.
   */
  destroy() {
    this._clearIdleTimer();
    this._cleanupPipeline();

    if (this.player) {
      this.player.stop(true);
    }

    if (this.connection) {
      try { this.connection.destroy(); } catch {}
    }

    this._reset();
  }

  // ─── Internal Helpers ─────────────────────────────────────────

  _reset() {
    this.queue = [];
    this.nowPlaying = null;
    this.connection = null;
    this.textChannel = null;
    this._pipelineCleanup = null;
    this._clearIdleTimer();
  }

  _cleanupPipeline() {
    if (this._pipelineCleanup) {
      this._pipelineCleanup();
      this._pipelineCleanup = null;
    }
  }

  _startIdleTimer() {
    this._clearIdleTimer();
    this._idleTimer = setTimeout(() => {
      console.log(`[${this.guildId}] Idle timeout — auto-disconnecting.`);
      if (this.textChannel) {
        this.textChannel.send('👋 已經 3 分鐘沒有新歌了，自動離開語音頻道！').catch(() => {});
      }
      this.destroy();
      guildPlayers.delete(this.guildId);
    }, IDLE_TIMEOUT_MS);
  }

  _clearIdleTimer() {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
  }

  /**
   * Radio Mode implementation: Picks a random song from history to play.
   * Can be improved with actual YouTube recommendations later.
   */
  _startRadio() {
    const historicalSong = db.getRandomFromHistory(this.guildId);
    
    if (historicalSong) {
      if (this.textChannel) {
        this.textChannel.send('📻 清單空了，**智慧電台**啟動！播一首這台的人都愛聽的歌曲...').catch(() => {});
      }
      
      const songToPlay = {
        title: historicalSong.title,
        url: historicalSong.url,
        duration: historicalSong.duration,
        requestedById: 'radio',
        requestedByName: '智慧電台'
      };
      
      this.queue.push(songToPlay);
      this.playNext();
    } else {
      // No history yet
      this.nowPlaying = null;
      this._startIdleTimer();
    }
  }
}

// ─── Global Guild Player Registry ─────────────────────────────

/** @type {Map<string, GuildPlayer>} */
const guildPlayers = new Map();

/**
 * Get or create a GuildPlayer for a given guild.
 * @param {string} guildId
 * @returns {GuildPlayer}
 */
function getOrCreate(guildId) {
  if (!guildPlayers.has(guildId)) {
    guildPlayers.set(guildId, new GuildPlayer(guildId));
  }
  return guildPlayers.get(guildId);
}

module.exports = { GuildPlayer, getOrCreate, guildPlayers };
