const { SlashCommandBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const yts = require('yt-search');
const path = require('path');

const FFMPEG_PATH = '/opt/homebrew/bin/ffmpeg';
const YTDLP_PATH = '/opt/homebrew/bin/yt-dlp';
// Use a writable cache dir inside the project
const YTDLP_CACHE = path.join(__dirname, '..', '..', '.ytdlp-cache');

// Check if string looks like a YouTube URL
function isYouTubeURL(str) {
  try {
    const url = new URL(str);
    return url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be');
  } catch {
    return false;
  }
}

// Get piped audio stream: yt-dlp stdout -> ffmpeg stdin -> ffmpeg stdout (PCM)
function createAudioPipeline(videoUrl) {
  const ytdlp = spawn(YTDLP_PATH, [
    '--cache-dir', YTDLP_CACHE,
    '-f', 'bestaudio[ext=webm]/bestaudio',
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

  // Pipe yt-dlp output into ffmpeg
  ytdlp.stdout.pipe(ffmpeg.stdin);

  // Log yt-dlp progress
  ytdlp.stderr.on('data', d => process.stdout.write(`[yt-dlp] ${d}`));

  // On ffmpeg error, destroy ytdlp too
  ytdlp.on('error', err => console.error('[yt-dlp error]', err));
  ffmpeg.on('error', err => console.error('[ffmpeg error]', err));

  return ffmpeg.stdout; // This is the playable PCM stream
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play YouTube music')
    .addStringOption(option =>
      option
        .setName('song')
        .setDescription('YouTube URL or search keywords')
        .setRequired(true)
    ),

  async execute(interaction) {
    // 1. Check voice channel
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: 'You need to join a voice channel first!', ephemeral: true });
    }

    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
      return interaction.reply({ content: 'I do not have permission to join or speak in that channel!', ephemeral: true });
    }

    const query = interaction.options.getString('song');
    await interaction.deferReply();

    try {
      // 2. Resolve URL or search
      let videoUrl;
      let videoTitle = 'Unknown';
      let videoDuration = '?';

      if (isYouTubeURL(query)) {
        videoUrl = query;
        // Try to get title from yt-search by video ID
        const videoId = new URL(videoUrl).searchParams.get('v')
          || videoUrl.split('youtu.be/')[1]?.split('?')[0];
        if (videoId) {
          try {
            const info = await yts({ videoId });
            videoTitle = info.title || 'Unknown';
            if (info.duration) {
              const d = info.duration;
              videoDuration = `${d.minutes}:${String(d.seconds).padStart(2, '0')}`;
            }
          } catch { /* ignore */ }
        }
      } else {
        console.log(`[search] Searching: ${query}`);
        const searchResult = await yts(query);
        const videos = searchResult.videos;
        if (!videos || videos.length === 0) {
          return interaction.editReply('No results found. Try pasting a YouTube URL directly.');
        }
        videoUrl = videos[0].url;
        videoTitle = videos[0].title;
        const dur = videos[0].duration;
        if (dur) videoDuration = `${dur.minutes}:${String(dur.seconds).padStart(2, '0')}`;
      }

      console.log(`[play] Starting pipeline for: ${videoUrl}`);
      await interaction.editReply(`Loading: **${videoTitle}**... (this may take a moment)`);

      // 3. Start yt-dlp + ffmpeg pipeline immediately
      const audioStream = createAudioPipeline(videoUrl);

      // 4. Create audio resource from the PCM stream
      const resource = createAudioResource(audioStream, {
        inputType: StreamType.Raw,
      });

      // 5. Create player
      const player = createAudioPlayer();

      // 6. Join voice channel
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guildId,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });

      // Log every state change for diagnosis
      connection.on('stateChange', (oldState, newState) => {
        console.log(`[voice] ${oldState.status} -> ${newState.status}`);
      });

      // Wait up to 60 seconds for connection
      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 60_000);
        console.log('[voice] Connection READY');
      } catch (err) {
        console.error('[voice] Failed to reach Ready. Last state:', connection.state.status);
        try { connection.destroy(); } catch {}
        return interaction.editReply(`Could not connect to voice channel. Last state: **${connection.state?.status ?? 'unknown'}**`);
      }

      // 7. Subscribe and play
      connection.subscribe(player);
      player.play(resource);

      await interaction.editReply(
        `Now playing: **${videoTitle}**\nDuration: ${videoDuration}\nURL: ${videoUrl}`
      );

      // 8. Auto-disconnect when done
      player.on(AudioPlayerStatus.Idle, () => {
        console.log(`[${interaction.guildId}] Finished`);
        try { connection.destroy(); } catch {}
      });

      player.on('error', error => {
        console.error('[Player error]', error);
        try { connection.destroy(); } catch {}
        interaction.followUp('An error occurred during playback.').catch(() => {});
      });

    } catch (error) {
      console.error('[/play error]', error);
      return interaction.editReply(`Error: ${error.message}`);
    }
  },
};
