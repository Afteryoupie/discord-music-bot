const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { guildPlayers } = require('../music/GuildPlayer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('跳過目前播放的歌曲'),

  async execute(interaction) {
    const gp = guildPlayers.get(interaction.guildId);

    if (!gp || !gp.isPlaying()) {
      return interaction.reply({
        content: '❌ 目前沒有正在播放的歌曲！',
        flags: [MessageFlags.Ephemeral],
      });
    }

    const skipped = gp.skip();
    const nextSong = gp.queue[0];

    let msg = `⏭️ 已跳過：**${skipped?.title || 'Unknown'}**`;
    if (nextSong) {
      msg += `\n🎵 即將播放：**${nextSong.title}**`;
    } else {
      msg += '\n📋 播放清單已空。';
    }

    return interaction.reply(msg);
  },
};
