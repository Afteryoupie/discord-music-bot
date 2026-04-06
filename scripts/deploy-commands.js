/**
 * deploy-commands.js
 *
 * Deploy Slash Commands globally (available in all servers).
 * Run once after any command changes.
 *
 * Usage:
 *   node scripts/deploy-commands.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'setting.env') });

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const { DISCORD_TOKEN, CLIENT_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('Please set DISCORD_TOKEN and CLIENT_ID in setting.env');
  process.exit(1);
}

// Collect all command definitions
const commands = [];
const commandsPath = path.join(__dirname, '..', 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data) {
    commands.push(command.data.toJSON());
    console.log(`[collect] /${command.data.name}`);
  }
}

const rest = new REST().setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`\nDeploying ${commands.length} Global Slash Commands...`);
    console.log('Note: Global commands can take up to 1 hour to appear in all servers.\n');

    // Global commands - available in ALL servers automatically
    const data = await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log(`Successfully deployed ${data.length} global command(s)!`);
  } catch (error) {
    console.error('Deploy failed:', error);
  }
})();
