# Eclipse Second Dawn for the Galaxy

**Live multiplayer board game implementation** - Like colonist.io is to Catan, but for Eclipse Second Dawn.

🚀 **Status**: In active development
🎮 **Play it**: [Coming soon - deployment in progress]
📖 **Rules**: [Eclipse Second Dawn Official Rules](https://cdn.1j1ju.com/medias/bb/af/07-eclipse-second-dawn-for-the-galaxy-rulebook.pdf)

---

## What is Eclipse?

Eclipse Second Dawn for the Galaxy is a strategy board game where 2-6 players explore space, research technologies, build starships, and engage in epic battles for galactic dominance.

### Game Features
- **Explore** a variable hex-grid galaxy with 40+ sector tiles
- **Research** technologies across 4 tracks (Nano, Grid, Military, Rare)
- **Build** and customize starships with unlocked parts
- **Battle** for sector control with tactical combat
- **Manage** resources (materials, science, money, influence disks)
- **Compete** for victory points through multiple paths

---

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Convex (real-time serverless database)
- **UI**: Tailwind CSS
- **Deployment**: Vercel (frontend) + Convex Cloud (backend)

---

## Project Structure

```
convex/               # Convex backend (database + server functions)
├── schema.ts         # 27-table database schema
├── engine/           # Game logic (actions, turns, resources, combat)
├── mutations/        # Server-authoritative game mutations
├── queries/          # Real-time data queries
└── seedData/         # Game content (130+ entities)

src/                  # React frontend
├── components/       # UI components (galaxy board, tech tree, player board)
├── hooks/            # React hooks for game actions
└── lib/              # Convex adapters and utilities

docs/                 # Architecture and integration documentation
```

---

## Development Status

### ✅ Completed (Phase 1)
- Complete Convex schema (27 tables, 45+ indexes)
- Seed data for 130+ game entities (technologies, parts, factions, sectors, tiles)
- All 6 action mutations (explore, influence, research, build, upgrade, move)
- Turn system with 6-phase structure
- Resource economy engine (validation, influence disks, colony ships)
- Galaxy board UI with real-time Convex sync
- Technology tree UI with 4-track layout
- 90+ passing tests

### 🔄 In Progress (Phase 2)
- Action UI components (exploration, influence, move, build, upgrade)
- Database seeding workflow
- End-to-end integration testing
- Deployment pipeline

### ⏳ Coming Soon (Phase 3+)
- Combat integration
- Victory points system
- Discovery/Reputation/Ambassador tiles
- Mobile-responsive UI
- AI opponents

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm or bun

### Installation

```bash
# Clone the repository
git clone https://github.com/a1j9o94/eclipse-second-dawn.git
cd eclipse-second-dawn

# Install dependencies
npm install

# Set up Convex (creates convex.json)
npx convex dev

# In another terminal, start the dev server
npm run dev
```

### Seed the Database

```bash
# After Convex is running, seed all game data
npx convex run mutations/seed:seedAllData
```

### Open the Game

Visit http://localhost:5173 to see the game board!

---

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed technical design.

### Key Systems
- **Turn Flow**: 6-phase turn structure (Action → Combat → Upkeep → Income → Cleanup → End)
- **Actions**: Server-authoritative validation with optimistic UI updates
- **Resources**: Immutable state updates with pure function library
- **Real-time Sync**: Convex subscriptions for instant multiplayer updates
- **Schema**: Normalized relational design with efficient indexes

---

## Contributing

This is an open-source passion project built by AI agents coordinating through Claude Code! Contributions welcome.

### Development Team (AI Agents)
- **Architect**: System design and integration planning
- **Data-modeler**: Database schema and seed data
- **Frontend-hex**: Galaxy board and UI components
- **Engine-turns**: Turn system and action logic
- **Tech-tree**: Technology research system
- **Resources**: Resource economy and validation

See [docs/INTEGRATION_STATUS.md](docs/INTEGRATION_STATUS.md) for current development status.

---

## Deployment

### Frontend (Vercel)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/a1j9o94/eclipse-second-dawn)

### Backend (Convex)
```bash
npx convex login
npx convex deploy
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

---

## License

This project is an unofficial fan implementation of Eclipse Second Dawn for the Galaxy.
**Eclipse Second Dawn** is © Lautapelit.fi. All rights to the game design belong to the original creators.

This code is provided as-is for educational and entertainment purposes.

---

## Acknowledgments

- **Eclipse Second Dawn for the Galaxy** by Touko Tahkokallio
- **Lautapelit.fi** for the amazing board game
- **Convex** for the incredible real-time database platform
- **Claude AI** for the multi-agent development workflow
