const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { guildPlayers } = require('../music/GuildPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('隨機打亂目前的播放清單 (Shuffle)'),

  async execute(interaction) {
    const gp = guildPlayers.get(interaction.guildId);

    if (!gp || gp.queue.length <= 1) {
      return interaction.reply({
        content: '❌ 目前播放清單數量太少，無法洗牌！',
        flags: [MessageFlags.Ephemeral],
      });
    }

    gp.shuffle();
    return interaction.reply('🔀 **播放清單已重新洗牌！**\n立刻使用 `/queue` 查看新順序。');
  },
};
