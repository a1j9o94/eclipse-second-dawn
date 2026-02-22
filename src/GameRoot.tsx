import { useEffect, useState } from "react";
import { type Resources, type Research } from '../shared/defaults'
// PlayerState imported where needed in selectors/hooks
import { type DifficultyId } from '../shared/types'
import { type FrameId } from './game'
import GameShell from './components/GameShell'
import { getPreGameElement } from './lib/renderPreGame'
import CoachmarkOverlay from './tutorial/CoachmarkOverlay'
import { ALL_PARTS } from '../shared/parts'
import { STEPS } from './tutorial/script'
import useTutorial from './tutorial/useTutorial'
import { event as tutorialEvent } from './tutorial/state'
// import { getEconomyModifiers } from './game/economy'
// blueprint seeding handled in hooks
// StartPage routed via PreGameRouter
import { type FactionId } from '../shared/factions'
// Routed views are rendered inside GameShell
import type { Part } from '../shared/parts'
import { type Ship, type InitiativeEntry } from '../shared/types'
// run init handled in useRunManagement
// lives init handled by utils/inferLives
// combat primitives used inside useCombatLoop
// enemy generation handled by useCombatLoop
// shop reroll/research now routed via engine commands
//
// tonnage computed inside outpost state hook
import type { OutpostEffects as EngineOutpostEffects } from './engine/commands'
// moved snapshot mapping into useMpPhaseNav
// rewards handled by useRunLifecycle
import { loadRunState, clearRunState, recordWin } from './game/storage'
import { rollInventory } from './game/shop'
import { playEffect } from './game/sound'
// MultiplayerStartPage and RoomLobby routed via PreGameRouter
// computePlaybackDelay used in useMpPhaseNav
import type { Id } from '../convex/_generated/dataModel'
import { useMultiplayerGame } from './hooks/useMultiplayerGame'
import { useMpTestTick } from './hooks/useMpSync'
import { useRunManagement } from './hooks/useRunManagement'
// import { getMyEconomyMods, getMyResources } from './adapters/mpSelectors'
import { useEffectsRunner, type EffectSink } from './hooks/useEffectsRunner'
import useOutpostController from './controllers/useOutpostController'
import useOutpostState from './controllers/useOutpostState'
import useMultiplayerGlue from './controllers/useMultiplayerGlue'
// MP phase navigation handled inside useMultiplayerGlue
import { useRunLifecycle } from './hooks/useRunLifecycle'
import { useCombatLoop } from './hooks/useCombatLoop'
import useCombatViewState from './controllers/useCombatViewState'
import { useResourceBarVm } from './hooks/useResourceBarVm'
import { type OutpostPageProps } from './hooks/useOutpostPageProps'
import { useMatchOverClose } from './hooks/useMatchOverClose'
import { useMusicRouting } from './hooks/useMusicRouting'
import { usePersistRunState } from './hooks/usePersistRunState'
import { useRestoreEnv } from './hooks/useRestoreEnv'
import { useAutoStepper } from './hooks/useAutoStepper'
import usePreGameHandlers from './hooks/usePreGameHandlers'
import type { RBProps, CombatProps } from './components/GameShell'
import inferStartingLives from './utils/inferLives'
// Lives now integrated into ResourceBar; banner removed

/**
 * Eclipse Roguelike — Integrated App (v3.24)
 * Mobile-first prototype with difficulty, tight economy, bosses.
 *
 * Fixes in v3.24
 * - Resolve "Cannot read properties of undefined (reading 'baseHull')" by:
 *   • Introducing INITIAL_* constants and lazy state initializers so no state depends on another state's runtime value during initialization.
 *   • Adding safe frame lookup via getFrame(id) to avoid undefined FRAMES[...] access if an unexpected id appears.
 *   • Keeping all ids consistent (interceptor | cruiser | dread).
 * - Added runtime self-tests for makeShip on all frames and safe lookups.
 */



// ------------------------------- Initial Config ----------------------------
// Defaults are now configured in src/config/defaults.ts

// ------------------------------- Integrated App ----------------------------
export default function EclipseIntegrated(){
  const saved = loadRunState();
  const [mode, setMode] = useState<'OUTPOST'|'COMBAT'>('OUTPOST');
  const [lastEffects, setLastEffects] = useState<EngineOutpostEffects | undefined>(undefined);
  const [showRules, setShowRules] = useState(false);
  const [showTechs, setShowTechs] = useState(false);
  const [showWin, setShowWin] = useState(false);
  // help menu lives in GameShell
  const [endless, setEndless] = useState(false);
  // Lives system replaces old grace
  const [livesRemaining, setLivesRemaining] = useState<number>(inferStartingLives(saved?.difficulty ?? null, saved ?? undefined));
  const [difficulty, setDifficulty] = useState<null|DifficultyId>(saved?.difficulty ?? null);
  const [faction, setFaction] = useState<FactionId>(saved?.faction ?? 'industrialists');
  const [opponent, setOpponent] = useState<FactionId>(saved?.opponent ?? 'warmongers');
  const [showNewRun, setShowNewRun] = useState(true);
  const [multiplayerStartMode, setMultiplayerStartMode] = useState<'menu'|'create'|'join'>('menu');
  const [multiplayerCreatePublic, setMultiplayerCreatePublic] = useState<boolean>(false);
  const [openVersusOnHome, setOpenVersusOnHome] = useState<boolean>(false);

  // Outpost state bundle
  const {
    blueprints, setBlueprints,
    resources, setResources,
    research, setResearch,
    rerollCost, setRerollCost,
    rerollsThisRun, setRerollsThisRun,
    baseRerollCost, setBaseRerollCost,
    capacity, setCapacity,
    fleet, setFleet,
    tonnage,
    focused, setFocused,
    shop, setShop,
    shopVersion, setShopVersion,
  } = useOutpostState(saved)

  // Combat view state
  const cv = useCombatViewState()
  // reward paid state now internal to useCombatLoop/useRunLifecycle flows
  const [sector, setSector] = useState(saved?.sector ?? 1); // difficulty progression
  const [stepLock] = useState(false);
  const [matchOver, setMatchOver] = useState<{ winnerName: string } | null>(null);
  const [combatIntroActive, setCombatIntroActive] = useState(mode==='COMBAT');
  const [mpWinMessage, setMpWinMessage] = useState<string | null>(null)
  const [mpSeeded, setMpSeeded] = useState(false);
  const [mpSeedSubmitted, setMpSeedSubmitted] = useState(false);
  const [mpServerSnapshotApplied, setMpServerSnapshotApplied] = useState(false);
  // Legacy flag no longer used; reroll now initializes per-setup round via mpRerollInitRound
  // const [mpRerollInitialized, setMpRerollInitialized] = useState(false);
  // Track the round for which we last initialized reroll in MP so we can reset per-setup round
  const [mpRerollInitRound, setMpRerollInitRound] = useState<number>(0);
  const [mpLastServerApplyRound, setMpLastServerApplyRound] = useState<number>(0);
  // Lobby handles faction selection before the first shop; Outpost no longer prompts per round

  // MP ShipSnapshot conversion now lives in src/multiplayer/snapshot.ts

  // Multiplayer state
  const [gameMode, setGameMode] = useState<'single' | 'multiplayer'>('single');
  const [multiplayerPhase, setMultiplayerPhase] = useState<'menu' | 'public' | 'lobby' | 'game'>('menu');
  const [currentRoomId, setCurrentRoomId] = useState<Id<"rooms"> | null>(null);

  // Multiplayer data (available when in a room)
  const multi = useMultiplayerGame(currentRoomId);
  // Test-only tick to pick up external mock mutations when Convex is not driving reactivity
  const testTick = useMpTestTick(multi, mpServerSnapshotApplied)

  // Bridge for passing startFirstCombat to useRunManagement before combat hook initializes
  const startFirstCombatRef = { current: (()=>{}) as () => void };
  // ---------- Run management ----------
  const { newRun, newRunTutorial, resetRun } = useRunManagement({
    setDifficulty, setFaction, setOpponent: (f)=>setOpponent(f as FactionId), setShowNewRun, playEffect: (k)=>{ void playEffect(k as 'page'|'startCombat'|'equip'|'reroll'|'dock'|'faction'|'tech') }, setEndless, setLivesRemaining,
    setResources, setCapacity, setResearch, setRerollCost, setBaseRerollCost, setSector, setBlueprints: (bp)=>setBlueprints(bp as Record<FrameId, Part[]>), setFleet: (f)=>setFleet(f as unknown as Ship[]), setFocused, setShop, setRerollsThisRun, startFirstCombat: ()=> startFirstCombatRef.current(), clearRunState, setShowRules,
  })
  // Tutorial start helper is provided by the same hook (newRunTutorial)

  const {
    handleRoomJoined,
    handleGameStart,
    handleLeaveRoom,
    handleBackToMainMenu,
    handleContinue,
    handleGoMultiplayer,
    handleGoPublic,
  } = usePreGameHandlers({
    setCurrentRoomId: (id)=>setCurrentRoomId(id as Id<'rooms'> | null),
    setMultiplayerPhase,
    setMultiplayerStartMode,
    setMultiplayerCreatePublic,
    setGameMode,
    setShowNewRun,
    setOpenVersusOnHome,
    playEffect: (k)=>{ void playEffect(k) },
  })

  // ---------- Outpost controller ----------
  const { outpost } = useOutpostController({
    gameMode,
    multi: multi as any,
    state: {
      resources: resources as Resources,
      research: research as Research,
      blueprints: blueprints as Record<FrameId, Part[]>,
      fleet: fleet as unknown as Ship[],
      capacity,
      tonnage,
      shop,
      focused,
      rerollCost,
      rerollsThisRun,
      shopVersion,
      sector,
      endless,
    },
    setters: {
      setResources,
      setResearch: (r)=> setResearch(r as Research),
      setBlueprints: (bp)=> setBlueprints(bp as Record<FrameId, Part[]>),
      setFleet: (s)=> setFleet(s as unknown as Ship[]),
      setCapacity,
      setFocused,
      setRerollCost,
      setRerollsThisRun,
      setShopVersion,
      setShop,
      setLastEffects,
      setBaseRerollCost,
      setMpSeeded,
      setMpSeedSubmitted,
      setMpServerSnapshotApplied,
      setMpLastServerApplyRound,
      setMpRerollInitRound,
    },
    sfx: { playEffect: (k)=> { void playEffect(k) } },
    resetRun,
  })
  const handleReturnFromCombat = useRunLifecycle({
    outcome: cv.outcome,
    combatOver: cv.combatOver,
    livesRemaining,
    gameMode,
    endless,
    baseRerollCost,
    fns: { resetRun, recordWin, clearRunState },
    sfx: { playEffect: (k: string) => playEffect(k as 'page'|'startCombat'|'equip'|'reroll'|'dock'|'faction'|'tech') },
    getters: {
      sector: ()=>sector,
      enemyFleet: ()=>cv.enemyFleet,
      research: ()=>research as Research,
      fleet: ()=>fleet,
      blueprints: ()=>blueprints as Record<FrameId, Part[]>,
      capacity: ()=>capacity,
      faction: ()=>faction,
      difficulty: ()=> (difficulty as DifficultyId),
    },
    setters: { setMode, setResources, setShop, setShopVersion, setRerollCost, setSector: (fn)=> setSector(s=> fn(s)), setFleet, setFocused, setLog: cv.setLog, setShowWin, setEndless, setBaseRerollCost, setLivesRemaining },
    multi,
  })


  // ---------- Enemy Generation ----------
  // enemy generation handled in useCombatLoop

  const combat = useCombatLoop({
    getters: {
      sector: ()=>sector,
      fleet: ()=>fleet,
      enemyFleet: ()=>cv.enemyFleet,
      roundNum: ()=>cv.roundNum,
      turnPtr: ()=>cv.turnPtr,
      combatOver: ()=>cv.combatOver,
      showRules: ()=>showRules,
      rerollsThisRun: ()=>rerollsThisRun,
    },
    setters: {
      setFleet: (f)=> setFleet(f as Ship[]),
      setEnemyFleet: (f)=>cv.setEnemyFleet(f),
      setLog: (fn)=>cv.setLog(fn as unknown as (string[]|((l:string[])=>string[]))),
      setRoundNum: (fn)=>cv.setRoundNum(fn as unknown as (number|((n:number)=>number))),
      setQueue: (q)=>cv.setQueue(q as InitiativeEntry[]),
      setTurnPtr: (n)=>cv.setTurnPtr(n),
      setCombatOver: (v)=>cv.setCombatOver(v),
      setOutcome: (s)=>cv.setOutcome(s),
      setMode,
    },
    sfx: { playEffect },
  })
  // Now that combat hook is ready, wire the ref
  startFirstCombatRef.current = combat.startFirstCombat
  // Centralize engine/adapters effects handling
  useEffectsRunner(lastEffects, {
    warn: (code) => {
      if (code === 'invalid-power-or-drive') {
        console.warn('Ship will not participate in combat until power and drive requirements are met.');
      } else {
        console.warn(`[warning] ${code}`)
      }
    },
    startCombat: combat.startCombat,
    shopItems: (items) => setShop({ items }),
    clearEffects: () => setLastEffects(undefined),
  } as EffectSink)
  async function stepTurn(){ await combat.stepTurn() }
  // Auto-step loop
  useAutoStepper({ enabled: mode==='COMBAT' && !cv.combatOver && !stepLock && !showRules && !combatIntroActive, step: stepTurn, deps: [cv.queue, cv.turnPtr, fleet, cv.enemyFleet, combatIntroActive] })

  // Restore environment if loading from save
  useRestoreEnv(saved)

  // Multiplayer glue (phase nav + setup sync + seed submit)
  useMultiplayerGlue({
    gameMode,
    multi: multi as any,
    testTick,
    baseRerollCost,
    rerollCost,
    mpRerollInitRound,
    mpLastServerApplyRound,
    mode,
    blueprints: blueprints as Record<FrameId, Part[]>,
    fleet: fleet as Ship[],
    mpServerSnapshotApplied,
    mpSeedSubmitted,
    mpSeeded,
    setMode,
    setFleet: (s)=> setFleet(s as Ship[]),
    setEnemyFleet: (s)=> cv.setEnemyFleet(s as Ship[]),
    setMultiplayerPhase,
    setLog: cv.setLog,
    setBlueprints: (bp)=> setBlueprints(bp as Record<FrameId, Part[]>),
    setResearch: (r)=> setResearch(r as Research),
    setBaseRerollCost,
    setRerollCost,
    setCapacity,
    setFocused,
    setMpLastServerApplyRound,
    setMpServerSnapshotApplied,
    setMpSeedSubmitted,
    setMpSeeded,
    setMpRerollInitRound,
    fleetValid: true,
  })

  // MP: Show match-over modal when server marks game finished
  useEffect(() => {
    if (gameMode !== 'multiplayer') return
    if (!multi?.gameState || multi.gameState.currentPhase !== 'finished') return
    if (matchOver) return
    try {
      const winnerId = (multi.gameState as unknown as { matchResult?: { winnerPlayerId?: string } })?.matchResult?.winnerPlayerId
      const players = (multi.roomDetails as { players?: Array<{ playerId:string; playerName?: string }> } | null | undefined)?.players || []
      const name = winnerId ? (players.find(p => p.playerId === winnerId)?.playerName || 'Winner') : 'Winner'
      setMatchOver({ winnerName: name })
    } catch {
      setMatchOver({ winnerName: 'Winner' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode, multi?.gameState?.currentPhase])

  // Validity stream handled in Outpost VM; readiness submits snapshots explicitly

  // Multiplayer capacity is set by server modifiers when available

  // Shop updates now flow via engine effects (useEffectsRunner) and immediate set in handlers

  // First-visit rules & new-run modal
  useEffect(()=>{
    if(difficulty==null) setShowNewRun(true);
  },[difficulty]);

  // Start combat intro on entering combat view
  useEffect(()=>{
    if (mode==='COMBAT') setCombatIntroActive(true)
    else setCombatIntroActive(false)
  },[mode])

  useMusicRouting({ showNewRun, mode, combatOver: cv.combatOver, outcome: cv.outcome })

  // Persist run state
  usePersistRunState({
    difficulty,
    faction,
    opponent,
    resources: resources as Resources,
    research: research as Research,
    rerollCost,
    baseRerollCost,
    capacity,
    sector,
    blueprints: blueprints as Record<FrameId, Part[]>,
    fleet: fleet as Ship[],
    shop,
    livesRemaining,
    rerollsThisRun,
  })
  // Reroll base initialization handled in useMpSync; do not force local rerollCost to base here.
  function dismissRules(){ setShowRules(false); }

  // Self-tests moved to src/__tests__/runtime.selftests.spec.ts

  // ---------- View ----------
  const rbOnReset = () => {
    if (gameMode === 'multiplayer') {
      try {
        // Concede the entire match
        (multi as unknown as { resignMatch?: ()=>Promise<void> })?.resignMatch?.()
      } catch { /* noop */ }
      // Send user back to main menu after resign
      handleBackToMainMenu()
      return
    }
    resetRun()
  }
  const rbVm = useResourceBarVm({ resources: resources as Resources, tonnage, sector, onReset: rbOnReset, gameMode, singleLives: livesRemaining, multi: multi as any })

  const handleMatchOverClose = useMatchOverClose({
    multi: (multi as { prepareRematch?: ()=>Promise<void> }) ?? null,
    setters: { setMatchOver, setMode, setLog: cv.setLog, setRoundNum: cv.setRoundNum, setTurnPtr: cv.setTurnPtr, setQueue: cv.setQueue, setCombatOver: cv.setCombatOver, setOutcome: cv.setOutcome, setMultiplayerPhase },
  })

  // MP: when server marks the match finished, show Win modal to the winner; others see Match Over
  useEffect(() => {
    if (gameMode !== 'multiplayer') return
    if (!multi?.gameState || multi.gameState.currentPhase !== 'finished') return
    try {
      const winnerId = (multi.gameState as unknown as { matchResult?: { winnerPlayerId?: string } })?.matchResult?.winnerPlayerId
      const reason = (multi.gameState as unknown as { matchResult?: { reason?: string } })?.matchResult?.reason
      const me = multi.getPlayerId?.()
      if (winnerId && me && winnerId === me) {
        if (reason === 'resign') {
          setMpWinMessage('Your opponent resigned')
        } else {
          setMpWinMessage(null)
        }
        setShowWin(true)
        setMatchOver(null)
        return
      }
      const players = (multi.roomDetails as { players?: Array<{ playerId:string; playerName?: string }> } | null | undefined)?.players || []
      const name = winnerId ? (players.find(p => p.playerId === winnerId)?.playerName || 'Winner') : 'Winner'
      setMatchOver({ winnerName: name })
    } catch {
      setMatchOver({ winnerName: 'Winner' })
    }
  }, [gameMode, multi?.gameState?.currentPhase])

  // Pre-game routing (start, MP menu/lobby)
  // Tutorial hook must be declared before any early returns to keep hook order stable
  const tut = useTutorial()
  // Seed curated shop on step entry where needed
  useEffect(()=>{
    if (!tut.enabled) return
    const id = tut.step as string
    const idMap: Record<string, string[] | undefined> = {
      'shop-buy-composite-1': ['composite','fusion_source','plasma','positron'],
      'shop-buy-composite-2': ['composite','fusion_source','plasma','positron'],
      'buy-improved': ['improved','fusion_source','plasma'],
      'tech-nano': ['tachyon_drive','antimatter','improved'],
    }
    const wanted = idMap[id]
    if (!wanted) return
    try {
      const items = wanted.map(pid => (ALL_PARTS as Part[]).find(p => p.id===pid)).filter(Boolean) as Part[]
      setShop({ items })
    } catch { /* noop */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tut.step])

  // Do not auto-open Tech list; we prompt the user to tap it.

  const preGame = getPreGameElement({
    gameMode,
    showNewRun,
    faction: faction as string,
    multiplayerPhase,
    multiplayerStartMode,
    multiplayerCreatePublic,
    openVersusOnHome,
    currentRoomId,
    onNewRun: newRun,
            onStartTutorial: () => newRunTutorial(),
    onContinue: handleContinue,
    onGoMultiplayer: handleGoMultiplayer,
    onGoPublic: () => handleGoPublic(),
    onRoomJoined: handleRoomJoined,
    onBack: handleBackToMainMenu,
    onGameStart: handleGameStart,
    onLeaveRoom: handleLeaveRoom,
  })
  if (preGame) return preGame

  return (
    <>
    <GameShell
      showRules={showRules}
      onDismissRules={dismissRules}
      onOpenRules={()=>setShowRules(true)}
      showTechs={showTechs}
      onCloseTechs={()=>setShowTechs(false)}
      showWin={showWin}
      mpWinMessage={mpWinMessage}
      onRestartWin={()=>{ setShowWin(false); setMpWinMessage(null); if (gameMode==='multiplayer') { handleBackToMainMenu() } else { resetRun() } }}
      onEndlessWin={()=>{ setShowWin(false); setMpWinMessage(null); setEndless(true); try { setSector((n)=> Math.max(n, 10) + 1) } catch { /* noop */ } setShop({ items: rollInventory(research as Research) }); setShopVersion(v => v + 1); void playEffect('page') }}
      matchOver={matchOver}
      onMatchOverClose={handleMatchOverClose}
      resourceBar={rbVm as RBProps}
      route={mode}
      outpost={outpost as OutpostPageProps}
      combat={{ combatOver: cv.combatOver, outcome: cv.outcome, roundNum: cv.roundNum, queue: cv.queue as InitiativeEntry[], turnPtr: cv.turnPtr, fleet, enemyFleet: cv.enemyFleet, log: cv.log, onReturn: handleReturnFromCombat, showRules, introActive: combatIntroActive, onIntroDone: ()=> setCombatIntroActive(false) } as CombatProps}
    />
    {/* Tutorial overlay: non-blocking; visible only when relevant to current route */}
    {tut.enabled ? (()=>{
      const id = tut.step as string
      const step = (STEPS as { id:string; copy?:string; anchor?:string; preferSide?: 'top'|'bottom' }[]).find(s=>s.id===id)
      const text = step?.copy || ''
      const show = (() => {
        if (mode==='COMBAT') return false
        // Outpost: show hints for actionable steps only
        const outpostSteps = new Set([
          'intro-combat','outpost-tabs','outpost-blueprint','bar-resources','bar-capacity','bar-sector','bar-lives','shop-buy-composite-1','shop-buy-composite-2','build-interceptor','combat-2','tech-nano','tech-open','tech-close','sell-composite','buy-improved','combat-3','tech-military','capacity-info','dock-expand','select-cruiser','upgrade-interceptor','shop-reroll','intel-open','intel-close','rules-hint','rules-open'
        ])
        return outpostSteps.has(id)
      })()
      if (!show) return null
      const showNext = new Set(['outpost-tabs','outpost-blueprint','bar-resources','bar-capacity','bar-sector','bar-lives','capacity-info']).has(id)
      return (
        <CoachmarkOverlay
          key="tutorial-coach"
          visible={true}
          title="Tutorial"
          text={text}
          anchor={step?.anchor}
          preferSide={step?.preferSide}
          onNext={showNext ? ()=> { try { tutorialEvent('next') } catch { /* noop */ } } : undefined}
        />
      )
    })() : null}
    </>
  )
}
