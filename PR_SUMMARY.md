# Pull Request: Add `/test-goal` Slash Command

## Overview
This PR adds a new `/test-goal` slash command that enables developers to test the goal notification system end-to-end without waiting for a real NHL game. The command simulates a goal event and executes the same code path as actual goal notifications.

## Problem Statement
Previously, developers had no way to test the goal notification system without:
1. Waiting for a live NHL game
2. Manually triggering the goal detection logic
3. Risking disruption to production notifications

This made it difficult to:
- Debug goal notification formatting
- Verify channel permissions
- Test different goal scenarios (PP, SH, EN, OT, etc.)
- Validate changes to the goal embed logic

## Solution
Added a `/test-goal` command that:
1. Accepts customizable parameters (team, scorer, period, time, strength)
2. Constructs a realistic simulated goal payload
3. Calls the same `createGoalEmbed()` and `sendGoalToChannels()` functions used by real goals
4. Provides safety restrictions (dev-only by default, with force override)
5. Includes comprehensive test coverage

## Changes Made

### 1. Command Registration (`index.js`)
- Added new `SlashCommandBuilder` for `/test-goal` command
- 6 optional parameters with sensible defaults
- Input validation (period 1-5, strength choices)
- Integrated into existing command array

### 2. Command Handler (`index.js`)
- Environment check: only runs in non-production by default
- Channel validation: requires configured channel
- Payload construction: matches NHL API structure
- Error handling: comprehensive try-catch with user feedback
- Logging: detailed console output for debugging

### 3. Test Suite (`tests/testGoal.test.js`)
- 13 comprehensive unit tests
- Test helper function: `createSimulatedGoalPayload()`
- Coverage of all parameters, edge cases, and team logic
- Validates payload structure matches real goals

### 4. Documentation
- **README.md**: User-facing documentation with examples
- **TEST_GOAL_IMPLEMENTATION.md**: Technical documentation with design choices

## Technical Details

### Command Structure
```javascript
/test-goal 
  [team: string]        // Team abbreviation (default: TOR)
  [scorer: string]      // Player name (default: Auston Matthews)
  [period: integer]     // Period 1-5 (default: 1)
  [time: string]        // MM:SS format (default: 10:00)
  [strength: choice]    // EV|PP|SH|EN|PS (default: EV)
  [force: boolean]      // Override production check (default: false)
```

### Simulated Payload
```javascript
{
  scorer: "Auston Matthews #34",
  assists: "William Nylander #88, Mitchell Marner #16",
  strength: "EV",
  period: "P1",
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

### Code Reuse
The implementation reuses existing production code:
- `createGoalEmbed(data)` - Line 746 in index.js
- `sendGoalToChannels(embed)` - Line 654 in index.js
- No duplication or divergence from real goal handling

### Safety Features
1. **Environment restriction**: `NODE_ENV !== 'production'` check
2. **Force override**: `force: true` parameter for production testing
3. **Channel validation**: Requires `/setup-leafs-updates` first
4. **Ephemeral responses**: Command results only visible to user
5. **Error handling**: Comprehensive try-catch blocks

## Usage Examples

### Basic test (all defaults)
```
/test-goal
```
Result: TOR scores at P1 10:00, EV goal by Auston Matthews

### Custom scenario
```
/test-goal team:BOS scorer:David Pastrnak period:2 time:15:23 strength:PP
```
Result: BOS scores at P2 15:23, Power Play goal by David Pastrnak

### Overtime goal
```
/test-goal period:4 time:2:34
```
Result: TOR scores at OT 2:34

### Production override
```
/test-goal force:true
```
Result: Runs in production despite environment check

## Testing

### Test Results
```
Test Suites: 2 passed, 2 total
Tests:       17 passed, 17 total
Snapshots:   0 total
Time:        ~0.4s
```

### Test Coverage
- ✅ Default values
- ✅ Custom parameters
- ✅ Team logic (TOR vs others)
- ✅ Period mapping (including OT)
- ✅ Strength variations (EV, PP, SH, EN, PS)
- ✅ Logo URL generation
- ✅ Payload structure validation
- ✅ Assists formatting
- ✅ Shot type inclusion
- ✅ Score handling

### Security Scan
```
CodeQL Analysis: 0 vulnerabilities found
```

## Files Changed

| File | Lines Added | Lines Removed | Purpose |
|------|-------------|---------------|---------|
| `index.js` | +118 | -1 | Command registration and handler |
| `tests/testGoal.test.js` | +158 | 0 | Test suite |
| `README.md` | +39 | 0 | User documentation |
| `TEST_GOAL_IMPLEMENTATION.md` | +203 | 0 | Technical documentation |
| **Total** | **+518** | **-1** | **Net +517 lines** |

## Design Decisions

### 1. Why optional parameters with defaults?
- Simplifies common case (testing TOR goals)
- Allows flexibility for edge cases
- Follows Discord slash command best practices

### 2. Why reuse existing functions?
- Ensures simulated behavior matches real behavior
- Reduces maintenance burden
- Catches bugs in real code paths

### 3. Why environment restrictions?
- Prevents accidental production spam
- Allows safe testing in dev/staging
- Provides override for legitimate production testing

### 4. Why ephemeral responses?
- Keeps channels clean
- Prevents confusion about test vs real goals
- Maintains professional appearance

### 5. Why comprehensive tests?
- Validates all parameter combinations
- Ensures payload structure matches expectations
- Documents expected behavior
- Catches regressions

## Benefits

1. **Faster Development**: Test immediately without waiting for games
2. **Better Coverage**: Test scenarios that rarely occur (OT, PS, etc.)
3. **Easier Debugging**: Reproduce issues on demand
4. **Safer Testing**: Isolated from production notifications
5. **Clear Documentation**: Examples and explanations for future developers

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Production spam | Environment check + force override |
| Payload drift | Reuse production functions |
| Channel permission issues | Validation before execution |
| User confusion | Ephemeral responses + clear messaging |
| Test flakiness | Deterministic test helper function |

## Future Enhancements

Possible improvements not included in this PR:
1. Simulation history/logging
2. Multiple goals in sequence
3. Other event types (period changes, game end)
4. Load testing capability
5. Export simulation data

## Verification Checklist

- [x] All tests passing (17/17)
- [x] No syntax errors
- [x] No security vulnerabilities (CodeQL verified)
- [x] Command structure validated
- [x] Documentation complete
- [x] Code follows existing patterns
- [x] Error handling comprehensive
- [x] Logging appropriate
- [x] User feedback clear

## Migration Notes

### For Users
1. Update to latest version
2. Run `/test-goal` to verify setup
3. No breaking changes to existing commands

### For Developers
1. Pull latest changes
2. Run `npm install` (no new dependencies)
3. Run `npm test` to verify
4. See README.md for usage examples
5. See TEST_GOAL_IMPLEMENTATION.md for technical details

## Breaking Changes
None. This is a purely additive change.

## Dependencies
No new dependencies added. Uses existing:
- discord.js (v14.13.0)
- Jest (v29.7.0) for testing

## Deployment
No special deployment steps required:
1. Merge PR
2. Deploy as normal
3. Command automatically registers on bot startup
4. Users see new command in Discord's slash command picker

## Support
For questions or issues:
1. See README.md for usage
2. See TEST_GOAL_IMPLEMENTATION.md for technical details
3. Check test suite for examples
4. Review console logs when running command

## Acknowledgments
- Implementation follows existing code patterns in the repository
- Test structure based on existing `goalsApi.test.js`
- Documentation style matches existing `GOAL_DETECTION.md`
