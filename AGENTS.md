# Agents (Codex CLI) — Orchestrator & Sub-Agents

## Mission

All “agents” are **Codex CLI** processes. A **Supervisor** coordinates **Planning**, **Engine/Implementation**, and **Tests** sub-agents. The Supervisor keeps CI green (tests/lint/build), spawns focused Codex jobs, and reaps completed work. Every run leaves an auditable trail under `coding_agents/`.

---

## Ground Rules

* **TDD**: write a failing test → implement → make it pass. No untested behavior.
* **Hygiene every loop**:

  ```bash
  npm run lint && npm run build
  ```

  Run the tests that are relevevant to yur update. You can't run all the tests because it will exceed the memory limit.
* **Types**: no `any`/`unknown` on public boundaries. Define explicit interfaces for data crossing module boundaries.
* **Player experience first**: every plan states the user outcome and acceptance criteria.
* **Branches**: major work on `feature/<kebab>`, inherited from the parent branch.
* **Write it down**: plans, decisions, status updates live in `coding_agents/`.

---

## Directory Layout

```
coding_agents/
  agents.md
  planning_agents.md
  implementation_agents.md
  research_agents.md
  subagents/
    planning_agent.md
    engine_agent.md
    tests_agent.md
  prompts/
    planning.md
    engine.md
    tests.md
  logs/            # runtime logs (*.out)
  pids/            # pidfiles (*.pid)
  checklists/
    app_slim_phase0b_status.md
    app_slim_refactor_design.md
```

---

## Startup (every session)

```bash
git fetch -p
git switch <working-branch>
git pull --rebase

npm ci
npm run lint
npm run test:run
npm run build
```

Create/append a plan entry in `coding_agents/subagents/planning_agent.md`:

* **Outcome** (1 sentence)
* **Acceptance criteria**
* **Risks & rollback**
* **Test list** (mark which must fail first)

---

## Execution Policy (Codex flags)

All sub-agents are Codex processes launched with full tool access + web:

```
--dangerously-bypass-approvals-and-sandbox --search
```

These are injected automatically by `scripts/agents.sh` via the `CODEX_FLAGS` env var. Default:

```bash
export CODEX_FLAGS="--dangerously-bypass-approvals-and-sandbox --search -C . -p default"
```

Override per session if needed (e.g., safer mode):

```bash
export CODEX_FLAGS="--full-auto -C . -p default"
```

---

## Running Agents = Running Codex

We use two Codex modes:

1. **Non-interactive jobs (default)** — `codex exec "<prompt text>"`
2. **Streaming/loop jobs** — `codex proto` (stdin/stdout protocol) for long-lived supervisors

The process manager (`agents` alias for `bash scripts/agents.sh`) **detaches** each Codex run (`setsid` + `nohup`), captures logs, and writes a PID file.

---

## Sub-Agent Roles

### Planning Agent (Codex)

**Goal**: produce/refresh the plan (`coding_agents/*_design.md`), acceptance criteria, and a failing-tests list.
**Launch**:

```bash
agents spawn planning "plan-$RANDOM" -- \
  codex exec "$(cat coding_agents/prompts/planning.md)"
```

**Outputs**:

* `coding_agents/<feature>_design.md`
* updated `checklists/*` and `subagents/planning_agent.md`

---

### Engine/Implementation Agent (Codex)

**Goal**: implement the next slice per plan; pure reducers/engine only; effects are declarative.
**Launch**:

```bash
agents spawn engine "engine-$RANDOM" -- \
  codex exec "$(cat coding_agents/prompts/engine.md)"
```

**Outputs**:

* code + types; summary appended to `subagents/engine_agent.md`

---

### Tests Agent (Codex)

**Goal**: write failing tests first, then drive green; maintain coverage and regression harnesses.
**Launch**:

```bash
agents spawn tests "tests-$RANDOM" -- \
  codex exec "$(cat coding_agents/prompts/tests.md)"
```

**Outputs**:

* new/updated tests; status appended to `subagents/tests_agent.md`

---

## Supervisor / Orchestrator

### Headless orchestrator (bash loop)

`orchestrator.sh` runs the **gate → spawn → reap** loop:

1. Pre-flight gate: `lint`, `test`, `build`
2. Spawn Planning, Tests, and Engine agents (non-blocking)
3. Loop:

   * `agents reap` finished PIDs
   * `agents status`
   * soft health check: `npm run test:run || true`
   * exit when `running-count == 0`
4. Final gate: `lint`, `test`, `build`

Run headless:

```bash
nohup bash orchestrator.sh > coding_agents/logs/orchestrator.out 2>&1 < /dev/null &
echo $! > coding_agents/pids/orchestrator.pid
```

### Optional: streaming Supervisor (`codex proto`)

For a single long-lived Codex controller that issues multiple steps without re-invocation:

```bash
agents spawn supervisor "supervisor-$(date +%H%M%S)" -- \
  codex proto
```

A tiny driver can send protocol messages to stdin and read results from stdout (kept detached by the launcher).

---

## Process Manager Commands

(Provided by `scripts/agents.sh`; alias `agents="bash scripts/agents.sh"`)

```bash
# Spawn agents (Codex flags injected automatically)
agents spawn planning my-plan -- codex exec "$(cat coding_agents/prompts/planning.md)"
agents spawn engine   my-engine -- codex exec "$(cat coding_agents/prompts/engine.md)"
agents spawn tests    my-tests -- codex exec "$(cat coding_agents/prompts/tests.md)"

# Observe / control
agents status                    # list all with PIDs and log paths
agents tail my-tests             # tail a specific agent log
agents reap                      # remove stale pidfiles for exited agents
agents stop my-engine            # graceful stop (TERM, then KILL after timeout)
agents running-count             # number of live agents
```

**Detachment model**: `setsid` + `nohup` + `</dev/null` ensures agents outlive the launching shell and don’t block the main thread.

---

## Logging & Artifacts

* Runtime logs: `coding_agents/logs/<agent>.out`
* Reap events: `coding_agents/logs/_reap.log`
* PIDs: `coding_agents/pids/<agent>.pid`
* Plans/designs: `coding_agents/*.md`, `coding_agents/subagents/*.md`

Each agent appends a short **“Result & Next Steps”** section to its log before exit.

---

## Signals & Shutdown Policy

* **Graceful**: `TERM` (agents should trap, finish current step, then exit)
* **Hard**: `KILL` (only after 10s grace)
* Orchestrator exit always runs the final health gate:

  ```bash
  npm run lint && npm run test:run && npm run build
  ```

---

## Concurrency Guard

Default max concurrent sub-agents: **3**. Supervisors should check `agents running-count` and delay spawns if over budget to avoid local CPU thrash.

---

## Systemd (optional)

Run the orchestrator as a user service that restarts on crash.

`~/.config/systemd/user/coding-orchestrator.service`

```ini
[Unit]
Description=Coding Orchestrator (Codex)
After=default.target

[Service]
WorkingDirectory=%h/<your-repo>
ExecStart=/usr/bin/bash orchestrator.sh
Restart=always
RestartSec=5
StandardInput=null
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
```

Enable:

```bash
systemctl --user daemon-reload
systemctl --user enable --now coding-orchestrator
journalctl --user -u coding-orchestrator -f
```

---

## Prompt Stubs (placeholders)

`coding_agents/prompts/planning.md`

```
You are the Planning Agent for the Eclipse roguelike repo.

Goal: produce/refresh the plan for "App Slim Refactor — Phase 0b":
- User-visible outcomes and acceptance criteria
- Failing test list to drive implementation
- Update coding_agents/checklists/app_slim_phase0b_status.md

Constraints:
- Keep lint/build green; failing tests allowed only if clearly intentional and documented.

Deliverables:
- Update coding_agents/app_slim_refactor_design.md (today’s scope)
- Append a “Decision Log” with any interface/type changes
```

`coding_agents/prompts/engine.md`

```
You are the Engine Implementation Agent.

Task:
- Implement the next slice of Phase 0b per the design doc.
- Pure reducers/engine only; emit declarative effects.
- Update src/game/state.ts and commands.ts types as needed.

Tests first:
- Add/modify tests listed by Planning Agent; make them fail.
Then implement until green.

Output:
- Short summary appended to coding_agents/subagents/engine_agent.md:
  - Files touched
  - Types added/changed
  - Effects emitted
```

`coding_agents/prompts/tests.md`

```
You are the Tests Agent.

Task:
- Create failing tests that encode the acceptance criteria.
- Drive them to green.
- Prefer unit tests for selectors/engine; snapshot tests for labels/guards.

Report:
- Write a brief status to coding_agents/subagents/tests_agent.md:
  - New tests
  - Failures fixed
  - Remaining gaps
```

---

## Acceptance Gates

* Acceptance criteria satisfied.
* `npm run lint && npm run test:run && npm run build` all green.
* Docs updated in `coding_agents/`:

  * Plan includes **Decision Log** and **Follow-ups**
  * Checklists/status reflect current state

---

## Quick Cheatsheet

```bash
# One-time setup
echo 'alias agents="bash scripts/agents.sh"' >> ~/.bashrc
export CODEX_FLAGS="--dangerously-bypass-approvals-and-sandbox --search -C . -p default"

# Start orchestrator headless
nohup bash orchestrator.sh > coding_agents/logs/orchestrator.out 2>&1 < /dev/null &
echo $! > coding_agents/pids/orchestrator.pid

# Day-to-day
agents status
agents tail planning-12345
agents reap
agents stop engine-12345
```

**Result:** a non-blocking, headless Codex setup where the Supervisor orchestrates sub-agents, every process is detached with PID/log bookkeeping, and quality gates stay enforced.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
