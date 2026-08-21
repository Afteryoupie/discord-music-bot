require('dotenv').config({ path: require('path').join(__dirname, '..', 'setting.env') });

const { Client, GatewayIntentBits, Events, MessageFlags } = require('discord.js');
const { loadCommands } = require('./handlers/commandHandler');
const { handleButton } = require('./handlers/buttonHandler');
const { guildPlayers } = require('./music/GuildPlayer');
const { runStartupUpdates } = require('./utils/ytdlpUpdater');

async function main() {
  // Check and auto-update yt-dlp and safe npm packages on startup
  runStartupUpdates();
  // @discordjs/voice will use Node.js built-in AES-256-GCM (aead_aes256_gcm_rtpsize)
  // No external crypto library needed

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
    ],
  });

  loadCommands(client);

  client.once(Events.ClientReady, readyClient => {
    console.log(`Bot online: ${readyClient.user.tag}`);
    console.log(`Serving ${readyClient.guilds.cache.size} guild(s)`);
  });

  client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isButton()) {
      return handleButton(interaction);
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      // 10062 = Unknown Interaction — expired before we could respond, silently discard
      if (error?.code === 10062) return;
      console.error(`[Command error] /${interaction.commandName}:`, error);
      const msg = { content: '❌ 發生錯誤，請稍後再試。', flags: [MessageFlags.Ephemeral] };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg).catch(() => {});
      } else {
        await interaction.reply(msg).catch(() => {});
      }
    }
  });

  // Auto-leave when voice channel is empty for 3 minutes
  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const guildId = oldState.guild.id;
    const gp = guildPlayers.get(guildId);
    if (!gp || !gp.connection) return;

    // Get the channel the bot is currently in
    const botChannelId = oldState.guild.members.me?.voice?.channelId;
    if (!botChannelId) return;

    const channel = oldState.guild.channels.cache.get(botChannelId);
    if (!channel) return;

    // Count human (non-bot) members in the channel
    const humanCount = channel.members.filter(m => !m.user.bot).size;

    if (humanCount === 0) {
      // Channel is now empty — start the countdown
      gp.startEmptyChannelTimer();
    } else {
      // Someone is in the channel — cancel any pending countdown
      gp.clearEmptyChannelTimer();
    }
  });

  // Prevent Discord client 'error' events from crashing the process
  client.on(Events.Error, error => {
    console.error('[Discord client error]', error);
  });

  process.on('unhandledRejection', error => {
    console.error('[Unhandled rejection]', error);
  });

  await client.login(process.env.DISCORD_TOKEN);
}

main().catch(err => {
  console.error('[Fatal]', err);
  process.exit(1);
});
