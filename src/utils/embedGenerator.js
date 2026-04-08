const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const COLORS = {
  PLAYING: 0x2ecc71,   // Green
  QUEUED:  0x3498db,   // Blue
  PLAYLIST: 0x9b59b6,  // Purple
  ERROR:   0xe74c3c,   // Red
  INFO:    0xf1c40f,   // Yellow
};

// ─── Helper ───────────────────────────────────────────────────

function extractVideoId(url) {
  try {
    if (url.includes('v=')) return new URL(url).searchParams.get('v');
    if (url.includes('youtu.be/')) return url.split('youtu.be/')[1]?.split('?')[0];
  } catch {}
  return null;
}

// ─── Embeds ───────────────────────────────────────────────────

/**
 * Embed for currently playing or queued song.
 * position = 0 → playing now; position > 0 → queue position
 */
function createPlayingEmbed(song, position) {
  const isPlaying = position === 0;
  const embed = new EmbedBuilder()
    .setColor(isPlaying ? COLORS.PLAYING : COLORS.QUEUED)
    .setTitle(song.title)
    .setURL(song.url)
    .setAuthor({ name: isPlaying ? '🎵 正在播放' : `✅ 已加入播放清單第 ${position} 位` })
    .addFields(
      { name: '⏳ 時長', value: song.duration || '?', inline: true },
      { name: '👤 點歌者', value: song.requestedBy || 'Unknown', inline: true }
    );

  const videoId = extractVideoId(song.url);
  if (videoId) {
    embed.setThumbnail(`https://img.youtube.com/vi/${videoId}/default.jpg`);
  }

  return embed;
}

/**
 * Embed shown when an entire playlist is imported.
 */
function createPlaylistAddedEmbed(count, url, truncatedLimit = false) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PLAYLIST)
    .setAuthor({ name: '📑 歌單匯入成功' })
    .setTitle(`已成功匯入 ${count} 首歌曲至播放清單`)
    .setURL(url)
    .setDescription('使用 `/queue` 查看目前的播放佇列。');

  if (truncatedLimit) {
    embed.addFields({
      name: '⚠️ 數量限制',
      value: `單次最多匯入 ${truncatedLimit} 首。可由管理員透過 \`/limit\` 調整。`,
    });
  }

  return embed;
}

/**
 * Embed for the queue list.
 */
function createQueueEmbed(queue, nowPlaying, isPaused, isRadioMode = false) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle('📋 當前播放清單');

  if (!nowPlaying && queue.length === 0) {
    return embed.setDescription('播放清單目前是空的！使用 `/play` 來點歌。');
  }

  let description = '';

  if (nowPlaying) {
    const status = isPaused ? '⏸️ 已暫停' : '🎵 正在播放';
    if (isRadioMode) description += '📻 **智慧電台模式已開啟**\n';
    description += `**${status}**\n[${nowPlaying.title}](${nowPlaying.url}) | \`${nowPlaying.duration}\` | 👤 \`${nowPlaying.requestedBy}\`\n\n`;
  }

  if (queue.length > 0) {
    description += '**即將播放：**\n';
    queue.slice(0, 10).forEach((song, i) => {
      description += `\`${i + 1}.\` [${song.title}](${song.url}) | \`${song.duration}\` | 👤 \`${song.requestedBy}\`\n`;
    });
    if (queue.length > 10) {
      description += `\n...還有 **${queue.length - 10}** 首歌曲`;
    }
  } else if (nowPlaying) {
    description += '*播放清單預備區目前沒有歌曲*';
  }

  embed.setDescription(description);
  if (queue.length > 0) embed.setFooter({ text: `佇列總數：${queue.length} 首` });

  return embed;
}

/**
 * Error embed.
 */
function createErrorEmbed(message) {
  return new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setDescription(`❌ ${message}`);
}

// ─── Buttons ──────────────────────────────────────────────────

/**
 * Full player control row:
 * ⏸️/▶️ Pause/Resume | ⏭️ Skip | 🔀 Shuffle | 📻 Radio
 */
function getPlayerButtons(isPaused, isRadioMode = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_pause_resume')
      .setLabel(isPaused ? '▶️ 繼續' : '⏸️ 暫停')
      .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('btn_skip')
      .setLabel('⏭️ 跳過')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('btn_shuffle')
      .setLabel('🔀 隨機')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('btn_radio')
      .setLabel(isRadioMode ? '📻 電台 ON' : '📻 電台')
      .setStyle(isRadioMode ? ButtonStyle.Success : ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('btn_queue')
      .setLabel('📋 清單')
      .setStyle(ButtonStyle.Secondary),
  );
}

// ─── Exports ──────────────────────────────────────────────────

module.exports = {
  createPlayingEmbed,
  createPlaylistAddedEmbed,
  createQueueEmbed,
  createErrorEmbed,
  getPlayerButtons,
  COLORS,
};
