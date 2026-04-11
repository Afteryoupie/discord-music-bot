/**
 * buttonHandler.js
 *
 * Handles all Discord button interactions.
 * Custom IDs: btn_pause_resume, btn_skip, btn_shuffle, btn_radio, btn_queue
 */

const { MessageFlags } = require('discord.js');
const { guildPlayers } = require('../music/GuildPlayer');
const { createPlayingEmbed, getPlayerButtons, createQueueEmbed } = require('../utils/embedGenerator');

async function handleButton(interaction) {
  const { customId, guildId } = interaction;
  const gp = guildPlayers.get(guildId);

  if (!gp || !gp.nowPlaying) {
    return interaction.reply({
      content: '❌ 目前沒有正在播放的歌曲！',
      flags: [MessageFlags.Ephemeral],
    });
  }

  try {
    // ── Pause / Resume ─────────────────────────────────────────
    if (customId === 'btn_pause_resume') {
      const wasPaused = gp.isPaused();
      wasPaused ? gp.resume() : gp.pause();
      const nowPaused = !wasPaused;

      // Update in-place — no need to move card to bottom
      const embed = createPlayingEmbed(gp.nowPlaying, 0);
      if (nowPaused) embed.setAuthor({ name: '⏸️ 已暫停' });

      return interaction.update({
        embeds: [embed],
        components: [getPlayerButtons(nowPaused, gp.isRadioMode)],
      });
    }

    // ── Skip ───────────────────────────────────────────────────
    if (customId === 'btn_skip') {
      await interaction.deferUpdate();
      const title = gp.nowPlaying ? gp.nowPlaying.title : '未知歌曲';

      // Delete old dashboard first
      await gp._cleanupLastMessage();

      // Send text notification
      await interaction.channel.send({ content: `⏭️ 已跳過：**${title}**` });

      // Trigger skip — stop(true) in skip() ensures Idle fires even if paused
      gp.skip();
      return;
    }

    // ── Shuffle ────────────────────────────────────────────────
    if (customId === 'btn_shuffle') {
      const ok = gp.shuffle();
      if (!ok) {
        return interaction.reply({
          content: '❌ 播放清單數量太少，無法洗牌！',
          flags: [MessageFlags.Ephemeral],
        });
      }

      await interaction.deferUpdate();
      await interaction.channel.send({ content: '🔀 播放清單已隨機洗牌！' });

      // Resend dashboard after the text message
      await gp.resendDashboard();
      return;
    }

    // ── Radio Mode ─────────────────────────────────────────────
    if (customId === 'btn_radio') {
      gp.isRadioMode = !gp.isRadioMode;
      gp.textChannel = interaction.channel;
      
      await interaction.deferUpdate();
      // Resend dashboard to show updated status
      await gp.resendDashboard();
      return;
    }

    // ── Queue List ─────────────────────────────────────────────
    if (customId === 'btn_queue') {
      const embed = createQueueEmbed(gp.queue, gp.nowPlaying, gp.isPaused(), gp.isRadioMode);
      return interaction.reply({
        embeds: [embed],
        flags: [MessageFlags.Ephemeral],
      });
    }

  } catch (err) {
    console.error('[Button Error]', err);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ 操作發生錯誤，請重試。', flags: [MessageFlags.Ephemeral] });
      }
    } catch { /* ignore */ }
  }
}

module.exports = { handleButton };
