# `/test-goal` Command Implementation

## Overview
The `/test-goal` command provides developers with a way to test the goal notification system end-to-end without waiting for a real NHL game. It simulates a goal event and executes the same code path as real goal notifications.

## Design Choices

### 1. Command Registration
- **Location**: Added to `index.js` in the `commands` array (lines 51-90)
- **Type**: Slash command using Discord.js `SlashCommandBuilder`
- **Parameters**: All optional with sensible defaults
  - `team` (string): Team abbreviation (default: "TOR")
  - `scorer` (string): Player name (default: "Auston Matthews")
  - `period` (integer): Period 1-5 (default: 1)
  - `time` (string): Time in period (default: "10:00")
  - `strength` (string): Goal strength with choices (default: "EV")
  - `force` (boolean): Override production restriction (default: false)

### 2. Code Path Reuse
The command reuses existing production code rather than duplicating logic:
- **`createGoalEmbed()`**: Same function used by real goal detection (line 746)
- **`sendGoalToChannels()`**: Same function used to broadcast goals (line 654)
- **Payload structure**: Matches exactly what real NHL API data produces

### 3. Environment Safety
- **Default restriction**: Only runs in non-production environments
- **Check**: `process.env.NODE_ENV !== 'production'`
- **Override**: `force: true` parameter allows production testing
- **User feedback**: Clear error messages when restricted

### 4. Channel Validation
- Requires a channel to be configured via `/setup-leafs-updates` first
- Validates that `configuredChannels.get(guild.id)` exists
- Prevents accidental execution without proper setup

## Implementation Details

### Goal Payload Structure
The simulated payload includes all fields used by real goals:
```javascript
{
  scorer: "Player Name #34",
  assists: "Assist1 #88, Assist2 #16",
  strength: "EV|PP|SH|EN|PS",
  period: "P1|P2|P3|OT|SO",
  timeInPeriod: "10:00",
  homeScore: 2,
  awayScore: 1,
  homeTeam: "TOR",
  awayTeam: "OPP",
  teamAbbrev: "TOR",
  shotType: "wrist",
  logos: {
    homeTeamLogo: "https://assets.nhle.com/logos/nhl/svg/TOR_light.svg",
    awayTeamLogo: "https://assets.nhle.com/logos/nhl/svg/OPP_light.svg"
  }
}
```

### Team Logic
- If `team === 'TOR'`: Toronto is home team (homeScore > awayScore)
- If `team !== 'TOR'`: Other team is away (awayScore > homeScore)
- Logos use NHL's official SVG assets

### Period Mapping
- Periods 1-3: "P1", "P2", "P3"
- Period 4+: "OT"
- Special handling for overtime/shootout

## Testing

### Unit Tests
- **Location**: `tests/testGoal.test.js`
- **Coverage**: 13 tests covering all parameters and edge cases
- **Test helper**: `createSimulatedGoalPayload()` function
- **Validation**: Payload structure, defaults, custom values, team logic

### Test Categories
1. Default values
2. Custom parameters
3. Team logic (TOR vs others)
4. Period mapping
5. Strength variations
6. Logo URL generation
7. Payload structure validation

## Usage Examples

### Basic test (all defaults)
```
/test-goal
```
Simulates: TOR scoring at P1 10:00, EV goal by Auston Matthews

### Custom scorer and period
```
/test-goal scorer:John Tavares period:2
```
Simulates: TOR scoring at P2 10:00, EV goal by John Tavares

### Opponent goal with strength
```
/test-goal team:BOS scorer:David Pastrnak period:3 time:15:23 strength:PP
```
Simulates: BOS scoring at P3 15:23, PP goal by David Pastrnak

### Overtime goal
```
/test-goal period:4 time:2:34
```
Simulates: TOR scoring at OT 2:34

### Force in production
```
/test-goal force:true
```
Simulates: Default goal but overrides production restriction

## Logging

The command logs simulated payloads for debugging:
```javascript
console.log('🧪 Test goal simulated:', {
  team: 'TOR',
  scorer: 'Auston Matthews',
  period: 1,
  time: '10:00',
  strength: 'EV',
  guildId: '...',
  channelId: '...'
});
```

## Error Handling

1. **Environment restriction**: Returns ephemeral error if not dev and no force
2. **No configured channel**: Returns ephemeral error with setup instruction
3. **Execution errors**: Caught and reported with error message
4. **Deferred reply**: Uses `deferReply({ ephemeral: true })` for async work

## Response Format

Success response (ephemeral):
```
✅ Test goal notification sent to #channel-name!

Simulated Data:
- Team: TOR
- Scorer: Auston Matthews
- Period: P1
- Time: 10:00
- Strength: EV
```

## Security Considerations

1. **No CodeQL alerts**: Passed security scanning
2. **No user input injection**: All parameters validated by Discord.js
3. **No external API calls**: Pure simulation
4. **Ephemeral responses**: Command responses not visible to other users
5. **Environment restriction**: Prevents accidental production spam

## Files Modified

1. **index.js**
   - Added command registration (lines 51-90)
   - Added command handler (lines 344-426)

2. **README.md**
   - Added command documentation
   - Added usage examples
   - Added developer section

3. **tests/testGoal.test.js** (new file)
   - Added test suite
   - Added helper function
   - 13 comprehensive tests

## Future Enhancements (Not Implemented)

Possible improvements for future work:
1. Save simulation history for debugging
2. Add video/GIF support to match real goals
3. Allow multiple goals in sequence
4. Simulate other events (period changes, game end)
5. Load test with multiple rapid simulations
6. Export simulation data for analysis

## Assumptions

1. **Channel exists**: Assumes configured channel is still valid
2. **Bot permissions**: Assumes bot has permission to send embeds
3. **Goal format**: Assumes NHL API format won't change drastically
4. **Team abbreviations**: Assumes 3-letter team codes (TOR, BOS, etc.)
5. **Logo availability**: Assumes NHL's SVG logos remain accessible

## Notes for Maintainers

- Keep simulation payload in sync with real goal detection logic
- Update tests if NHL API response format changes
- Consider adding more test cases for edge scenarios
- Monitor logs for usage patterns in production (if force is used)
- The test helper function in tests can be imported and reused elsewhere
