import 'dotenv/config';
import fetch from 'node-fetch';

// NHL API base URL
const NHL_API_BASE = 'https://statsapi.web.nhl.com/api/v1';

// Toronto Maple Leafs team ID in NHL API
const LEAFS_TEAM_ID = 10;

// Toggle whether to perform/announce an explicit "season" check.
// Set ENABLE_SEASON_CHECK=true in your .env to restore the old behaviour that
// logs and early-returns when there's no scheduled hockey ("not hockey season").
// By default this is disabled so the bot quietly returns null when no games exist.
const ENABLE_SEASON_CHECK = process.env.ENABLE_SEASON_CHECK === 'true';

/**
 * Get the next scheduled game for the Toronto Maple Leafs
 * @returns {Promise<Object>} Next game information
 */
export async function getNextLeafsGame() {
  try {
    const response = await fetch(`${NHL_API_BASE}/schedule?teamId=${LEAFS_TEAM_ID}&expand=schedule.broadcasts,schedule.linescore`);
    const data = await response.json();
    
    // Check if there are any games
      if (!data.dates || data.dates.length === 0 || !data.dates[0].games || data.dates[0].games.length === 0) {
        if (ENABLE_SEASON_CHECK) {
          console.log('Skipping NHL API check: not hockey season (no upcoming games)');
        }
        return null;
      }
    
    return data.dates[0].games[0];
  } catch (error) {
    console.error('Error fetching next Leafs game:', error);
    return null;
  }
}

/**
 * Get current game status for a specific game
 * @param {string} gameId - The NHL API game ID
 * @returns {Promise<Object>} Current game information with detailed linescore
 */
export async function getGameStatus(gameId) {
  try {
    const response = await fetch(`${NHL_API_BASE}/game/${gameId}/linescore`);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching game status for game ${gameId}:`, error);
    return null;
  }
}

/**
 * Get boxscore information for a specific game (includes detailed stats)
 * @param {string} gameId - The NHL API game ID
 * @returns {Promise<Object>} Boxscore information
 */
export async function getGameBoxscore(gameId) {
  try {
    const response = await fetch(`${NHL_API_BASE}/game/${gameId}/boxscore`);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching boxscore for game ${gameId}:`, error);
    return null;
  }
}

/**
 * Check if the Leafs are currently playing a game
 * @returns {Promise<Object|null>} Game object if playing, null if not
 */
export async function getCurrentLeafsGame() {
  try {
    const response = await fetch(`${NHL_API_BASE}/schedule?teamId=${LEAFS_TEAM_ID}&expand=schedule.linescore`);
    const data = await response.json();
    
    // Check if there are any games today
    if (!data.dates || data.dates.length === 0 || !data.dates[0].games || data.dates[0].games.length === 0) {
    }
    
    const game = data.dates[0].games[0];
    
    // Check if the game is in progress
  } catch (error) {
    console.error('Error checking current Leafs game:', error);
    return null;
  }
}

/**
 * Format game data into a readable string
 * @param {Object} game - Game data from NHL API
 * @returns {Object} Formatted game information
 */
export function formatGameData(game) {
  if (!game) return null;
  
  const homeTeam = game.teams.home.team.name;
  const awayTeam = game.teams.away.team.name;
  const homeScore = game.teams.home.score;
  const awayScore = game.teams.away.score;
  const status = game.status.detailedState;
  const period = game.linescore?.currentPeriodOrdinal || '';
  const timeRemaining = game.linescore?.currentPeriodTimeRemaining || '';
  
  return {
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    status,
    period,
    timeRemaining,
    gameId: game.gamePk,
    startTime: new Date(game.gameDate),
    isLeafsHome: homeTeam === 'Toronto Maple Leafs'
  };
}

/**
 * Get team logos for both teams in a game
 * @param {Object} game - Game data
 * @returns {Object} Object with home and away team logo URLs
 */
export function getTeamLogos(game) {
  if (!game) return null;
  
  const homeTeamId = game.teams.home.team.id;
  const awayTeamId = game.teams.away.team.id;
  
  return {
    homeTeamLogo: `https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/${homeTeamId}.svg`,
    awayTeamLogo: `https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/${awayTeamId}.svg`
  };
}
