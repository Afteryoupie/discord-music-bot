const { Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

/**
 * 自動掃描並載入 src/commands/ 下所有指令檔案
 * 每個指令檔必須 export: { data, execute }
 */
function loadCommands(client) {
  client.commands = new Collection();

  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if (!command.data || !command.execute) {
      console.warn(`[警告] ${file} 缺少 data 或 execute，已跳過`);
      continue;
    }

    client.commands.set(command.data.name, command);
    console.log(`[指令載入] /${command.data.name}`);
  }
}

module.exports = { loadCommands };
