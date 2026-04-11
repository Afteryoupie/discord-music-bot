const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { guildPlayers } = require('../music/GuildPlayer');
const { createErrorEmbed } = require('../utils/embedGenerator');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('顯示正在播放的歌曲資訊'),

  async execute(interaction) {
    const gp = guildPlayers.get(interaction.guildId);

    if (!gp || !gp.nowPlaying) {
      return interaction.reply({
        embeds: [createErrorEmbed('目前沒有正在播放的歌曲！')],
        flags: [MessageFlags.Ephemeral],
      });
    }

    // Acknowledge interaction (ephemeral) or just call resend
    await interaction.reply({ content: '🔍 正在取得當前播放狀態...', flags: [MessageFlags.Ephemeral] });
    
    // Centralized sticky dashboard resend
    await gp.resendDashboard();
  },
};
