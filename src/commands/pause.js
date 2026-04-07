const { SlashCommandBuilder } = require('discord.js');
const { guildPlayers } = require('../music/GuildPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('暫停目前播放的歌曲'),

  async execute(interaction) {
    const gp = guildPlayers.get(interaction.guildId);

    if (!gp || !gp.isPlaying()) {
      return interaction.reply({
        content: '❌ 目前沒有正在播放的歌曲！',
        ephemeral: true,
      });
    }

    if (gp.isPaused()) {
      return interaction.reply({
        content: '⏸️ 已經是暫停狀態了！使用 `/resume` 來繼續播放。',
        ephemeral: true,
      });
    }

    gp.pause();
    return interaction.reply(`⏸️ 已暫停：**${gp.nowPlaying?.title || 'Unknown'}**`);
  },
};
