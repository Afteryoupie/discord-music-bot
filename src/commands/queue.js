const { SlashCommandBuilder } = require('discord.js');
const { guildPlayers } = require('../music/GuildPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('查看當前播放清單'),

  async execute(interaction) {
    const gp = guildPlayers.get(interaction.guildId);

    if (!gp || (!gp.nowPlaying && gp.queue.length === 0)) {
      return interaction.reply({
        content: '📋 播放清單是空的！使用 `/play` 來點歌。',
        ephemeral: true,
      });
    }

    const lines = [];

    // Now playing
    if (gp.nowPlaying) {
      const status = gp.isPaused() ? '⏸️ 已暫停' : '🎵 正在播放';
      lines.push(`${status}：**${gp.nowPlaying.title}** (${gp.nowPlaying.duration}) — ${gp.nowPlaying.requestedBy}`);
      lines.push('━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    // Queue
    if (gp.queue.length === 0) {
      lines.push('📋 播放清單中沒有等待中的歌曲。');
    } else {
      const maxShow = 10;
      const showing = gp.queue.slice(0, maxShow);

      lines.push(`📋 播放清單 (${gp.queue.length} 首等待中)：`);
      showing.forEach((song, i) => {
        lines.push(`\` ${i + 1}. \` **${song.title}** (${song.duration}) — ${song.requestedBy}`);
      });

      if (gp.queue.length > maxShow) {
        lines.push(`…還有 **${gp.queue.length - maxShow}** 首`);
      }
    }

    return interaction.reply(lines.join('\n'));
  },
};
