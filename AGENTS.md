# Eclipse: Second Dawn

## Purpose
Multiplayer board game implementation (like colonist.io for Catan) based on Eclipse: Second Dawn for the Galaxy. Players explore space, research technologies, upgrade ships, build economic engines, and engage in combat across hex-based galaxy boards.

## Architecture Overview
- **Frontend:** React + TypeScript + Vite (src/)
- **Backend:** Convex real-time database (convex/)
- **Deployment:** Vercel (frontend) + Convex Cloud (backend)
- **Real-time sync:** Convex subscriptions for live multiplayer state
- **State management:** Server-authoritative—all game logic runs in Convex mutations

## Key Patterns

### Server-Authoritative Design
All game state mutations and validation happen server-side in Convex. Frontend is a view layer that dispatches actions and subscribes to state changes.

**Why:** Prevents cheating, ensures consistency across players, simplifies conflict resolution.

**How:**
- UI components call `useMutation` hooks
- Mutations validate actions and update database
- `useQuery` hooks subscribe to state changes
- UI re-renders automatically on updates

See docs/patterns/server-authoritative.md for details.

### Action System
Six core player actions per turn: explore, influence, research, upgrade, build, move.

**Pattern:** Each action has:
- UI component (src/components/actions/{Action}ActionUI.tsx)
- Convex mutation (convex/mutations/{action}.ts)
- Validation logic (convex/engine/validation.ts)
- React hook (src/hooks/use{Action}.ts)

**Example:** ExploreActionUI.tsx → useExplore hook → convex/mutations/explore.ts → updates galaxy state

See src/components/actions/ExploreActionUI.tsx as the canonical pattern.

### Phase Management
Game progresses through phases: action → combat → upkeep → income → cleanup → end turn.

**Flow:**
1. **Action phase:** Players take actions in turn order
2. **Combat phase:** Resolve battles in sectors with multiple players
3. **Upkeep phase:** Repair ships, discard excess resources
4. **Income phase:** Collect resources from controlled sectors
5. **Cleanup phase:** Reset temporary effects
6. **End turn:** Advance round counter, check victory conditions

See convex/engine/turns.ts for phase transition logic.

## Directory Structure

### Frontend (src/)
- **/pages/** - Top-level page components
  - `EclipseGamePage.tsx` - Main game interface
  - `MultiplayerStartPage.tsx` - Lobby and game creation
  - `LandingPage.tsx` - Entry point
- **/components/** - Reusable UI components
  - `/actions/` - Action-specific UIs (ExploreActionUI, ResearchActionUI, etc.)
  - `/board/` - Galaxy board rendering
  - `/lobby/` - Multiplayer lobby components
  - `/player/` - Player dashboard, resource displays
- **/hooks/** - React hooks for game state and actions
  - `useGameState.ts` - Subscribe to game state
  - `useGalaxy.ts` - Subscribe to galaxy/sectors
  - `use{Action}.ts` - Action-specific hooks
- **/types/** - Frontend TypeScript types
- **/utils/** - Frontend utilities

### Backend (convex/)
- **/mutations/** - State-changing operations (create game, take action, advance phase)
  - `rooms.ts` - Game room creation/joining
  - `actions.ts` - Player actions (explore, influence, research, upgrade, build, move)
  - `turns.ts` - Phase advancement and turn management
  - `seed.ts` - Initial game setup
- **/queries/** - Read-only queries
  - `game.ts` - Game state queries
  - `galaxy.ts` - Galaxy and sector queries
  - `players.ts` - Player state queries
  - `technologies.ts` - Available tech queries
- **/engine/** - Core game logic (pure functions)
  - `combat.ts` - Combat resolution (dice rolls, damage, initiative)
  - `resources.ts` - Resource calculations
  - `technology.ts` - Tech tree and prerequisites
  - `turns.ts` - Turn and phase mechanics
  - `validation.ts` - Action validation rules
- **/helpers/** - Backend utilities
- **/seedData/** - Initial data (factions, technologies, ship parts)
- **schema.ts** - Convex database schema

### Shared Data (shared/)
- **/factions/** - Faction data (species, starting techs, abilities)
- **/technologies/** - Technology tree data
- **/parts/** - Ship component data
- **/sectors/** - Sector tile data

## External Dependencies

### Convex
Real-time database and serverless backend. All game state lives in Convex tables.

**Key concepts:**
- **Mutations:** Write operations (async functions that modify database)
- **Queries:** Read operations (reactive, auto-update on changes)
- **Schema:** Type-safe table definitions (schema.ts)
- **Auth:** Built-in authentication (not yet implemented)

See convex/ directory for all backend code.

### Vercel
Frontend deployment and hosting. Connected to main branch for auto-deploys.

See DEPLOYMENT.md for deployment instructions.

## Conventions

### Naming
- **Components:** PascalCase (GalaxyBoard.tsx)
- **Hooks:** camelCase with "use" prefix (useGameState.ts)
- **Mutations/Queries:** camelCase (createGame, getGalaxyState)
- **Types:** PascalCase (GameState, PlayerAction)
- **Constants:** UPPER_SNAKE_CASE (MAX_PLAYERS, STARTING_RESOURCES)

### File Organization
- One component per file
- Co-locate tests with source files ({Component}.test.ts)
- Group related components in subdirectories
- Keep mutations focused (one action per file)

### Error Handling
- Mutations throw errors for invalid actions (Convex handles rollback)
- Frontend hooks catch errors and display user-friendly messages
- Log errors to console in development
- Track errors in production (monitoring not yet implemented)

### Testing
- Unit tests for engine logic (convex/engine/)
- Integration tests for mutations (test against Convex backend)
- Component tests for UI (React Testing Library)
- **IMPORTANT:** Cannot run all tests at once due to memory limits—run relevant tests only

**Test commands:**
```bash
npm run test:run          # Run all tests (may exceed memory)
npm run test:watch        # Watch mode for development
npm run test:coverage     # Generate coverage report
```

### TypeScript
- No `any` or `unknown` on public boundaries
- Define explicit interfaces for data crossing module boundaries
- Use Convex validators for schema enforcement
- Prefer type inference for local variables

### Git Workflow
- Feature branches: `feature/<kebab-case-name>`
- Commit messages: imperative mood ("Add combat UI" not "Added combat UI")
- Always run build before pushing: `npm run build && npm run lint`
- Rebase before merging to keep history clean

## Current Status
- **Completed:** Core game loop, action system, galaxy exploration, technology research, ship upgrades, resource management
- **In Progress:** Combat UI, player-to-player real-time updates, end-of-game scoring
- **Blocked:** None
- **Next:** Combat resolution UI, victory conditions, game polish

See PROJECT_STATUS.md for detailed status.

## Quick Start

### Local Development
```bash
# Install dependencies
npm ci

# Run Convex backend (in one terminal)
npx convex dev

# Run frontend (in another terminal)
npm run dev

# Open browser to http://localhost:5173
```

### Build and Deploy
```bash
# Build frontend
npm run build

# Deploy to Vercel (auto on push to main)
vercel --prod

# Deploy Convex backend
npx convex deploy
```

See DEPLOYMENT.md for full deployment guide.

## Debugging

### Common Issues
- **"No game found":** Game not properly initialized—check seed mutation
- **"Invalid action":** Action validation failed—check convex/engine/validation.ts
- **"Build fails":** Type errors—run `npm run build` to see full errors
- **"Tests exceed memory":** Run specific test files, not full suite

### Development Tools
- **React DevTools:** Inspect component state and props
- **Convex Dashboard:** View database tables and logs (dashboard.convex.dev)
- **Browser Console:** Frontend errors and network requests
- **VS Code Debugger:** Set breakpoints in frontend code

## Progressive Disclosure
This AGENTS.md provides a high-level overview. For deeper details:
- **Architecture patterns:** docs/patterns/
- **API documentation:** docs/api/
- **Game rules:** docs/rules/
- **Deployment guides:** DEPLOYMENT.md, QUICK_DEPLOY.md
- **Project status:** PROJECT_STATUS.md

When working on a specific area, reference the detailed docs for that subsystem.
