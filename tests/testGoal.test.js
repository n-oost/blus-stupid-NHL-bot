import { describe, test, expect, jest } from '@jest/globals';

/**
 * Helper function to create a simulated goal payload
 * This matches the structure used by the /test-goal command
 * 
 * @param {Object} options - Goal simulation options
 * @param {string} options.team - Team abbreviation (default: 'TOR')
 * @param {string} options.scorer - Scorer name (default: 'Auston Matthews')
 * @param {number} options.period - Period number (default: 1)
 * @param {string} options.time - Time in period (default: '10:00')
 * @param {string} options.strength - Goal strength (default: 'EV')
 * @returns {Object} Simulated goal embed data
 */
export function createSimulatedGoalPayload(options = {}) {
  const {
    team = 'TOR',
    scorer = 'Auston Matthews',
    period = 1,
    time = '10:00',
    strength = 'EV'
  } = options;

  // For TOR, make them the home team; otherwise, make the scoring team away
  const isToronto = team === 'TOR';
  
  return {
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
  };
}

describe('Test Goal Simulation', () => {
  test('createSimulatedGoalPayload generates payload with default values', () => {
    const payload = createSimulatedGoalPayload();
    
    expect(payload.scorer).toContain('Auston Matthews');
    expect(payload.strength).toBe('EV');
    expect(payload.period).toBe('P1');
    expect(payload.timeInPeriod).toBe('10:00');
    expect(payload.teamAbbrev).toBe('TOR');
    expect(payload.homeTeam).toBe('TOR');
    expect(payload.awayTeam).toBe('OPP');
  });

  test('createSimulatedGoalPayload accepts custom team', () => {
    const payload = createSimulatedGoalPayload({ team: 'BOS' });
    
    expect(payload.teamAbbrev).toBe('BOS');
    expect(payload.homeTeam).toBe('OPP');
    expect(payload.awayTeam).toBe('BOS');
  });

  test('createSimulatedGoalPayload accepts custom scorer', () => {
    const payload = createSimulatedGoalPayload({ scorer: 'John Tavares' });
    
    expect(payload.scorer).toContain('John Tavares');
  });

  test('createSimulatedGoalPayload accepts custom period', () => {
    const payload = createSimulatedGoalPayload({ period: 2 });
    
    expect(payload.period).toBe('P2');
  });

  test('createSimulatedGoalPayload handles overtime period', () => {
    const payload = createSimulatedGoalPayload({ period: 4 });
    
    expect(payload.period).toBe('OT');
  });

  test('createSimulatedGoalPayload accepts custom time', () => {
    const payload = createSimulatedGoalPayload({ time: '5:23' });
    
    expect(payload.timeInPeriod).toBe('5:23');
  });

  test('createSimulatedGoalPayload accepts custom strength', () => {
    const payload = createSimulatedGoalPayload({ strength: 'PP' });
    
    expect(payload.strength).toBe('PP');
  });

  test('createSimulatedGoalPayload generates valid logo URLs', () => {
    const payload = createSimulatedGoalPayload();
    
    expect(payload.logos.homeTeamLogo).toContain('https://assets.nhle.com/logos/nhl/svg/');
    expect(payload.logos.awayTeamLogo).toContain('https://assets.nhle.com/logos/nhl/svg/');
    expect(payload.logos.homeTeamLogo).toContain('_light.svg');
    expect(payload.logos.awayTeamLogo).toContain('_light.svg');
  });

  test('createSimulatedGoalPayload includes assists', () => {
    const payload = createSimulatedGoalPayload();
    
    expect(payload.assists).toBeTruthy();
    expect(typeof payload.assists).toBe('string');
    expect(payload.assists).toContain('Nylander');
    expect(payload.assists).toContain('Marner');
  });

  test('createSimulatedGoalPayload includes shot type', () => {
    const payload = createSimulatedGoalPayload();
    
    expect(payload.shotType).toBe('wrist');
  });

  test('createSimulatedGoalPayload includes score', () => {
    const payload = createSimulatedGoalPayload();
    
    expect(payload.homeScore).toBeDefined();
    expect(payload.awayScore).toBeDefined();
    expect(typeof payload.homeScore).toBe('number');
    expect(typeof payload.awayScore).toBe('number');
  });

  test('createSimulatedGoalPayload handles all strength types', () => {
    const strengths = ['EV', 'PP', 'SH', 'EN', 'PS'];
    
    strengths.forEach(strength => {
      const payload = createSimulatedGoalPayload({ strength });
      expect(payload.strength).toBe(strength);
    });
  });

  test('createSimulatedGoalPayload structure matches expected embed format', () => {
    const payload = createSimulatedGoalPayload();
    
    // Verify all required fields are present
    expect(payload).toHaveProperty('scorer');
    expect(payload).toHaveProperty('assists');
    expect(payload).toHaveProperty('strength');
    expect(payload).toHaveProperty('period');
    expect(payload).toHaveProperty('timeInPeriod');
    expect(payload).toHaveProperty('homeScore');
    expect(payload).toHaveProperty('awayScore');
    expect(payload).toHaveProperty('homeTeam');
    expect(payload).toHaveProperty('awayTeam');
    expect(payload).toHaveProperty('teamAbbrev');
    expect(payload).toHaveProperty('shotType');
    expect(payload).toHaveProperty('logos');
    expect(payload.logos).toHaveProperty('homeTeamLogo');
    expect(payload.logos).toHaveProperty('awayTeamLogo');
  });
});
