const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('讓機器人離開語音頻道'),

  async execute(interaction) {
    const connection = getVoiceConnection(interaction.guildId);

    if (!connection) {
      return interaction.reply({
        content: '❌ 我目前不在任何語音頻道中！',
        ephemeral: true,
      });
    }

    connection.destroy();
    return interaction.reply('👋 已離開語音頻道！');
  },
};
