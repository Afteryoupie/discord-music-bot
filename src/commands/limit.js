const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getOrCreate } = require('../music/GuildPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('limit')
    .setDescription('設定單次匯入 YouTube 播放清單的數量上限')
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('最多匯入幾首歌 (預設50，最高建議不超過1000)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1000)
    ),

  async execute(interaction) {
    // Optional permissions check can go here (e.g., admin only):
    // if (!interaction.member.permissions.has('ManageGuild')) {
    //   return interaction.reply({ content: '❌ 只有伺服器管理員可以更改此設定。', flags: [MessageFlags.Ephemeral] });
    // }

    const db = require('../database/DbManager');
    const count = interaction.options.getInteger('count');
    
    // Save to database permanently
    db.setPlaylistLimit(interaction.guildId, count);

    // Update current session if active (getOrCreate ensures it applies to the current instance)
    const gp = getOrCreate(interaction.guildId);
    gp.playlistLimit = count;

    return interaction.reply(`✅ 已將本伺服器的單次清單匯入上限調整為 **${count}** 首！\n下一次使用 \`/play\` 貼上歌單時將會套用此限制。`);
  },
};
