const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { guildPlayers } = require('../music/GuildPlayer');
const { createQueueEmbed } = require('../utils/embedGenerator');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('查看當前播放清單'),

  async execute(interaction) {
    const gp = guildPlayers.get(interaction.guildId);

    if (!gp) {
      return interaction.reply({
        embeds: [createQueueEmbed([], null, false)],
        flags: [MessageFlags.Ephemeral],
      });
    }

    const embed = createQueueEmbed(gp.queue, gp.nowPlaying, gp.isPaused());
    return interaction.reply({ embeds: [embed] });
  },
};
