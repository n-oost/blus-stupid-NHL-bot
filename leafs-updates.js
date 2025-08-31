import 'dotenv/config';
import { 
  InteractionResponseType, 
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes
} from 'discord-interactions';
import { DiscordRequest } from './utils.js';
import { getCurrentLeafsGame, getNextLeafsGame, getGameStatus, formatGameData, getTeamLogos } from './nhl-api.js';

// Store channels configured for game updates
let configuredChannels = {};
// Store active games being tracked
let activeGames = {};

/**
 * Configure a channel to receive Leafs game updates
 * @param {string} guildId - Discord server ID
 * @param {string} channelId - Channel ID to post updates to
 */
export function configureChannel(guildId, channelId) {
  configuredChannels[guildId] = channelId;
  return true;
}

/**
 * Get the configured channel for a guild
 * @param {string} guildId - Discord server ID
 * @returns {string|null} Channel ID or null if not configured
 */
export function getConfiguredChannel(guildId) {
  return configuredChannels[guildId] || null;
}

/**
 * Remove channel configuration for a guild
 * @param {string} guildId - Discord server ID
 */
export function removeChannelConfig(guildId) {
  if (configuredChannels[guildId]) {
    delete configuredChannels[guildId];
    return true;
  }
  return false;
}

/**
 * Start tracking a Leafs game for updates
 * @param {string} gameId - NHL API game ID
 * @returns {boolean} Success status
 */
export function startTrackingGame(gameId) {
  if (!activeGames[gameId]) {
    activeGames[gameId] = {
      lastUpdate: Date.now(),
      lastPeriod: '',
      lastHomeScore: 0,
      lastAwayScore: 0,
      lastTimeRemaining: '',
      scoreChanges: []
    };
    return true;
  }
  return false;
}

/**
 * Stop tracking a game
 * @param {string} gameId - NHL API game ID
 */
export function stopTrackingGame(gameId) {
  if (activeGames[gameId]) {
    delete activeGames[gameId];
    return true;
  }
  return false;
}

/**
 * Check for game updates and post to configured channels
 */
export async function checkForGameUpdates() {
  try {
    // Get current Leafs game
    const currentGame = await getCurrentLeafsGame();
    
    // If no game in progress, don't do anything
    if (!currentGame) {
      return;
    }
    
    const gameId = currentGame.gamePk;
    
    // Start tracking game if not already
    if (!activeGames[gameId]) {
      startTrackingGame(gameId);
    }
    
    // Get detailed game status
    const gameStatus = await getGameStatus(gameId);
    if (!gameStatus) return;
    
    const formattedGame = formatGameData(currentGame);
    const gameTracker = activeGames[gameId];
    
    // Check for score changes
    const homeScore = gameStatus.teams.home.goals;
    const awayScore = gameStatus.teams.away.goals;
    const currentPeriod = gameStatus.currentPeriodOrdinal;
    const timeRemaining = gameStatus.currentPeriodTimeRemaining;
    
    let update = null;
    
    // Score change
    if (homeScore !== gameTracker.lastHomeScore || awayScore !== gameTracker.lastAwayScore) {
      update = {
        type: 'SCORE_UPDATE',
        message: `🚨 GOAL! ${formattedGame.awayTeam} ${awayScore} - ${homeScore} ${formattedGame.homeTeam}`,
        formattedGame,
        logos: getTeamLogos(currentGame)
      };
    } 
    // Period change
    else if (currentPeriod !== gameTracker.lastPeriod) {
      update = {
        type: 'PERIOD_UPDATE',
        message: `Period update: Now ${currentPeriod}`,
        formattedGame,
        logos: getTeamLogos(currentGame)
      };
    }
    // Game ended
    else if (timeRemaining === 'Final' && gameTracker.lastTimeRemaining !== 'Final') {
      update = {
        type: 'GAME_END',
        message: `Game Final: ${formattedGame.awayTeam} ${awayScore} - ${homeScore} ${formattedGame.homeTeam}`,
        formattedGame,
        logos: getTeamLogos(currentGame)
      };
      
      // Stop tracking game
      stopTrackingGame(gameId);
    }
    
    // Update tracker
    if (activeGames[gameId]) {
      activeGames[gameId].lastHomeScore = homeScore;
      activeGames[gameId].lastAwayScore = awayScore;
      activeGames[gameId].lastPeriod = currentPeriod;
      activeGames[gameId].lastTimeRemaining = timeRemaining;
      activeGames[gameId].lastUpdate = Date.now();
    }
    
    // Send updates to all configured channels if there's an update
    if (update) {
      await sendGameUpdateToChannels(update);
    }
    
  } catch (error) {
    console.error('Error checking for game updates:', error);
  }
}

/**
 * Send game update to all configured channels
 * @param {Object} update - Update information
 */
async function sendGameUpdateToChannels(update) {
  for (const [guildId, channelId] of Object.entries(configuredChannels)) {
    try {
      const embed = createGameUpdateEmbed(update);
      
      await DiscordRequest(`channels/${channelId}/messages`, {
        method: 'POST',
        body: {
          embeds: [embed]
        }
      });
    } catch (error) {
      console.error(`Error sending update to guild ${guildId}, channel ${channelId}:`, error);
    }
  }
}

/**
 * Create a Discord embed for game updates
 * @param {Object} update - Update information
 * @returns {Object} Discord embed object
 */
function createGameUpdateEmbed(update) {
  const { formattedGame, logos } = update;
  
  // Choose color based on game state
  let color = 0x1976D2; // Blue for general updates
  if (update.type === 'SCORE_UPDATE') {
    color = 0x4CAF50; // Green for goals
  } else if (update.type === 'GAME_END') {
    color = 0x9C27B0; // Purple for game end
  }
  
  // Create the base embed
  const embed = {
    title: update.message,
    color: color,
    fields: [
      {
        name: formattedGame.awayTeam,
        value: `${formattedGame.awayScore}`,
        inline: true
      },
      {
        name: 'VS',
        value: `${formattedGame.period} ${formattedGame.timeRemaining}`,
        inline: true
      },
      {
        name: formattedGame.homeTeam,
        value: `${formattedGame.homeScore}`,
        inline: true
      }
    ],
    footer: {
      text: `Game Status: ${formattedGame.status}`
    },
    timestamp: new Date().toISOString()
  };
  
  // Add team logos if available
  if (logos) {
    embed.thumbnail = {
      url: formattedGame.isLeafsHome ? logos.homeTeamLogo : logos.awayTeamLogo
    };
  }
  
  return embed;
}

/**
 * Start the game update checker at an interval
 * @param {number} intervalMs - Interval in milliseconds
 */
export function startGameUpdateChecker(intervalMs = 60000) {
  // Check every minute by default
  setInterval(checkForGameUpdates, intervalMs);
  console.log(`Started game update checker with interval of ${intervalMs}ms`);
}

/**
 * Get embed for next Leafs game
 */
export async function getNextGameEmbed() {
  const nextGame = await getNextLeafsGame();
  if (!nextGame) {
    return {
      title: "No upcoming Maple Leafs games found",
      color: 0x1976D2,
      description: "There are no scheduled Toronto Maple Leafs games in the near future."
    };
  }
  
  const formattedGame = formatGameData(nextGame);
  const logos = getTeamLogos(nextGame);
  
  // Format the game time
  const gameTime = new Date(nextGame.gameDate);
  const formattedTime = gameTime.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });
  
  return {
    title: "Next Toronto Maple Leafs Game",
    color: 0x00205B, // Leafs blue
    description: `${formattedGame.awayTeam} at ${formattedGame.homeTeam}`,
    fields: [
      {
        name: "Game Time",
        value: formattedTime
      },
      {
        name: "Venue",
        value: nextGame.venue.name
      }
    ],
    thumbnail: {
      url: formattedGame.isLeafsHome ? logos.homeTeamLogo : logos.awayTeamLogo
    },
    footer: {
      text: "Data from NHL API"
    },
    timestamp: new Date().toISOString()
  };
}
