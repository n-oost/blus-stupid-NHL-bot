import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Events, Collection, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { 
  getCurrentLeafsGame, 
  getNextLeafsGame, 
  getGameStatus, 
  formatGameData, 
  getTeamLogos 
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
    .setDescription('Get information about the next Toronto Maple Leafs game'),
  new SlashCommandBuilder()
    .setName('simulate-leafs-goal')
    .setDescription('Simulate a Leafs goal update for testing (admin only)')
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
  // Simulate Leafs goal command
  else if (commandName === 'simulate-leafs-goal') {
    // Only allow server admins to use this command
    if (!interaction.memberPermissions || !interaction.memberPermissions.has('Administrator')) {
      return interaction.reply({
        content: 'You must be a server administrator to use this command.',
        ephemeral: true
      });
    }
    // Find the configured channel for this guild
    const channelId = configuredChannels.get(interaction.guild.id);
    if (!channelId) {
      return interaction.reply({
        content: 'No channel is configured for Leafs updates. Use /setup-leafs-updates first.',
        ephemeral: true
      });
    }
    // Create a fake update
    const update = {
      type: 'SCORE_UPDATE',
      message: '🚨 GOAL! Toronto Maple Leafs 1 - 0 Montreal Canadiens',
      formattedGame: {
        awayTeam: 'Montreal Canadiens',
        homeTeam: 'Toronto Maple Leafs',
      },
      logos: {
        home: 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/10.svg',
        away: 'https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/8.svg',
      }
    };
    // Send the update to the configured channel
    const embed = {
      title: update.message,
      color: 0x1976D2,
      description: `${update.formattedGame.awayTeam} vs ${update.formattedGame.homeTeam}`,
      thumbnail: { url: update.logos.home },
      footer: { text: 'Simulated update for testing' }
    };
    try {
      await interaction.client.channels.cache.get(channelId).send({ embeds: [embed] });
      await interaction.reply({ content: 'Simulated Leafs goal update sent!', ephemeral: true });
    } catch (error) {
      console.error('Error sending simulated update:', error);
      await interaction.reply({ content: 'Failed to send simulated update. Check bot permissions.', ephemeral: true });
    }
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
 * Check if today is within the NHL season (October 1 to June 30)
 * @returns {boolean}
 */
function isHockeySeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // JS months are 0-based
  const day = now.getDate();
  // Regular season: October 1 (10/1) to June 30 (6/30) of next year
  // If month is 7, 8, or 9 (July, August, September), it's off-season
  if (month >= 10 || month <= 6) {
    // If it's June, only include up to June 30
    if (month === 6 && day > 30) return false;
    return true;
  }
  return false;
}

/**
 * Check for game updates and post to configured channels
 */
async function checkForGameUpdates() {
  if (!isHockeySeason()) {
    // Optionally log or notify that it's off-season
    console.log('Skipping NHL API check: not hockey season.');
    return;
  }
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
