import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Events, Collection, SlashCommandBuilder, EmbedBuilder, REST, Routes } from 'discord.js';
import { createServer } from 'http';
import { 
  getCurrentLeafsGame, 
  getNextLeafsGame, 
  getGameStatus, 
  formatGameData, 
  getTeamLogos,
  testNHLAPI,
  getGameFeed
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
  ,
  new SlashCommandBuilder()
    .setName('test-nhl-api')
    .setDescription('Test NHL API connection and functionality'),
    
  new SlashCommandBuilder()
    .setName('test-goal')
    .setDescription('Simulate a goal notification for testing (dev/testing only)')
    .addStringOption(option =>
      option.setName('team')
        .setDescription('Team abbreviation that scored (default: TOR)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('scorer')
        .setDescription('Scorer name (default: Auston Matthews)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('period')
        .setDescription('Period number (default: 1)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(5))
    .addStringOption(option =>
      option.setName('time')
        .setDescription('Time in period (default: 10:00)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('strength')
        .setDescription('Goal strength (default: EV)')
        .setRequired(false)
        .addChoices(
          { name: 'Even Strength', value: 'EV' },
          { name: 'Power Play', value: 'PP' },
          { name: 'Short Handed', value: 'SH' },
          { name: 'Empty Net', value: 'EN' },
          { name: 'Penalty Shot', value: 'PS' }
        ))
    .addBooleanOption(option =>
      option.setName('force')
        .setDescription('Force execution in production (default: false)')
        .setRequired(false))
];

// Add memory monitoring function
function logMemoryUsage() {
  const used = process.memoryUsage();
  console.log(`📊 Memory Usage: RSS ${Math.round(used.rss / 1024 / 1024)}MB, Heap ${Math.round(used.heapUsed / 1024 / 1024)}MB`);
}

// Add error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Log but don't exit - try to continue running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Log but don't exit - try to continue running
});

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, readyClient => {
  console.log(`✅ Ready! Logged in as ${readyClient.user.tag}`);
  console.log(`📊 Bot is in ${readyClient.guilds.cache.size} servers`);
  console.log(`🕐 Bot started at: ${new Date().toISOString()}`);
  
  // Start checking for game updates every minute
  startGameUpdateChecker(60000);
  
  // Log uptime and memory usage every hour
  setInterval(() => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    console.log(`⏱️ Bot uptime: ${hours}h ${minutes}m`);
    logMemoryUsage();
  }, 60 * 60 * 1000); // Every hour
  
  // Log memory usage every 30 minutes
  setInterval(logMemoryUsage, 30 * 60 * 1000);

  // Register slash commands per guild for instant availability
  registerCommandsPerGuild(commands).catch(err => {
    console.error('Error registering guild commands:', err);
  });
  
  // Add keepalive mechanism for Render (prevent sleeping)
  if (process.env.NODE_ENV === 'production') {
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://blus-stupid-nhl-bot.onrender.com';
    
    setInterval(async () => {
      try {
        const response = await fetch(`${RENDER_URL}/health`);
        console.log(`🏓 Keepalive ping: ${response.status}`);
      } catch (error) {
        console.log('🏓 Keepalive ping failed:', error.message);
      }
    }, 14 * 60 * 1000); // Every 14 minutes
  }
});

// Add Discord connection event handlers
client.on('disconnect', (event) => {
  console.log(`❌ Disconnected from Discord (Code: ${event.code})`);
});

client.on('reconnecting', () => {
  console.log(`🔄 Bot reconnecting to Discord...`);
});

client.on('resume', () => {
  console.log(`✅ Resumed connection to Discord`);
});

client.on('error', (error) => {
  console.error('❌ Discord client error:', error);
});

client.on('warn', (warning) => {
  console.warn('⚠️ Discord client warning:', warning);
});

async function registerCommandsPerGuild(builders) {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  const body = builders.map(b => b.toJSON());
  const appId = process.env.APP_ID;
  if (!appId) {
    console.warn('APP_ID is not set; cannot register guild commands.');
    return;
  }
  const guilds = [...client.guilds.cache.values()];
  if (guilds.length === 0) {
    console.warn('Bot is not in any guilds yet; slash commands will be registered when invited.');
    return;
  }
  console.log(`Registering ${body.length} commands in ${guilds.length} guild(s)...`);
  for (const guild of guilds) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(appId, guild.id),
        { body }
      );
      console.log(`Registered commands in guild ${guild.name} (${guild.id}).`);
    } catch (e) {
      console.error(`Failed to register commands in guild ${guild.id}:`, e);
    }
  }
}

// Add timeout wrapper function
function withTimeout(promise, timeoutMs = 25000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    )
  ]);
}

// Handle slash commands
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
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
      const embed = await withTimeout(getNextGameEmbed(), 25000);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error handling next-leafs-game command:', error);
      await interaction.editReply({
        content: `Sorry, there was an error getting the next game information. Please try again later.\nError: ${error.message}`
      });
    }
  }
  
  // Test NHL API command
  else if (commandName === 'test-nhl-api') {
    await interaction.deferReply();
    
    try {
      console.log('Running NHL API test...');
      const testResults = await withTimeout(testNHLAPI(), 25000);
      
      // Create embed with test results
      const embed = new EmbedBuilder()
        .setTitle('NHL API Test Results')
        .setColor(testResults?.overallStatus ? 0x00FF00 : 0xFF0000)
        .addFields(
          { name: 'Overall Status', value: testResults?.overallStatus ? '✅ PASS' : '❌ FAIL', inline: true },
          { name: 'API Connection', value: testResults?.apiConnection ? '✅ Connected' : '❌ Failed', inline: true },
          { name: 'Schedule Endpoint', value: testResults?.scheduleEndpoint ? '✅ Working' : '❌ Failed', inline: true },
          { name: 'Data Structure', value: testResults?.dataStructure ? '✅ Valid' : '❌ Invalid', inline: true }
        )
        .setTimestamp();

      // Add details if available
      if (testResults.details.gamesFound !== undefined) {
        embed.addFields({
          name: 'Games Found',
          value: testResults.details.gamesFound !== undefined && testResults.details.gamesFound !== null ? String(testResults.details.gamesFound) + ' games in current week' : 'TBD',
          inline: true
        });
      }

      if (testResults.details.sampleGame) {
        const game = testResults.details.sampleGame;
        embed.addFields({
          name: 'Sample Game',
          value: `${typeof game.awayTeam === 'string' && game.awayTeam.trim() ? game.awayTeam : 'Unknown'} @ ${typeof game.homeTeam === 'string' && game.homeTeam.trim() ? game.homeTeam : 'Unknown'}\nState: ${typeof game.gameState === 'string' && game.gameState.trim() ? game.gameState : 'Unknown'}\nID: ${game.id !== undefined && game.id !== null ? game.id : 'Unknown'}`,
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
          value: Array.isArray(testResults.errors) && testResults.errors.length > 0 ? testResults.errors.filter(e => typeof e === 'string' && e.trim()).join('\n') || 'Unknown error' : 'Unknown error',
          inline: false
        });
      }

      if (testResults.details.note) {
        embed.addFields({
          name: 'Note',
          value: typeof testResults.details.note === 'string' && testResults.details.note.trim() ? testResults.details.note : 'No note',
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
  
  // Test goal command
  else if (commandName === 'test-goal') {
    // Check environment restrictions
    const isDev = process.env.NODE_ENV !== 'production';
    const force = interaction.options.getBoolean('force') || false;
    
    if (!isDev && !force) {
      return interaction.reply({
        content: '⚠️ This command is only available in development/testing environments. Use `force: true` to override in production.',
        ephemeral: true
      });
    }
    
    // Check if there's a configured channel for this guild
    const channelId = configuredChannels.get(interaction.guild.id);
    if (!channelId) {
      return interaction.reply({
        content: '⚠️ No channel configured for game updates. Please run `/setup-leafs-updates` first.',
        ephemeral: true
      });
    }
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Get command options with defaults
      const team = interaction.options.getString('team') || 'TOR';
      const scorer = interaction.options.getString('scorer') || 'Auston Matthews';
      const period = interaction.options.getInteger('period') || 1;
      const time = interaction.options.getString('time') || '10:00';
      const strength = interaction.options.getString('strength') || 'EV';
      
      // For TOR, make them the home team; otherwise, make the scoring team away
      const isToronto = team === 'TOR';
      
      // Create simulated goal embed
      const simulatedGoalEmbed = createGoalEmbed({
        scorer: `${scorer} #34`,
        assists: 'William Nylander #88, Mitchell Marner #16',
        strength: strength,
        period: period > 3 ? 'OT' : `P${period}`,
        timeInPeriod: time,
        homeScore: isToronto ? 2 : 1,
        awayScore: isToronto ? 1 : 2,
        homeTeam: isToronto ? 'TOR' : 'OPP',
        awayTeam: isToronto ? 'OPP' : team,
        teamAbbrev: team,
        shotType: 'wrist',
        logos: {
          homeTeamLogo: `https://assets.nhle.com/logos/nhl/svg/${isToronto ? 'TOR' : 'OPP'}_light.svg`,
          awayTeamLogo: `https://assets.nhle.com/logos/nhl/svg/${isToronto ? 'OPP' : team}_light.svg`
        }
      });
      
      // Send to configured channel (same path as real goals)
      await sendGoalToChannels(simulatedGoalEmbed);
      
      // Log the simulated payload
      console.log('🧪 Test goal simulated:', {
        team,
        scorer,
        period,
        time,
        strength,
        guildId: interaction.guild.id,
        channelId
      });
      
      await interaction.editReply({
        content: `✅ Test goal notification sent to <#${channelId}>!\n\n**Simulated Data:**\n- Team: ${team}\n- Scorer: ${scorer}\n- Period: ${period > 3 ? 'OT' : `P${period}`}\n- Time: ${time}\n- Strength: ${strength}`
      });
    } catch (error) {
      console.error('Error handling test-goal command:', error);
      await interaction.editReply({
        content: `❌ Failed to send test goal: ${error.message}`
      });
    }
  }
  
  // Handle unknown commands
  else {
    await interaction.reply({
      content: `Unknown command: ${commandName}`,
      ephemeral: true
    });
  }
  
  } catch (error) {
    console.error('Error handling interaction:', error);
    
    // Try to respond if we haven't already
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Sorry, there was an error processing your command. Please try again.',
          ephemeral: true
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: 'Sorry, there was an error processing your command. Please try again.'
        });
      }
    } catch (responseError) {
      console.error('Error sending error response:', responseError);
    }
  }
});

// Add guild join event to register commands when bot joins new servers
client.on(Events.GuildCreate, async guild => {
  console.log(`Joined guild: ${guild.name} (${guild.id})`);
  try {
    await registerCommandsInGuild(guild);
  } catch (error) {
    console.error(`Failed to register commands in new guild ${guild.id}:`, error);
  }
});

async function registerCommandsInGuild(guild) {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  const body = commands.map(b => b.toJSON());
  const appId = process.env.APP_ID;
  
  if (!appId) {
    console.warn('APP_ID is not set; cannot register guild commands.');
    return;
  }
  
  await rest.put(
    Routes.applicationGuildCommands(appId, guild.id),
    { body }
  );
  console.log(`Registered commands in guild ${guild.name} (${guild.id}).`);
}

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
    
    const gameId = currentGame.id || currentGame.gamePk;
    
    // Start tracking game if not already
    if (!activeGames.has(gameId)) {
      activeGames.set(gameId, {
        lastUpdate: Date.now(),
        lastPeriod: '',
        lastHomeScore: 0,
        lastAwayScore: 0,
        lastTimeRemaining: '',
        lastScoringIdx: -1,  // Track last processed scoring event
        scoreChanges: []
      });
      console.log(`🏒 Started tracking game ${gameId}`);
    }
    
    // Get detailed game status (landing endpoint)
    const gameStatus = await getGameStatus(gameId);
    if (!gameStatus) return;
    
    // Get play-by-play data for goal detection
    const gameFeed = await getGameFeed(gameId);
    if (!gameFeed) {
      console.log(`⚠️ No play-by-play data available for game ${gameId}`);
      return;
    }
    
    const formattedGame = formatGameData(currentGame);
    const gameTracker = activeGames.get(gameId);
    
    // Extract current score and game state from landing endpoint
    const homeScore = gameStatus.homeTeam?.score ?? 0;
    const awayScore = gameStatus.awayTeam?.score ?? 0;
    const currentPeriod = gameStatus.periodDescriptor?.number ?? gameStatus.period ?? 1;
    const periodType = gameStatus.periodDescriptor?.periodType ?? 'REG';
    const timeRemaining = gameStatus.clock?.timeRemaining ?? '';
    const gameState = gameStatus.gameState ?? '';
    
    // Format period display
    let currentPeriodOrdinal = '';
    if (periodType === 'OT') {
      currentPeriodOrdinal = 'OT';
    } else if (periodType === 'SO') {
      currentPeriodOrdinal = 'SO';
    } else {
      currentPeriodOrdinal = `P${currentPeriod}`;
    }

    // Keep formattedGame in sync with live values
    if (formattedGame) {
      formattedGame.homeScore = homeScore;
      formattedGame.awayScore = awayScore;
      formattedGame.period = currentPeriodOrdinal;
      formattedGame.timeRemaining = timeRemaining;
      formattedGame.status = gameState === 'OFF' || gameState === 'FINAL' ? 'Final' : formattedGame.status;
    }
    
    // Parse scoring plays from play-by-play data
    const plays = gameFeed.plays || [];
    const scoringPlays = plays.filter(p => p.typeDescKey === 'goal');
    
    console.log(`📊 Game ${gameId}: Found ${scoringPlays.length} total goals, last processed index: ${gameTracker.lastScoringIdx}`);
    
    // Process new scoring plays
    for (let i = gameTracker.lastScoringIdx + 1; i < scoringPlays.length; i++) {
      const goalEvent = scoringPlays[i];
      
      console.log(`🚨 New goal detected at index ${i}:`, {
        eventId: goalEvent.eventId,
        period: goalEvent.periodDescriptor?.number,
        time: goalEvent.timeInPeriod,
        team: goalEvent.details?.eventOwnerTeamId
      });
      
      // Extract goal details with safe fallbacks
      const details = goalEvent.details || {};
      const scoringPlayer = details.scoringPlayer || {};
      const scoringPlayerName = `${scoringPlayer.firstName?.default || ''} ${scoringPlayer.lastName?.default || ''}`.trim();
      const scoringPlayerNumber = scoringPlayer.sweaterNumber ? `#${scoringPlayer.sweaterNumber}` : '';
      const scorer = scoringPlayerName 
        ? `${scoringPlayerName} ${scoringPlayerNumber}`.trim()
        : 'Unknown';
      
      // Build assists string
      const assistPlayers = details.assists || [];
      const assists = assistPlayers.length > 0
        ? assistPlayers.map(a => {
            const name = `${a.firstName?.default || ''} ${a.lastName?.default || ''}`.trim();
            const num = a.sweaterNumber ? `#${a.sweaterNumber}` : '';
            return name ? `${name} ${num}`.trim() : '';
          }).filter(a => a).join(', ')
        : 'Unassisted';
      
      // Determine strength
      let strength = 'EV'; // Even strength default
      
      // Check for explicit strength field first (most reliable)
      if (details.strength) {
        strength = details.strength.toUpperCase();
      } 
      // Check for penalty shot
      else if (details.shotType === 'penalty-shot') {
        strength = 'PS';
      }
      // Check for empty net (this can combine with other strengths)
      else if (details.goalModifier === 'empty-net') {
        strength = 'EN';
      }
      // Fallback: Try to parse from situation code if no explicit strength
      else if (goalEvent.situationCode) {
        // Situation code format analysis (best effort)
        // Typically: first 2 digits indicate away/home strength
        const situationCode = goalEvent.situationCode;
        const awayCode = situationCode.charAt(0);
        const homeCode = situationCode.charAt(1);
        
        // If codes differ, one team has numerical advantage
        if (awayCode !== homeCode) {
          const scoringTeamId = details.eventOwnerTeamId;
          const isHomeTeam = scoringTeamId === (currentGame.homeTeam?.abbrev || '');
          
          // Lower code value typically means more players (1=5, 2=4, etc.)
          if (isHomeTeam) {
            strength = homeCode < awayCode ? 'PP' : 'SH';
          } else {
            strength = awayCode < homeCode ? 'PP' : 'SH';
          }
        }
      }
      
      // Format period and time
      const periodDesc = goalEvent.periodDescriptor || {};
      let period = '';
      if (periodDesc.periodType === 'OT') {
        period = 'OT';
      } else if (periodDesc.periodType === 'SO') {
        period = 'SO';
      } else {
        period = `P${periodDesc.number || currentPeriod}`;
      }
      
      const timeInPeriod = goalEvent.timeInPeriod || 'TBD';
      
      // Get scores after this goal
      const goalHomeScore = details.homeScore ?? homeScore;
      const goalAwayScore = details.awayScore ?? awayScore;
      
      // Get team abbreviations
      const homeTeamAbbrev = currentGame.homeTeam?.abbrev || formattedGame?.homeTeam || 'Home';
      const awayTeamAbbrev = currentGame.awayTeam?.abbrev || formattedGame?.awayTeam || 'Away';
      const scoringTeamAbbrev = details.eventOwnerTeamId || '';
      
      // Shot type
      const shotType = details.shotType || '';
      
      // Build goal embed
      const logos = getTeamLogos(currentGame);
      const goalEmbed = createGoalEmbed({
        scorer,
        assists,
        strength,
        period,
        timeInPeriod,
        homeScore: goalHomeScore,
        awayScore: goalAwayScore,
        homeTeam: homeTeamAbbrev,
        awayTeam: awayTeamAbbrev,
        teamAbbrev: scoringTeamAbbrev,
        shotType,
        logos
      });
      
      // Send goal update to all configured channels
      await sendGoalToChannels(goalEmbed);
    }
    
    // Update last scoring index
    if (scoringPlays.length > 0) {
      gameTracker.lastScoringIdx = scoringPlays.length - 1;
    }
    
    // Check for other updates (period changes, game end)
    let update = null;
    
    // Period change
    if (currentPeriodOrdinal !== gameTracker.lastPeriod && gameTracker.lastPeriod !== '') {
      update = {
        type: 'PERIOD_UPDATE',
        message: `Period update: Now ${currentPeriodOrdinal}`,
        formattedGame,
        logos: getTeamLogos(currentGame)
      };
    }
    // Game ended
    else if ((gameState === 'OFF' || gameState === 'FINAL') && gameTracker.lastTimeRemaining !== 'Final') {
      update = {
        type: 'GAME_END',
        message: `Game Final: ${formattedGame.awayTeam} ${awayScore} - ${homeScore} ${formattedGame.homeTeam}`,
        formattedGame,
        logos: getTeamLogos(currentGame)
      };
      
      console.log(`🏁 Game ${gameId} ended. Stopping tracking.`);
      // Stop tracking game
      activeGames.delete(gameId);
    }
    
    // Update tracker
    if (activeGames.has(gameId)) {
      const tracker = activeGames.get(gameId);
      tracker.lastHomeScore = homeScore;
      tracker.lastAwayScore = awayScore;
      tracker.lastPeriod = currentPeriodOrdinal;
      tracker.lastTimeRemaining = gameState === 'OFF' || gameState === 'FINAL' ? 'Final' : timeRemaining;
      tracker.lastUpdate = Date.now();
      activeGames.set(gameId, tracker);
    }
    
    // Send updates to all configured channels if there's a non-goal update
    if (update) {
      await sendGameUpdateToChannels(update);
    }
    
  } catch (error) {
    console.error('Error checking for game updates:', error);
  }
}

/**
 * Send goal embed to all configured channels
 * @param {EmbedBuilder} goalEmbed - Goal embed to send
 */
async function sendGoalToChannels(goalEmbed) {
  for (const [guildId, channelId] of configuredChannels.entries()) {
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;
      
      const channel = guild.channels.cache.get(channelId);
      if (!channel) continue;
      
      await channel.send({ embeds: [goalEmbed] });
      console.log(`✅ Goal update sent to guild ${guildId}, channel ${channelId}`);
    } catch (error) {
      console.error(`Error sending goal update to guild ${guildId}, channel ${channelId}:`, error);
    }
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
      {
        name: typeof formattedGame.awayTeam === 'string' && formattedGame.awayTeam.trim() ? formattedGame.awayTeam : 'Away',
        value: formattedGame.awayScore !== undefined && formattedGame.awayScore !== null ? String(formattedGame.awayScore) : 'TBD',
        inline: true
      },
      {
        name: 'VS',
        value: ((typeof formattedGame.period === 'string' && formattedGame.period.trim() ? formattedGame.period : 'TBD') + ' ' + (typeof formattedGame.timeRemaining === 'string' && formattedGame.timeRemaining.trim() ? formattedGame.timeRemaining : 'TBD')),
        inline: true
      },
      {
        name: typeof formattedGame.homeTeam === 'string' && formattedGame.homeTeam.trim() ? formattedGame.homeTeam : 'Home',
        value: formattedGame.homeScore !== undefined && formattedGame.homeScore !== null ? String(formattedGame.homeScore) : 'TBD',
        inline: true
      }
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
 * Create a Discord embed specifically for goal events
 * @param {Object} goalData - Goal event data
 * @returns {EmbedBuilder} Discord embed object
 */
function createGoalEmbed(goalData) {
  const {
    scorer,
    assists,
    strength,
    period,
    timeInPeriod,
    homeScore,
    awayScore,
    homeTeam,
    awayTeam,
    teamAbbrev,
    shotType,
    logos
  } = goalData;

  // Build title with current score
  const title = `🚨 GOAL! ${awayTeam || 'Away'} ${awayScore !== undefined ? awayScore : 'TBD'} – ${homeScore !== undefined ? homeScore : 'TBD'} ${homeTeam || 'Home'}`;

  // Create the embed
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(0x4CAF50) // Green for goals
    .setTimestamp();

  // Add fields
  const fields = [];

  // Scorer
  fields.push({
    name: '🏒 Scorer',
    value: typeof scorer === 'string' && scorer.trim() ? scorer : 'Unknown',
    inline: false
  });

  // Assists
  fields.push({
    name: '🎯 Assists',
    value: typeof assists === 'string' && assists.trim() ? assists : 'Unassisted',
    inline: false
  });

  // Strength and period/time on same line
  const strengthStr = typeof strength === 'string' && strength.trim() ? strength : 'EV';
  const periodStr = typeof period === 'string' && period.trim() ? period : 'TBD';
  const timeStr = typeof timeInPeriod === 'string' && timeInPeriod.trim() ? timeInPeriod : 'TBD';
  
  fields.push({
    name: '💪 Strength',
    value: strengthStr,
    inline: true
  });

  fields.push({
    name: '⏱️ Time',
    value: `${periodStr} ${timeStr}`,
    inline: true
  });

  // Shot type if available
  if (shotType && typeof shotType === 'string' && shotType.trim()) {
    fields.push({
      name: '🎯 Shot Type',
      value: shotType,
      inline: true
    });
  }

  embed.addFields(fields);

  // Add team logo
  if (logos) {
    // Show logo of the team that scored
    const scoringTeamLogo = teamAbbrev === homeTeam ? logos.homeTeamLogo : logos.awayTeamLogo;
    if (scoringTeamLogo) {
      embed.setThumbnail(scoringTeamLogo);
    }
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
  
  // Format the game time in US Eastern Time (EST/EDT)
  const gameTime = new Date(nextGame.gameDate);
  const formattedTime = gameTime.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short'
  });
  
  const embed = new EmbedBuilder()
    .setTitle("Next Toronto Maple Leafs Game")
    .setColor(0x00205B) // Leafs blue
    .setDescription(`${formattedGame.awayTeam} at ${formattedGame.homeTeam}`)
    .addFields(
      { name: "Game Time", value: typeof formattedTime === 'string' && formattedTime.trim() ? formattedTime : "TBD" },
      { name: "Venue", value: nextGame.venue?.name && typeof nextGame.venue.name === 'string' && nextGame.venue.name.trim() ? nextGame.venue.name : "TBD" }
    )
    .setFooter({ text: "Data from NHL API" })
    .setTimestamp();
  
  if (logos) {
    embed.setThumbnail(formattedGame.isLeafsHome ? logos.homeTeamLogo : logos.awayTeamLogo);
  }
  
  return embed;
}

// Create HTTP server for Render deployment (web service health/port binding)
const server = createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        bot: client.user?.tag || 'starting...',
        uptime: process.uptime(),
      })
    );
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
});

// Login to Discord with your app's token
client.login(process.env.DISCORD_TOKEN);
