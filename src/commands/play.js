const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const yts = require('yt-search');
const { isYouTubeURL, getVideoMetadata } = require('../music/audioPipeline');
const { getOrCreate } = require('../music/GuildPlayer');
const { isPlaylist, fetchPlaylist } = require('../music/playlistHelper');

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

    const gp = getOrCreate(interaction.guildId);
    gp.textChannel = interaction.channel;

    try {
      // 2. Handle Playlist
      if (isPlaylist(query)) {
        await interaction.editReply('🔍 正在解析播放清單，請稍候...');
        const playlistSongs = await fetchPlaylist(query);
        
        if (!playlistSongs || playlistSongs.length === 0) {
          return interaction.editReply('❌ 無法抓取播放清單內容，可能是私人的或連結無效。');
        }

        // Ensure voice connection before batch enqueueing
        await ensureConnection(gp, voiceChannel, interaction);

        let addedCount = 0;
        playlistSongs.forEach((s) => {
          gp.enqueue({
            title: s.title,
            url: s.url,
            duration: '?', // Duration not fetched in flat-playlist for speed
            requestedBy: interaction.user.username,
            requestedById: interaction.user.id
          });
          addedCount++;
        });

        const playlistEmbed = new EmbedBuilder()
          .setTitle('✅ 播放清單已加入')
          .setDescription(`成功從清單中加入了 **${addedCount}** 首歌曲！`)
          .setColor(0x2ecc71)
          .setFooter({ text: `點歌者：${interaction.user.username}` });

        return interaction.editReply({ content: null, embeds: [playlistEmbed] });
      }

      // 3. Resolve Single URL or Search
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
        videoDuration = videos[0].duration.timestamp;
      }

      // 4. Ensure voice connection
      await ensureConnection(gp, voiceChannel, interaction);

      // 5. Enqueue
      const song = {
        title: videoTitle,
        url: videoUrl,
        duration: videoDuration,
        requestedBy: interaction.user.username,
        requestedById: interaction.user.id,
      };

      const result = gp.enqueue(song);

      const songEmbed = new EmbedBuilder()
        .setTitle(result === 'playing' ? '🎵 正在播放' : '✅ 已加入待播清單')
        .setDescription(`**[${videoTitle}](${videoUrl})**`)
        .addFields(
          { name: '🕒 時長', value: `\`${videoDuration}\``, inline: true },
          { name: '👤 點歌者', value: `\`${interaction.user.username}\``, inline: true }
        )
        .setColor(result === 'playing' ? 0x9b59b6 : 0x3498db);

      if (result !== 'playing') {
        const position = gp.queue.length;
        songEmbed.setFooter({ text: `在清單中的位置：${position}` });
      }

      await interaction.editReply({ content: null, embeds: [songEmbed] });

    } catch (error) {
      console.error('[/play error]', error);
      return interaction.editReply(`❌ 錯誤：${error.message}`);
    }
  },
};

/**
 * Helper to handle voice connection logic.
 */
async function ensureConnection(gp, voiceChannel, interaction) {
  if (!gp.connection || gp.connection.state.status === VoiceConnectionStatus.Destroyed) {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
      console.log(`[${interaction.guildId}] Voice connection READY`);
      gp.setConnection(connection);
    } catch (err) {
      console.error(`[${interaction.guildId}] Voice connection failed:`, err.message);
      try { connection.destroy(); } catch {}
      throw new Error('無法連接到語音頻道，請稍後再試。');
    }
  }
}
