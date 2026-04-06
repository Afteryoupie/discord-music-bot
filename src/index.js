require('dotenv').config({ path: require('path').join(__dirname, '..', 'setting.env') });

const { Client, GatewayIntentBits, Events } = require('discord.js');
const { loadCommands } = require('./handlers/commandHandler');

async function main() {
  // @discordjs/voice will use Node.js built-in AES-256-GCM (aead_aes256_gcm_rtpsize)
  // No external crypto library needed

  // Intercept all WebSocket close events to get close codes for diagnosis
  const ws = require('ws');
  const origOn = ws.prototype.on;
  ws.prototype.on = function(event, handler) {
    if (event === 'close') {
      const wrapped = function(code, reason) {
        console.log(`[WS CLOSE] code=${code} reason=${reason?.toString() || '(none)'}`);
        return handler.call(this, code, reason);
      };
      return origOn.call(this, event, wrapped);
    }
    return origOn.call(this, event, handler);
  };

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
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`[Command error] /${interaction.commandName}:`, error);
      const msg = { content: 'An error occurred. Please try again.', flags: 64 };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg).catch(() => {});
      } else {
        await interaction.reply(msg).catch(() => {});
      }
    }
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
