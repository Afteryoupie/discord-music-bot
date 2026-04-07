const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/DbManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('查看本伺服器的播放歷史紀錄'),

  async execute(interaction) {
    const history = db.getHistory(interaction.guildId, 15);

    if (!history || history.length === 0) {
      return interaction.reply({
        content: '📜 目前還沒有播放紀錄喔！快去點幾首歌吧。',
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('📜 最近播放紀錄')
      .setColor(0x3498db)
      .setDescription(
        history.map((h, i) => {
          const time = new Date(h.played_at).toLocaleString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          return `**${i + 1}.** [${h.title}](${h.url}) \n 👤 \`${h.requested_by_name}\` • 🕒 \`${time}\``;
        }).join('\n\n')
      )
      .setFooter({ text: `顯示最近 ${history.length} 筆紀錄` });

    return interaction.reply({ embeds: [embed] });
  },
};
