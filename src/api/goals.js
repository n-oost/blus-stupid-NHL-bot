import axios from 'axios';

/**
 * Fetch goals for a specific NHL team from the stats API
 * @param {string|number} teamId - The NHL team ID
 * @returns {Promise<{goals: number|null, raw: object}>} Object containing goals count and raw response
 * @throws {Error} Throws on network errors or invalid teamId
 */
export async function fetchGoals(teamId) {
  // Validate teamId presence
  if (!teamId && teamId !== 0) {
    throw new Error('teamId is required');
  }

  const url = `https://statsapi.web.nhl.com/api/v1/teams/${teamId}/stats`;

  try {
    const response = await axios.get(url);
    const raw = response.data;

    // Parse the typical NHL stats shape: stats[0].splits[0].stat.goals
    let goals = null;
    if (raw?.stats?.[0]?.splits?.[0]?.stat?.goals !== undefined) {
      goals = raw.stats[0].splits[0].stat.goals;
    }

    return { goals, raw };
  } catch (error) {
    // Re-throw network errors and axios errors
    if (error.response) {
      // Server responded with error status
      throw new Error(`API request failed with status ${error.response.status}: ${error.response.statusText}`);
    } else if (error.request) {
      // Request was made but no response received
      throw new Error(`Network error: No response received from ${url}`);
    } else {
      // Something else went wrong
      throw error;
    }
  }
}
