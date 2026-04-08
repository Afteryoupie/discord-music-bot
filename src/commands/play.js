/**
 * play.js
 *
 * /play command — supports:
 *   - YouTube URL (single video)
 *   - YouTube Playlist URL (list=...)
 *   - Search keywords (via yt-search)
 */

const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const yts = require('yt-search');
const { isYouTubeURL, getVideoMetadata } = require('../music/audioPipeline');
const { getOrCreate } = require('../music/GuildPlayer');
const { fetchPlaylist, isPlaylist } = require('../music/playlistHelper');
const {
  createPlayingEmbed,
  createPlaylistAddedEmbed,
  createErrorEmbed,
  getPlayerButtons,
} = require('../utils/embedGenerator');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('播放 YouTube 音樂（網址或關鍵字搜尋）')
    .addStringOption(option =>
      option
        .setName('song')
        .setDescription('YouTube URL or search keywords')
        .setRequired(true)
    ),

  async execute(interaction) {
    // 1. Must be in a voice channel
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: '❌ 你需要先加入一個語音頻道！', ephemeral: true });
    }

    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
      return interaction.reply({ content: '❌ 我沒有權限加入或在該頻道說話！', ephemeral: true });
    }

    const query = interaction.options.getString('song');
    await interaction.deferReply();

    try {
      // 2. Get or create GuildPlayer
      const gp = getOrCreate(interaction.guildId);
      gp.textChannel = interaction.channel;

      // 3. Ensure voice connection
      if (!gp.connection || gp.connection.state.status === VoiceConnectionStatus.Destroyed) {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: interaction.guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        try {
          await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
        } catch (err) {
          try { connection.destroy(); } catch { }
          return interaction.editReply({ embeds: [createErrorEmbed('無法連接到語音頻道，請稍後再試。')] });
        }
        gp.setConnection(connection);
      }

      const requestedBy = interaction.user.displayName || interaction.user.username;

      // 4a. YouTube Playlist
      if (isYouTubeURL(query) && isPlaylist(query)) {
        await interaction.editReply('🔄 正在讀取播放清單內容，這可能需要幾秒鐘...');

        const items = await fetchPlaylist(query);
        if (!items || items.length === 0) {
          return interaction.editReply({ embeds: [createErrorEmbed('無法讀取該播放清單。請確認播放清單是公開的。')] });
        }

        const limited = items.slice(0, gp.playlistLimit);
        const truncated = items.length > gp.playlistLimit ? gp.playlistLimit : false;

        limited.forEach(s => {
          gp.enqueue({ title: s.title, url: s.url, duration: '?', requestedBy });
        });

        return interaction.editReply({
          content: '',
          embeds: [createPlaylistAddedEmbed(limited.length, query, truncated)],
        });
      }

      // 4b. Single YouTube URL
      let videoUrl;
      let videoTitle = 'Unknown';
      let videoDuration = '?';

      if (isYouTubeURL(query)) {
        videoUrl = query;
        const info = await getVideoMetadata(videoUrl);
        if (info) {
          videoTitle = info.title;
          videoDuration = info.duration;
        }
      } else {
        // 4c. Keyword search
        const result = await yts(query);
        const videos = result.videos;
        if (!videos || videos.length === 0) {
          return interaction.editReply({ embeds: [createErrorEmbed('找不到結果，試試直接貼 YouTube 網址。')] });
        }
        videoUrl = videos[0].url;
        videoTitle = videos[0].title;
        const dur = videos[0].duration;
        if (dur) videoDuration = `${dur.minutes}:${String(dur.seconds).padStart(2, '0')}`;
      }

      const song = { title: videoTitle, url: videoUrl, duration: videoDuration, requestedBy };
      const enqueueResult = gp.enqueue(song);

      const pos = enqueueResult === 'playing' ? 1 : gp.queue.length;
      await interaction.editReply({
        embeds: [createPlayingEmbed(song, pos)],
      });

      // Only manually resend dashboard when song is QUEUED (not immediately playing).
      // When immediately playing, playNext() already calls resendDashboard() internally.
      // Calling it again from here causes a race condition → double cards.
      if (enqueueResult === 'queued' && gp.nowPlaying) {
        await gp.resendDashboard();
      }

    } catch (error) {
      console.error('[/play error]', error);
      return interaction.editReply({ embeds: [createErrorEmbed(`錯誤：${error.message}`)] });
    }
  },
};
