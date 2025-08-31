import 'dotenv/config';
import { getRPSChoices } from './game.js';
import { capitalize, InstallGlobalCommands } from './utils.js';

// Get the game choices from game.js
function createCommandChoices() {
  const choices = getRPSChoices();
  const commandChoices = [];

  for (let choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase(),
    });
  }

  return commandChoices;
}

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Command containing options
const CHALLENGE_COMMAND = {
  name: 'challenge',
  description: 'Challenge to a match of rock paper scissors',
  options: [
    {
      type: 3,
      name: 'object',
      description: 'Pick your object',
      required: true,
      choices: createCommandChoices(),
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

// Command to set up Leafs game updates channel
const SETUP_LEAFS_UPDATES_COMMAND = {
  name: 'setup-leafs-updates',
  description: 'Configure which channel to post Maple Leafs game updates to',
  options: [
    {
      type: 7, // CHANNEL type
      name: 'channel',
      description: 'The channel where game updates will be posted',
      required: true,
      channel_types: [0] // GUILD_TEXT channel type
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
  default_member_permissions: "32" // MANAGE_CHANNELS permission
};

// Command to stop Leafs game updates
const STOP_LEAFS_UPDATES_COMMAND = {
  name: 'stop-leafs-updates',
  description: 'Stop posting Maple Leafs game updates in this server',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
  default_member_permissions: "32" // MANAGE_CHANNELS permission
};

// Command to check next Leafs game
const NEXT_LEAFS_GAME_COMMAND = {
  name: 'next-leafs-game',
  description: 'Get information about the next Toronto Maple Leafs game',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

const ALL_COMMANDS = [
  TEST_COMMAND, 
  CHALLENGE_COMMAND,
  SETUP_LEAFS_UPDATES_COMMAND,
  STOP_LEAFS_UPDATES_COMMAND,
  NEXT_LEAFS_GAME_COMMAND
];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
