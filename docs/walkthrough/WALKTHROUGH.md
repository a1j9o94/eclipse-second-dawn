# Eclipse Second Dawn - Game Walkthrough

Date: February 23, 2026
URL: https://eclipse-second-dawn.vercel.app

## Overview

This walkthrough documents the game flow from landing page through the faction selection bug that prevents game start.

## Screenshots

### 1. Landing Page (01-landing.png)
- Clean interface with game title "Eclipse: Second Dawn"
- Subtitle: "Multiplayer Space Strategy"
- Two main buttons: "Create Game" and "Join Game"
- Tagline: "Build fleets, research technologies, explore the galaxy"

### 2. Create Game Form (02-create-form.png)
- Player name input field
- Room code field with random generator button (🎲)
- "Make room public" checkbox
- Victory Points Goal spinner (default: 30)
- Rise of Ancients toggle (default: No)
- Create Match button (disabled until name entered)

### 3. Create Game Filled (03-create-filled.png)
- Player name entered: "Adrian"
- Create Match button now enabled
- All other settings at defaults

### 4. Game Lobby - Single Player (04-lobby.png)
- Room name: "Fusion Port 102"
- Room code: W6F9FF (shareable)
- Status: "Private Room setup · 0/1 ready"
- Game Settings displayed: Victory Points Goal: 30, Rise of Ancients: No
- Players (1/2): Adrian (Host, You, Not Ready)
- Message: "Waiting for another player... Share the room code above to invite someone"

### 5. Join Game Form (05-join-form.png)
- Player name input field
- Room code input field (6-character)
- Join Match button (disabled until both fields filled)

### 6. Lobby - Two Players (06-lobby-two-players.png)
- Players (2/2): Adrian (Host) and Player2
- Status: "0/2 ready"
- Both players marked as "Not Ready"
- "Ready to Play" button now visible
- "Restart (Lose a life)" button also available

### 7. Faction Selection Dialog (07-faction-selection.png)
Appears when player clicks "Ready to Play". Six factions available:

1. **Consortium of Scholars** - All tech tracks start at Tier 2. Better shop quality early.
2. **Crimson Vanguard** - Begin with a Cruiser-class hull blueprint, one Cruiser deployed, and +2 dock capacity.
3. **Helios Cartel** - Extra credits and materials; initial rerolls free; actions cost less.
4. **Void Corsairs** - Interceptors start with Tier 2 cannon and +1 initiative.
5. **Temporal Vanguard** - Start with Disruptor Beam, Plasma Cannon, and advanced drives.
6. **Regenerative Swarm** - Begin with Auto-Repair Hull and regenerative ships.

### 8. Bug: Faction Selection Error (08-error-faction-selection.png)

## Critical Bug Found

**Location:** Faction selection process
**Trigger:** Clicking any faction to select it

### Error Details

**User-visible error:**
- Text displays: "v is not a function"
- Appears in the room code area
- Players remain stuck at "Not Ready" status
- Game never progresses to actual gameplay

**Console errors:**
```
[CONVEX M(mutations/rooms:setPlayerFaction)] [Request ID: f2013ceda527e49c] Server Error

Failed to set player faction: Error: [CONVEX M(mutations/rooms:setPlayerFaction)]
[Request ID: f2013ceda527e49c] Server Error
  Called by client
    at rS.mutation (index-BHcwn7Jq.js:50:39090)
    at async setPlayerFaction (index-BHcwn7Jq.js:50:56365)
    at async onPick (index-BHcwn7Jq.js:50:72057)

[Client] updateFleetValidity {playerId: 3590uz5rynvwyb22z1cq4, roomId: jd7b43g2rgyjfv8zkqjs2qt52s81p3z5, fleetValid: true}

Failed to update fleet validity: TypeError: v is not a function
    at updateFleetValidity (index-BHcwn7Jq.js:50:52331)
    at onPick (index-BHcwn7Jq.js:50:72086)
```

### Root Cause Analysis

1. **Primary Error:** The `setPlayerFaction` Convex mutation is failing on the server side
2. **Secondary Error:** After the mutation fails, `updateFleetValidity` tries to call `v()` but `v` is not defined as a function
3. **Impact:** Game cannot progress past faction selection, blocking all gameplay

### Likely Issues

1. The `setPlayerFaction` mutation in Convex backend has a server error (check backend logs)
2. The `updateFleetValidity` function has a reference error - possibly:
   - Minified code where `v` is an undefined variable
   - Missing import or dependency
   - TypeScript compilation issue
3. Error handling is insufficient - the UI doesn't gracefully handle the mutation failure

### What Works

✅ Landing page loads
✅ Create game form works
✅ Join game form works
✅ Room creation successful
✅ Player joining successful
✅ Lobby display correct
✅ "Ready to Play" button appears
✅ Faction selection dialog opens

### What Doesn't Work

❌ Faction selection fails
❌ Cannot progress to actual game board
❌ setPlayerFaction mutation fails on server
❌ updateFleetValidity function has undefined reference

## Next Steps

1. Check Convex backend logs for `setPlayerFaction` mutation errors
2. Review `updateFleetValidity` function implementation for undefined variable `v`
3. Add better error handling and user feedback for mutation failures
4. Test faction selection with backend fixes
5. Continue walkthrough once bug is fixed to document actual gameplay

## Notes

- All pre-game UI flows work perfectly
- The bug is specifically in the backend mutation and its error handling
- No game board screenshots possible until this bug is fixed
