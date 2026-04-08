const { guildPlayers } = require('../music/GuildPlayer');
const { createPlayingEmbed, getPlayerButtons } = require('../utils/embedGenerator');

async function handleButton(interaction) {
  const customId = interaction.customId;
  const gp = guildPlayers.get(interaction.guildId);

  // If no guild player or nothing playing, just return an error
  if (!gp || !gp.nowPlaying) {
    return interaction.reply({
      content: '❌ 目前沒有正在播放的歌曲！',
      ephemeral: true,
    });
  }

  try {
    if (customId === 'btn_pause_resume') {
      if (gp.isPaused()) {
        gp.resume();
        // Update the embed
        const embed = createPlayingEmbed(gp.nowPlaying, 0);
        await interaction.update({
          embeds: [embed],
          components: [getPlayerButtons(false)] // Not paused
        });
      } else {
        gp.pause();
        const embed = createPlayingEmbed(gp.nowPlaying, 0);
        embed.setAuthor({ name: '⏸️ 已暫停' });
        await interaction.update({
          embeds: [embed],
          components: [getPlayerButtons(true)] // Paused
        });
      }
    } 
    else if (customId === 'btn_skip') {
      const skipped = gp.skip();
      await interaction.reply({
        content: `⏭️ 已跳過：**${skipped ? skipped.title : '未知歌曲'}**`
      });
      // Try to disable the buttons on the old message, though it may fail if message is old
      try {
        await interaction.message.edit({ components: [] });
      } catch (e) {
        // Ignore edit errors
      }
    }
  } catch (err) {
    console.error('[Button Error]', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ 操作發生錯誤。', ephemeral: true });
    }
  }
}

module.exports = { handleButton };
