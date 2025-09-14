import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Events, Collection, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { 
  getCurrentLeafsGame, 
  getNextLeafsGame, 
  getGameStatus, 
  formatGameData, 
  getTeamLogos,
  testNHLAPI
} from './nhl-api.js';

// Create a new Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// Store channels configured for game updates
const configuredChannels = new Collection();
// Store active games being tracked
const activeGames = new Collection();

// Command setup
const commands = [
  new SlashCommandBuilder()
    .setName('test')
    .setDescription('Basic command to test if the bot is working'),
    
  new SlashCommandBuilder()
    .setName('setup-leafs-updates')
    .setDescription('Configure which channel to post Maple Leafs game updates to')
    .addChannelOption(option => 
      option.setName('channel')
        .setDescription('The channel where game updates will be posted')
        .setRequired(true)),
        
  new SlashCommandBuilder()
    .setName('stop-leafs-updates')
    .setDescription('Stop posting Maple Leafs game updates in this server'),
    
  new SlashCommandBuilder()
    .setName('next-leafs-game')
    .setDescription('Get information about the next Toronto Maple Leafs game')
];

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, readyClient => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
  
  // Start checking for game updates every minute
  startGameUpdateChecker(60000);
});

// Handle slash commands
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // Test command
  if (commandName === 'test') {
    await interaction.reply({
      content: `Hello! The bot is working properly! 🏒`,
      ephemeral: false
    });
  }
  
  // Setup Leafs updates command
  else if (commandName === 'setup-leafs-updates') {
    const channel = interaction.options.getChannel('channel');
    
    // Check if the channel is a text channel
    if (!channel.isTextBased()) {
      return interaction.reply({
        content: `⚠️ ${channel} is not a text channel. Please select a text channel.`,
        ephemeral: true
      });
    }
    
    // Configure the channel
    configuredChannels.set(interaction.guild.id, channel.id);
    
    await interaction.reply({
      content: `✅ Maple Leafs game updates will now be posted to ${channel}! You'll receive updates for goals, period changes, and game results.`,
      ephemeral: false
    });
  }
  
  // Stop Leafs updates command
  else if (commandName === 'stop-leafs-updates') {
    const removed = configuredChannels.delete(interaction.guild.id);
    
    await interaction.reply({
      content: removed 
        ? `✅ Maple Leafs game updates have been stopped for this server.` 
        : `⚠️ This server was not configured for Maple Leafs game updates.`,
      ephemeral: false
    });
  }
  
  // Next Leafs game command
  else if (commandName === 'next-leafs-game') {
    await interaction.deferReply();
    
    try {
      const embed = await getNextGameEmbed();
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error handling next-leafs-game command:', error);
      await interaction.editReply({
        content: `Sorry, there was an error getting the next game information. Please try again later.`
      });
    }
  }
  
  // Test NHL API command
  else if (commandName === 'test-nhl-api') {
    await interaction.deferReply();
    
    try {
      console.log('Running NHL API test...');
      const testResults = await testNHLAPI();
      
      // Create embed with test results
      const embed = new EmbedBuilder()
        .setTitle('NHL API Test Results')
        .setColor(testResults.overallStatus ? 0x00FF00 : 0xFF0000) // Green if success, red if failure
        .addFields(
          { 
            name: 'Overall Status', 
            value: testResults.overallStatus ? '✅ PASS' : '❌ FAIL', 
            inline: true 
          },
          { 
            name: 'API Connection', 
            value: testResults.apiConnection ? '✅ Connected' : '❌ Failed', 
            inline: true 
          },
          { 
            name: 'Schedule Endpoint', 
            value: testResults.scheduleEndpoint ? '✅ Working' : '❌ Failed', 
            inline: true 
          },
          { 
            name: 'Data Structure', 
            value: testResults.dataStructure ? '✅ Valid' : '❌ Invalid', 
            inline: true 
          }
        )
        .setTimestamp();

      // Add details if available
      if (testResults.details.gamesFound !== undefined) {
        embed.addFields({
          name: 'Games Found',
          value: `${testResults.details.gamesFound} games in current week`,
          inline: true
        });
      }

      if (testResults.details.sampleGame) {
        const game = testResults.details.sampleGame;
        embed.addFields({
          name: 'Sample Game',
          value: `${game.awayTeam} @ ${game.homeTeam}\nState: ${game.gameState}\nID: ${game.id}`,
          inline: false
        });
      }

      if (testResults.details.standingsTest !== undefined) {
        embed.addFields({
          name: 'Secondary Endpoint Test',
          value: testResults.details.standingsTest ? '✅ Standings API working' : '⚠️ Standings API failed (non-critical)',
          inline: true
        });
      }

      // Add errors if any
      if (testResults.errors.length > 0) {
        embed.addFields({
          name: 'Errors',
          value: testResults.errors.join('\n'),
          inline: false
        });
      }

      if (testResults.details.note) {
        embed.addFields({
          name: 'Note',
          value: testResults.details.note,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error running NHL API test:', error);
      await interaction.editReply({
        content: `❌ Failed to run NHL API test: ${error.message}`
      });
    }
  }
});

/**
 * Start the game update checker at an interval
 * @param {number} intervalMs - Interval in milliseconds
 */
function startGameUpdateChecker(intervalMs = 60000) {
  // Check every minute by default
  setInterval(checkForGameUpdates, intervalMs);
  console.log(`Started game update checker with interval of ${intervalMs}ms`);
}

/**
 * Check for game updates and post to configured channels
 */
async function checkForGameUpdates() {
  try {
    // Get current Leafs game
    const currentGame = await getCurrentLeafsGame();
    
    // If no game in progress, don't do anything
    if (!currentGame) {
      return;
    }
    
    const gameId = currentGame.gamePk;
    
    // Start tracking game if not already
    if (!activeGames.has(gameId)) {
      activeGames.set(gameId, {
        lastUpdate: Date.now(),
        lastPeriod: '',
        lastHomeScore: 0,
        lastAwayScore: 0,
        lastTimeRemaining: '',
        scoreChanges: []
      });
    }
    
    // Get detailed game status
    const gameStatus = await getGameStatus(gameId);
    if (!gameStatus) return;
    
    const formattedGame = formatGameData(currentGame);
    const gameTracker = activeGames.get(gameId);
    
    // Check for score changes
    const homeScore = gameStatus.teams.home.goals;
    const awayScore = gameStatus.teams.away.goals;
    const currentPeriod = gameStatus.currentPeriodOrdinal;
    const timeRemaining = gameStatus.currentPeriodTimeRemaining;
    
    let update = null;

    // Keep formattedGame in sync with live linescore values so embeds show correct scores/time
    if (formattedGame) {
      formattedGame.homeScore = homeScore;
      formattedGame.awayScore = awayScore;
      formattedGame.period = currentPeriod || formattedGame.period;
      formattedGame.timeRemaining = timeRemaining || formattedGame.timeRemaining;
      formattedGame.status = gameStatus?.currentPeriodTimeRemaining === 'Final' ? 'Final' : formattedGame.status;
    }
    
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
      activeGames.delete(gameId);
    }
    
    // Update tracker
    if (activeGames.has(gameId)) {
      const tracker = activeGames.get(gameId);
      tracker.lastHomeScore = homeScore;
      tracker.lastAwayScore = awayScore;
      tracker.lastPeriod = currentPeriod;
      tracker.lastTimeRemaining = timeRemaining;
      tracker.lastUpdate = Date.now();
      activeGames.set(gameId, tracker);
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
  for (const [guildId, channelId] of configuredChannels.entries()) {
    try {
      const embed = createGameUpdateEmbed(update);
      
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;
      
      const channel = guild.channels.cache.get(channelId);
      if (!channel) continue;
      
      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error(`Error sending update to guild ${guildId}, channel ${channelId}:`, error);
    }
  }
}

/**
 * Create a Discord embed for game updates
 * @param {Object} update - Update information
 * @returns {EmbedBuilder} Discord embed object
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
  
  // Create the embed
  const embed = new EmbedBuilder()
    .setTitle(update.message)
    .setColor(color)
    .addFields(
      { name: formattedGame.awayTeam, value: `${formattedGame.awayScore}`, inline: true },
      { name: 'VS', value: `${formattedGame.period} ${formattedGame.timeRemaining}`, inline: true },
      { name: formattedGame.homeTeam, value: `${formattedGame.homeScore}`, inline: true }
    )
    .setFooter({ text: `Game Status: ${formattedGame.status}` })
    .setTimestamp();
  
  // Add team logos if available
  if (logos) {
    embed.setThumbnail(formattedGame.isLeafsHome ? logos.homeTeamLogo : logos.awayTeamLogo);
  }
  
  return embed;
}

/**
 * Get embed for next Leafs game
 */
async function getNextGameEmbed() {
  const nextGame = await getNextLeafsGame();
  if (!nextGame) {
    return new EmbedBuilder()
      .setTitle("No upcoming Maple Leafs games found")
      .setColor(0x1976D2)
      .setDescription("There are no scheduled Toronto Maple Leafs games in the near future.");
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
  
  const embed = new EmbedBuilder()
    .setTitle("Next Toronto Maple Leafs Game")
    .setColor(0x00205B) // Leafs blue
    .setDescription(`${formattedGame.awayTeam} at ${formattedGame.homeTeam}`)
    .addFields(
      { name: "Game Time", value: formattedTime },
      { name: "Venue", value: nextGame.venue.name }
    )
    .setFooter({ text: "Data from NHL API" })
    .setTimestamp();
  
  if (logos) {
    embed.setThumbnail(formattedGame.isLeafsHome ? logos.homeTeamLogo : logos.awayTeamLogo);
  }
  
  return embed;
}

// Login to Discord with your app's token
client.login(process.env.DISCORD_TOKEN);
