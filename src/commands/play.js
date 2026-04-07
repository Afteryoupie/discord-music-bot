const { SlashCommandBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const { isYouTubeURL, isYouTubePlaylist, getVideoMetadata, getPlaylistMetadata } = require('../music/audioPipeline');
const { getOrCreate } = require('../music/GuildPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('播放 YouTube 音樂（網址、關鍵字或播放清單）')
    .addStringOption(option =>
      option
        .setName('song')
        .setDescription('YouTube URL, Search keywords, or Playlist URL')
        .setRequired(true)
    ),

  async execute(interaction) {
    // 1. Check voice channel
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

    const gp = getOrCreate(interaction.guildId);
    gp.textChannel = interaction.channel;

    try {
      // 2. Resolve URL, Playlist or search
      if (isYouTubePlaylist(query)) {
        // --- PLAYLIST LOGIC ---
        const playlist = await getPlaylistMetadata(query, 50);
        if (!playlist || playlist.entries.length === 0) {
          return interaction.editReply('❌ 無法讀取播放清單，請確認網址是否正確且非私人清單。');
        }

        // Ensure voice connection before adding
        await this._ensureConnection(gp, voiceChannel, interaction);
        if (!gp.connection) return; // Error handled in _ensureConnection

        const songs = playlist.entries.map(entry => ({
          title: entry.title,
          url: entry.url,
          duration: entry.duration,
          requestedBy: interaction.user.displayName || interaction.user.username,
        }));

        const result = gp.enqueueMany(songs);
        const playMsg = result === 'playing' ? `🎵 正在播放：**${songs[0].title}**\n` : '';

        return interaction.editReply(
          `${playMsg}✅ 已成功從播放清單 **${playlist.playlistTitle}** 加入 **${songs.length}** 首歌！`
        );
      }

      // --- SINGLE SONG OR SEARCH LOGIC ---
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
        console.log(`[search] Searching: ${query}`);
        const searchResult = await yts(query);
        const videos = searchResult.videos;
        if (!videos || videos.length === 0) {
          return interaction.editReply('❌ 找不到結果，試試直接貼 YouTube 網址。');
        }
        videoUrl = videos[0].url;
        videoTitle = videos[0].title;
        const dur = videos[0].duration;
        if (dur) videoDuration = `${dur.minutes}:${String(dur.seconds).padStart(2, '0')}`;
      }

      await this._ensureConnection(gp, voiceChannel, interaction);
      if (!gp.connection) return;

      const song = {
        title: videoTitle,
        url: videoUrl,
        duration: videoDuration,
        requestedBy: interaction.user.displayName || interaction.user.username,
      };

      const result = gp.enqueue(song);

      if (result === 'playing') {
        await interaction.editReply(
          `🎵 正在播放：**${videoTitle}** (${videoDuration})\n` +
          `🔗 ${videoUrl}`
        );
      } else {
        const position = gp.queue.length;
        await interaction.editReply(
          `✅ 已加入播放清單第 **${position}** 位：**${videoTitle}** (${videoDuration})`
        );
      }

    } catch (error) {
      console.error('[/play error]', error);
      return interaction.editReply(`❌ 錯誤：${error.message}`);
    }
  },

  /**
   * Helper to ensure voice connection is ready.
   */
  async _ensureConnection(gp, voiceChannel, interaction) {
    if (!gp.connection || gp.connection.state.status === VoiceConnectionStatus.Destroyed) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guildId,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });

      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
      } catch (err) {
        console.error(`[${interaction.guildId}] Voice connection failed:`, err.message);
        try { connection.destroy(); } catch {}
        await interaction.editReply('❌ 無法連接到語音頻道，請稍後再試。');
        return;
      }
      gp.setConnection(connection);
    }
  },
};
