import nock from 'nock';
import { fetchGoals } from '../src/api/goals.js';

describe('fetchGoals', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  test('fetchGoals returns goals when API responds with stats', async () => {
    const teamId = 10;
    const mockResponse = {
      stats: [
        {
          splits: [
            {
              stat: {
                goals: 250,
                wins: 45,
                losses: 30
              }
            }
          ]
        }
      ]
    };

    // Mock the NHL API endpoint
    nock('https://statsapi.web.nhl.com')
      .get(`/api/v1/teams/${teamId}/stats`)
      .reply(200, mockResponse);

    const result = await fetchGoals(teamId);

    expect(result).toHaveProperty('goals');
    expect(result).toHaveProperty('raw');
    expect(result.goals).toBe(250);
    expect(result.raw).toEqual(mockResponse);
  });

  test('fetchGoals surfaces network errors', async () => {
    const teamId = 10;

    // Mock the NHL API endpoint to return 500 error
    nock('https://statsapi.web.nhl.com')
      .get(`/api/v1/teams/${teamId}/stats`)
      .reply(500, 'Internal Server Error');

    await expect(fetchGoals(teamId)).rejects.toThrow(/API request failed with status 500/);
  });

  test('fetchGoals throws error when teamId is missing', async () => {
    await expect(fetchGoals()).rejects.toThrow('teamId is required');
    await expect(fetchGoals(null)).rejects.toThrow('teamId is required');
    await expect(fetchGoals(undefined)).rejects.toThrow('teamId is required');
  });

  test('fetchGoals returns null goals when stats structure is different', async () => {
    const teamId = 10;
    const mockResponse = {
      stats: []
    };

    nock('https://statsapi.web.nhl.com')
      .get(`/api/v1/teams/${teamId}/stats`)
      .reply(200, mockResponse);

    const result = await fetchGoals(teamId);

    expect(result.goals).toBeNull();
    expect(result.raw).toEqual(mockResponse);
  });
});
