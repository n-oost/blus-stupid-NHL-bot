import 'dotenv/config';
import express from 'express';
import {
  ButtonStyleTypes,
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji, DiscordRequest } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';
import { 
  configureChannel, 
  getConfiguredChannel, 
  removeChannelConfig, 
  startGameUpdateChecker, 
  getNextGameEmbed 
} from './leafs-updates.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// To keep track of our active games
const activeGames = {};

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction id, type and data
  const { id, type, data, guild_id, channel_id } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name, options } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              // Fetches a random emoji to send from a helper function
              content: `hello world ${getRandomEmoji()}`
            }
          ]
        },
      });
    }

    // "setup-leafs-updates" command
    if (name === 'setup-leafs-updates' && options) {
      const channelOption = options.find(opt => opt.name === 'channel');
      if (channelOption && channelOption.value) {
        const targetChannelId = channelOption.value;
        
        // Configure the channel
        configureChannel(guild_id, targetChannelId);
        
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `✅ Maple Leafs game updates will now be posted to <#${targetChannelId}>! You'll receive updates for goals, period changes, and game results.`
          }
        });
      }
    }

    // "stop-leafs-updates" command
    if (name === 'stop-leafs-updates') {
      const success = removeChannelConfig(guild_id);
      
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: success 
            ? `✅ Maple Leafs game updates have been stopped for this server.` 
            : `⚠️ This server was not configured for Maple Leafs game updates.`
        }
      });
    }

    // "next-leafs-game" command
    if (name === 'next-leafs-game') {
      try {
        // Get next game information
        const embed = await getNextGameEmbed();
        
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed]
          }
        });
      } catch (error) {
        console.error('Error handling next-leafs-game command:', error);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Sorry, there was an error getting the next game information. Please try again later.`
          }
        });
      }
    }

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

// Start the game update checker (check every minute)
startGameUpdateChecker(60000);

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
