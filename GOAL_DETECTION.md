# Goal Detection Implementation

## Overview
This document describes the live goal detection system implemented for the Maple Leafs Discord bot.

## How It Works

### Data Flow
1. **Polling**: Every 60 seconds, `checkForGameUpdates()` checks for live Leafs games
2. **Play-by-Play Fetch**: For active games, fetches play-by-play data from NHL API
3. **Goal Detection**: Filters plays for goal events (`typeDescKey === 'goal'`)
4. **Deduplication**: Tracks `lastScoringIdx` to only process new goals
5. **Embed Creation**: Builds rich Discord embeds with goal details
6. **Channel Broadcast**: Sends to all configured channels

### Key Features

#### Deduplication
- Uses index-based tracking (`lastScoringIdx`) in the `activeGames` collection
- Survives bot restarts by only processing goals with index > `lastScoringIdx`
- No duplicate posts for the same goal

#### Goal Details Extraction
The system extracts and displays:
- **Scorer**: Player name and sweater number
- **Assists**: Up to 2 assists, or "Unassisted"
- **Strength**: EV (even), PP (power play), SH (short-handed), EN (empty net), PS (penalty shot)
- **Period/Time**: Formatted as "P1 5:23", "OT 2:15", etc.
- **Score**: Current score after the goal
- **Shot Type**: Wrist, snap, slap, backhand, etc. (optional)

#### Strength Detection
Priority order:
1. Explicit `details.strength` field (most reliable)
2. Penalty shot check (`details.shotType === 'penalty-shot'`)
3. Empty net check (`details.goalModifier === 'empty-net'`)
4. Situation code parsing (fallback for PP/SH detection)

### Data Structures

#### activeGames Tracker
```javascript
{
  lastUpdate: Date.now(),
  lastPeriod: '',           // e.g., "P2", "OT"
  lastHomeScore: 0,
  lastAwayScore: 0,
  lastTimeRemaining: '',
  lastScoringIdx: -1,      // Index of last processed goal
  scoreChanges: []
}
```

#### Play-by-Play Goal Event
```javascript
{
  eventId: 50,
  typeDescKey: 'goal',
  periodDescriptor: { number: 1, periodType: 'REG' },
  timeInPeriod: '5:23',
  situationCode: '1551',
  details: {
    eventOwnerTeamId: 'TOR',
    scoringPlayer: {
      firstName: { default: 'Auston' },
      lastName: { default: 'Matthews' },
      sweaterNumber: 34
    },
    assists: [...],
    homeScore: 1,
    awayScore: 0,
    shotType: 'wrist',
    strength: 'ev',
    goalModifier: 'empty-net'  // optional
  }
}
```

### API Endpoints Used

1. **Schedule**: `GET /v1/club-schedule/TOR/week/now`
   - Purpose: Find current live games

2. **Landing**: `GET /v1/gamecenter/{gameId}/landing`
   - Purpose: Get current score and game state

3. **Play-by-Play**: `GET /v1/gamecenter/{gameId}/play-by-play`
   - Purpose: Get all plays including goal events

### Error Handling

All fields use safe fallbacks to prevent "undefined" in embeds:
- Scorer: "Unknown" if missing
- Assists: "Unassisted" if empty
- Strength: "EV" if missing
- Period: "P1" if missing
- Time: "TBD" if missing
- Shot Type: Empty string (optional field)

### Rate Limiting

The existing `fetchJSON()` in `nhl-api.js` enforces:
- Minimum 1 second between API calls
- Prevents API throttling

### Logging

Key events logged to console:
- `🏒 Started tracking game {gameId}` - New game detected
- `📊 Game {gameId}: Found {n} total goals, last processed index: {idx}` - Each check
- `🚨 New goal detected at index {i}` - Goal found
- `✅ Goal update sent to guild {id}, channel {id}` - Broadcast success
- `🏁 Game {gameId} ended. Stopping tracking.` - Game finished

## Testing

Comprehensive tests verify:
- ✅ Goal filtering from play-by-play data
- ✅ Deduplication (no reprocessing)
- ✅ Bot restart scenario
- ✅ Goal detail extraction
- ✅ Strength detection (EV, PP, SH, EN, PS)
- ✅ Safe fallbacks for missing data

## Future Enhancements (Optional)

1. **Dynamic Polling**: Poll faster (10-15s) during live games, slower otherwise
2. **Player Avatars**: Add scorer headshots to embeds
3. **Video Highlights**: Link to goal clips if available
4. **Team Logos**: Already implemented for scoring team
5. **Historical Goals**: Command to view game goals so far

## Maintenance

### Common Issues

**No goals detected**: Check that:
- `getGameFeed()` returns valid play-by-play data
- Goal events have `typeDescKey === 'goal'`
- Bot has permission to send messages in configured channels

**Duplicate goals**: Verify:
- `lastScoringIdx` is being updated after processing
- `activeGames` collection persists across checks

**Missing goal details**: 
- Fields may vary by API version
- Safe fallbacks prevent errors
- Check logs for actual data structure
