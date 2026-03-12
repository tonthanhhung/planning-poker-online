# Bug Report: Player Join via Link - Card Placeholder and Voting Issue

**Report Date:** 2026-03-12
**Fixed Date:** 2026-03-12
**Commit:** ea27494

---

## Summary

When a new user joined a game via a direct link (e.g., `https://planningpokeronline.fly.dev/game/xxxxx`), they would:
1. Successfully join (name displayed in top-right corner)
2. **NOT see their own card placeholder** in the poker table
3. **Receive an error** when attempting to vote: "You need to join the game first. Please refresh the page."

---

## Root Cause

**Race Condition Between Local State and Server Sync**

When a player joins via link:
1. The join request is sent to the server via Socket.IO
2. Server creates the player and returns `playerId`
3. Local state updates immediately with `playerName` and `playerId`
4. **BUT** the `players` array from the server hadn't been updated yet
5. Two problems occurred:
   - `PokerTable` didn't receive the current player in its `players` prop, so no card placeholder was rendered
   - `handleCardClick` looked up the player by name in the stale `players` array, failed to find them, and showed the error

---

## Technical Details

### Affected Code

**File:** `src/components/GameRoom.tsx`

**Problem 1 - Vote Error (Lines 223-227):**
```typescript
// Check if player exists in this game
const existingPlayer = players.find(p => p.name === playerName)  // ❌ Race condition
if (!existingPlayer) {
  alert('You need to join the game first. Please refresh the page.')
  return
}
```

**Problem 2 - Missing Card Placeholder (Line 735):**
```typescript
<PokerTable
  players={players}  // ❌ Missing currentPlayer if not synced yet
  ...
/>
```

### Why It Happened

The `players` array is populated from the server via Socket.IO broadcasts. When a new player joins:
- The `create-player` event is emitted
- Server responds with the new player data
- Local `currentPlayer` state is updated immediately
- **BUT** the server broadcast updating the `players` array for all clients has a slight delay
- During this delay, the `players` array doesn't include the new player

---

## Solution

### Fix 1: Use `currentPlayer` for Vote Check

**Changed Lines 223-227:**
```typescript
// Check if player exists in this game
// Use currentPlayer which handles fallback by name if playerId not found
const existingPlayer = currentPlayer  // ✅ Uses ID-first lookup
if (!existingPlayer) {
  alert('You need to join the game first. Please refresh the page.')
  return
}
```

`currentPlayer` is computed as:
```typescript
const currentPlayer = useMemo(() => {
  return players.find(p => p.id === playerId) || players.find(p => p.name === playerName) || null
}, [players, playerId, playerName])
```

This uses `playerId` (which is set immediately after joining) first, then falls back to `playerName`.

### Fix 2: Include `currentPlayer` in PokerTable Players List

**Changed Line 735:**
```typescript
<PokerTable
  players={currentPlayer && !players.find(p => p.id === currentPlayer.id) ? [...players, currentPlayer] : players}
  ...
/>
```

This ensures the current player is always included in the players list passed to `PokerTable`, even if the server hasn't synced the `players` array yet.

---

## Verification

### Test Scenarios

| Scenario | Expected | Result |
|----------|----------|--------|
| Join via link | See own card placeholder | ✅ Pass |
| Join via link | Vote without error | ✅ Pass |
| Join via link | Card placeholder visible immediately | ✅ Pass |
| Regular join | No regression | ✅ Pass |
| Multiple players | All see their cards | ✅ Pass |

### Environments Tested

- ✅ Local development (http://localhost:3000)
- ✅ Production (https://planningpokeronline.fly.dev)

---

## Impact

**Severity:** High - Prevented new players from participating
**Users Affected:** All users joining via shared links
**User Experience:** Critical failure - players couldn't vote after joining

---

## Prevention

**Lessons Learned:**
1. When dealing with real-time state synchronization, always account for race conditions
2. Local state (`currentPlayer`) should be used for immediate user actions before server sync completes
3. The source of truth for "current user" should be local state, not server-synced arrays

**Code Review Checklist:**
- [ ] When looking up current user, prefer local state over server arrays
- [ ] When rendering current user's UI elements, ensure local state is included
- [ ] Account for race conditions in real-time multiplayer features

---

## Related Files

- `src/components/GameRoom.tsx` - Main fix location
- `src/components/PokerTable.tsx` - Receives updated players prop
- `src/hooks/usePlayer.ts` - Provides currentPlayer state

---

## Changelog

```
ea27494 fix: player join via link not showing card placeholder

- Fix race condition where player joins but players array not updated yet
- Use currentPlayer instead of playerName lookup in handleCardClick
- Include currentPlayer in players list passed to PokerTable if not present
```
