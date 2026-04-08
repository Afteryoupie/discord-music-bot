const { SlashCommandBuilder } = require('discord.js');
const { guildPlayers } = require('../music/GuildPlayer');
const { createPlayingEmbed, createErrorEmbed, getPlayerButtons } = require('../utils/embedGenerator');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('顯示正在播放的歌曲資訊'),

  async execute(interaction) {
    const gp = guildPlayers.get(interaction.guildId);

    if (!gp || !gp.nowPlaying) {
      return interaction.reply({
        embeds: [createErrorEmbed('目前沒有正在播放的歌曲！')],
        ephemeral: true,
      });
    }

    const song = gp.nowPlaying;
    const embed = createPlayingEmbed(song, 0);

    if (gp.isPaused()) {
      embed.setAuthor({ name: '⏸️ 已暫停' });
    }

    return interaction.reply({ 
      embeds: [embed],
      components: [getPlayerButtons(gp.isPaused())]
    });
  },
};
