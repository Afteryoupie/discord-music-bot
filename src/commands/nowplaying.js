const { SlashCommandBuilder } = require('discord.js');
const { guildPlayers } = require('../music/GuildPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('顯示正在播放的歌曲資訊'),

  async execute(interaction) {
    const gp = guildPlayers.get(interaction.guildId);

    if (!gp || !gp.nowPlaying) {
      return interaction.reply({
        content: '❌ 目前沒有正在播放的歌曲！',
        ephemeral: true,
      });
    }

    const song = gp.nowPlaying;
    const status = gp.isPaused() ? '⏸️ 已暫停' : '🎵 正在播放';
    const queueInfo = gp.queue.length > 0
      ? `📋 播放清單中還有 **${gp.queue.length}** 首`
      : '📋 播放清單已空';

    const lines = [
      `${status}`,
      ``,
      `🎶 **${song.title}**`,
      `⏱️ 時長：${song.duration}`,
      `👤 點歌者：${song.requestedBy}`,
      `🔗 ${song.url}`,
      ``,
      queueInfo,
    ];

    return interaction.reply(lines.join('\n'));
  },
};
