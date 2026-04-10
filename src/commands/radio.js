const { SlashCommandBuilder } = require('discord.js');
const { getOrCreate } = require('../music/GuildPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('radio')
    .setDescription('切換智慧電台模式（清單空了自動播歷史歌曲）'),

  async execute(interaction) {
    const gp = getOrCreate(interaction.guildId);
    
    gp.isRadioMode = !gp.isRadioMode;
    
    // Ensure text channel is set for notifications
    gp.textChannel = interaction.channel;

    const status = gp.isRadioMode ? '✅ **已開啟**' : '❌ **已關閉**';

    // If turned ON while idle, trigger radio immediately
    if (gp.isRadioMode && !gp.nowPlaying && gp.queue.length === 0) {
      gp._startRadio();
    }
    
    return interaction.reply({
      content: `📻 **智慧電台模式** ${status}\n當播放清單結束後，我會自動從本台的播放歷史中隨機挑選歌曲續播。`,
    });
  },
};
