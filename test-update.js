import 'dotenv/config';
import { DiscordRequest } from './utils.js';
import { getConfiguredChannel } from './leafs-updates.js';

// Get guild ID from command line
const args = process.argv.slice(2);
const guildId = args[0];

if (!guildId) {
  console.error('Please provide a guild ID as an argument');
  process.exit(1);
}

// Get the configured channel for the guild
const channelId = getConfiguredChannel(guildId);

if (!channelId) {
  console.error(`No channel configured for guild ${guildId}. Use /setup-leafs-updates first.`);
  process.exit(1);
}

// Simulate a game update
async function simulateGameUpdate() {
  try {
    const embed = {
      title: "🚨 GOAL! Boston Bruins 1 - 2 Toronto Maple Leafs",
      color: 0x4CAF50,
      fields: [
        {
          name: "Boston Bruins",
          value: "1",
          inline: true
        },
        {
          name: "VS",
          value: "2nd Period 08:42",
          inline: true
        },
        {
          name: "Toronto Maple Leafs",
          value: "2",
          inline: true
        }
      ],
      footer: {
        text: "Game Status: In Progress"
      },
      thumbnail: {
        url: "https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/10.svg"
      },
      timestamp: new Date().toISOString()
    };
    
    await DiscordRequest(`channels/${channelId}/messages`, {
      method: 'POST',
      body: {
        embeds: [embed]
      }
    });
    
    console.log(`Test message sent to channel ${channelId}`);
  } catch (error) {
    console.error('Error sending test message:', error);
  }
}

// Run the simulation
simulateGameUpdate();
