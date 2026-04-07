const { SlashCommandBuilder } = require('discord.js');
const { getOrCreate, guildPlayers } = require('../music/GuildPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('讓機器人離開語音頻道並清空播放清單'),

  async execute(interaction) {
    const gp = guildPlayers.get(interaction.guildId);

    if (!gp || !gp.connection) {
      return interaction.reply({
        content: '❌ 我目前不在任何語音頻道中！',
        ephemeral: true,
      });
    }

    const queueSize = gp.queue.length;
    gp.destroy();
    guildPlayers.delete(interaction.guildId);

    const extra = queueSize > 0 ? `（已清空 ${queueSize} 首待播歌曲）` : '';
    return interaction.reply(`👋 已離開語音頻道！${extra}`);
  },
};
