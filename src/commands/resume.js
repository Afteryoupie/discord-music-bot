const { SlashCommandBuilder } = require('discord.js');
const { guildPlayers } = require('../music/GuildPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('恢復播放已暫停的歌曲'),

  async execute(interaction) {
    const gp = guildPlayers.get(interaction.guildId);

    if (!gp || !gp.isPlaying()) {
      return interaction.reply({
        content: '❌ 目前沒有正在播放的歌曲！',
        ephemeral: true,
      });
    }

    if (!gp.isPaused()) {
      return interaction.reply({
        content: '▶️ 目前不是暫停狀態！',
        ephemeral: true,
      });
    }

    gp.resume();
    return interaction.reply(`▶️ 繼續播放：**${gp.nowPlaying?.title || 'Unknown'}**`);
  },
};
