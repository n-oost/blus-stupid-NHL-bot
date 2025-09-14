import 'dotenv/config';
import fetch from 'node-fetch';

// NHL API base URL (updated to new API)
const NHL_API_BASE = 'https://api-web.nhle.com/v1';

// Toronto Maple Leafs team abbreviation in new NHL API
const LEAFS_TEAM_ID = 'TOR';

// Toggle whether to perform/announce an explicit "season" check.
// Set ENABLE_SEASON_CHECK=true in your .env to restore the old behaviour that
// logs and early-returns when there's no scheduled hockey ("not hockey season").
// By default this is disabled so the bot quietly returns null when no games exist.
const ENABLE_SEASON_CHECK = process.env.ENABLE_SEASON_CHECK === 'true';

// Small helper to fetch JSON and handle non-OK responses consistently.
async function fetchJSON(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'blus-stupid-nhl-bot/1.0' } });
    if (!res.ok) {
      const text = await res.text();
      console.error(`NHL API error: ${res.status} ${res.statusText} for ${url} -> ${text}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`Network error fetching ${url}:`, err);
    return null;
  }
}

/**
 * Get the next scheduled game for the Toronto Maple Leafs
 * @returns {Promise<Object>} Next game information
 */
export async function getNextLeafsGame() {
  try {
    const url = `${NHL_API_BASE}/club-schedule/${LEAFS_TEAM_ID}/week/now`;
    const data = await fetchJSON(url);
    if (!data) return null;

    // Check if there are any games
    if (!data.games || data.games.length === 0) {
      if (ENABLE_SEASON_CHECK) console.log('Skipping NHL API check: not hockey season (no upcoming games)');
      return null;
    }

    // Find the next upcoming game
    const now = new Date();
    const nextGame = data.games.find(game => new Date(game.startTimeUTC) > now);

    return nextGame || null;
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
    const url = `${NHL_API_BASE}/gamecenter/${gameId}/landing`;
    return await fetchJSON(url);
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
    const url = `${NHL_API_BASE}/gamecenter/${gameId}/boxscore`;
    return await fetchJSON(url);
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
    const url = `${NHL_API_BASE}/club-schedule/${LEAFS_TEAM_ID}/week/now`;
    const data = await fetchJSON(url);
    if (!data) return null;

    // Check if there are any games today
    if (!data.games || data.games.length === 0) {
      if (ENABLE_SEASON_CHECK) console.log('Skipping NHL API check: not hockey season (no games today)');
      return null;
    }

    // Find a game that's currently live
    const now = new Date();
    const currentGame = data.games.find(game => {
      const gameStart = new Date(game.startTimeUTC);
      const gameEnd = new Date(gameStart.getTime() + (4 * 60 * 60 * 1000)); // Assume max 4 hours
      return gameStart <= now && now <= gameEnd && 
             (game.gameState === 'LIVE' || game.gameState === 'CRIT');
    });
    
    return currentGame || null;
  } catch (error) {
    console.error('Error checking current Leafs game:', error);
    return null;
  }
}

/**
 * Get the full live feed for a game (includes scoring plays and detailed liveData)
 * @param {string|number} gameId
 */
export async function getGameFeed(gameId) {
  try {
    const url = `${NHL_API_BASE}/gamecenter/${gameId}/play-by-play`;
    return await fetchJSON(url);
  } catch (err) {
    console.error(`Error fetching game feed for ${gameId}:`, err);
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
  
  const homeTeam = game.homeTeam?.name?.default || game.homeTeam?.abbrev || 'Home';
  const awayTeam = game.awayTeam?.name?.default || game.awayTeam?.abbrev || 'Away';
  const homeScore = game.homeTeam?.score || 0;
  const awayScore = game.awayTeam?.score || 0;
  const status = game.gameState || 'Unknown';
  const period = game.period || '';
  const timeRemaining = game.clock?.timeRemaining || '';
  
  return {
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    status,
    period,
    timeRemaining,
    gameId: game.id,
    startTime: new Date(game.startTimeUTC),
    isLeafsHome: homeTeam.includes('Maple Leafs') || homeTeam.includes('Toronto')
  };
}

/**
 * Get team logos for both teams in a game
 * @param {Object} game - Game data
 * @returns {Object} Object with home and away team logo URLs
 */
export function getTeamLogos(game) {
  if (!game) return null;
  
  const homeTeamId = game.homeTeam?.abbrev || 'TOR';
  const awayTeamId = game.awayTeam?.abbrev || 'TOR';
  
  return {
    homeTeamLogo: `https://assets.nhle.com/logos/nhl/svg/${homeTeamId}_light.svg`,
    awayTeamLogo: `https://assets.nhle.com/logos/nhl/svg/${awayTeamId}_light.svg`
  };
}
