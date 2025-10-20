import 'dotenv/config';
import { REST, Routes } from 'discord.js';

// Create commands array
const commands = [
  {
    name: 'test',
    description: 'Basic command to test if the bot is working'
  },
  {
    name: 'setup-leafs-updates',
    description: 'Configure which channel to post Maple Leafs game updates to',
    options: [
      {
        name: 'channel',
        description: 'The channel where game updates will be posted',
        type: 7, // CHANNEL type
        required: true
      }
    ]
  },
  {
    name: 'stop-leafs-updates',
    description: 'Stop posting Maple Leafs game updates in this server'
  },
  {
    name: 'next-leafs-game',
    description: 'Get information about the next Toronto Maple Leafs game'
  },
  {
    name: 'test-nhl-api',
    description: 'Test NHL API connection and functionality'
  },
  {
    name: 'test-goal',
    description: 'Send a test goal notification to see what goal updates look like'
  }
];

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationCommands(process.env.APP_ID),
      { body: commands },
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    // Log any errors
    console.error(error);
  }
})();
