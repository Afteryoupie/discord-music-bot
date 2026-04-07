const { SlashCommandBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const yts = require('yt-search');
const { isYouTubeURL, getVideoMetadata } = require('../music/audioPipeline');
const { getOrCreate } = require('../music/GuildPlayer');

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

    try {
      // 2. Resolve URL or search
      let videoUrl;
      let videoTitle = 'Unknown';
      let videoDuration = '?';

      if (isYouTubeURL(query)) {
        videoUrl = query;
        // Fetch metadata via yt-dlp to bypass 429 rate limit
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

      // 3. Get or create GuildPlayer
      const gp = getOrCreate(interaction.guildId);
      gp.textChannel = interaction.channel;

      // 4. Ensure voice connection
      if (!gp.connection || gp.connection.state.status === VoiceConnectionStatus.Destroyed) {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: interaction.guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator,
        });

        try {
          await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
          console.log(`[${interaction.guildId}] Voice connection READY`);
        } catch (err) {
          console.error(`[${interaction.guildId}] Voice connection failed:`, err.message);
          try { connection.destroy(); } catch {}
          return interaction.editReply('❌ 無法連接到語音頻道，請稍後再試。');
        }

        gp.setConnection(connection);
      }

      // 5. Enqueue
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
};
