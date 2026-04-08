const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const COLORS = {
  PLAYING: 0x2ecc71,    // Green
  QUEUED: 0x3498db,     // Blue
  PLAYLIST: 0x9b59b6,   // Purple
  ERROR: 0xe74c3c,      // Red
  INFO: 0xf1c40f       // Yellow
};

/**
 * Creates an embed for a single song added to queue or playing.
 */
function createPlayingEmbed(song, position) {
  const embed = new EmbedBuilder()
    .setColor(position === 0 ? COLORS.PLAYING : COLORS.QUEUED)
    .setTitle(song.title)
    .setURL(song.url)
    .addFields(
      { name: '⏳ 時長', value: song.duration, inline: true },
      { name: '👤 點歌者', value: song.requestedBy, inline: true }
    );

  if (position === 0) {
    embed.setAuthor({ name: '🎵 正在播放' });
  } else {
    embed.setAuthor({ name: `✅ 已加入播放清單第 ${position} 位` });
  }

  // Extract thumbnail if YouTube
  try {
    let videoId;
    if (song.url.includes('v=')) {
      videoId = new URL(song.url).searchParams.get('v');
    } else if (song.url.includes('youtu.be/')) {
      videoId = song.url.split('youtu.be/')[1]?.split('?')[0];
    }
    if (videoId) {
      embed.setThumbnail(`https://img.youtube.com/vi/${videoId}/default.jpg`);
    }
  } catch {}

  return embed;
}

/**
 * Creates an embed when a full playlist is added.
 */
function createPlaylistAddedEmbed(count, url, truncatedLimit = false) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PLAYLIST)
    .setAuthor({ name: '📑 歌單匯入成功' })
    .setTitle(`已成功匯入 ${count} 首歌曲至播放清單`)
    .setURL(url)
    .setDescription('使用 `/queue` 查看目前的播放佇列。');

  if (truncatedLimit) {
    embed.addFields({ name: '⚠️ 數量限制', value: `為了效能與洗版考量，單次最多只能匯入 ${truncatedLimit} 首歌曲。可由管理員透過 \`/limit\` 調整。` });
  }

  return embed;
}

/**
 * Creates an embed for the queue.
 */
function createQueueEmbed(queue, nowPlaying, isPaused) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle('📋 當前播放清單');

  if (!nowPlaying && queue.length === 0) {
    return embed.setDescription('播放清單目前是空的！使用 `/play` 來點歌。');
  }

  let description = '';

  if (nowPlaying) {
    const status = isPaused ? '⏸️ 已暫停' : '🎵 正在播放';
    description += `**${status}**\n[${nowPlaying.title}](${nowPlaying.url}) | \`${nowPlaying.duration}\` | 👤 \`${nowPlaying.requestedBy}\`\n\n`;
  }

  if (queue.length > 0) {
    description += '**即將播放：**\n';
    const limit = 10;
    const showing = queue.slice(0, limit);
    
    showing.forEach((song, i) => {
      description += `\` ${i + 1}. \` [${song.title}](${song.url}) | \`${song.duration}\` | 👤 \`${song.requestedBy}\`\n`;
    });

    if (queue.length > limit) {
      description += `\n...還有 **${queue.length - limit}** 首歌曲`;
    }
  } else if (nowPlaying) {
    description += '*播放清單預備區目前沒有歌曲*';
  }

  embed.setDescription(description);
  
  if (queue.length > 0) {
    embed.setFooter({ text: `佇列總數：${queue.length} 首` });
  }

  return embed;
}

/**
 * Creates an error embed.
 */
function createErrorEmbed(message) {
  return new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setDescription(`❌ ${message}`);
}

/**
 * Creates button components for the player (Pause/Resume, Skip).
 */
function getPlayerButtons(isPaused) {
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('btn_pause_resume')
        .setLabel(isPaused ? '▶️ 繼續' : '⏸️ 暫停')
        .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('btn_skip')
        .setLabel('⏭️ 跳過')
        .setStyle(ButtonStyle.Secondary)
    );
  return row;
}

module.exports = {
  createPlayingEmbed,
  createPlaylistAddedEmbed,
  createQueueEmbed,
  createErrorEmbed,
  getPlayerButtons,
  COLORS
};
