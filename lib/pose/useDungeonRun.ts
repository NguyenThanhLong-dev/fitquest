'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CONFIG,
  RepCounter,
  THRESHOLDS,
  type ExerciseId,
  type Frame,
} from '@/lib/pose-engine';
import { LandmarkOneEuroFilter } from '@/lib/pose/landmarkFilter';
import {
  FrameStabilityGate,
  evaluateFrameCheck,
  getExerciseDefForPosture,
  type FrameCheckReason,
  type FrameStabilitySnapshot,
} from '@/lib/pose/frameCheck';
import {
  LivenessRunController,
  type LivenessRunSnapshot,
} from '@/lib/pose/liveness';
import {
  SessionGuard,
  getExerciseDef,
  getLevelFromXp,
  getXpProgressInfo,
  type PostureMode,
  type XpProgressInfo,
} from '@/lib/game/engineAdapter';
import {
  advanceMonsterTransition,
  applyCancelledRepToDungeon,
  applyRepToDungeon,
  buildDungeonSummary,
  createDungeonRunState,
  createDungeonSeed,
  swapCurrentMonster,
  type DamageEvent,
  type DungeonRunState,
  type DungeonSummaryData,
  type MonsterEncounter,
  type SkillStatus,
} from '@/lib/game/dungeon';
import {
  FX_CONFIG,
  getBreatherTipIndex,
  getComboMilestone,
  getNewlyUnlockedSkills,
  rollLootChest,
  type ComboMilestone,
  type LootChestRoll,
} from '@/lib/game/cosmetics';
import { playGameSound, unlockGameAudio } from '@/lib/game/sound';
import { useGameStore } from '@/lib/game/store';
import type { ProgressTone } from '@/components/ProgressRing';
import { i18n } from '@/lib/i18n';

const UI_SYNC_INTERVAL_MS = 100;
const POST_REP_FEEDBACK_MS = 2200;
const CANCELLED_BANNER_MS = 2600;
const OUTCOME_BANNER_MS = 3500;
const HIT_BANNER_MS = 1500;

export interface LevelUpCelebration {
  newLevel: number;
  unlockedSkills: SkillStatus[];
  seq: number;
}

export interface DungeonRunUiState {
  initialized: boolean;
  paused: boolean;
  dungeon: DungeonRunState;
  currentMonster: MonsterEncounter | null;
  nextMonster: MonsterEncounter | null;
  summary: DungeonSummaryData | null;
  lootRoll: LootChestRoll | null;
  chestOpened: boolean;
  frameCheck: FrameStabilitySnapshot;
  liveness: LivenessRunSnapshot;
  recentChallengeOutcome: 'passed' | 'failed' | null;
  cancelledReason: FrameCheckReason | null;
  ringProgress: number;
  movementProgress: number;
  currentHoldMs: number;
  targetHoldMs: number;
  awaitingRest: boolean;
  liveMetric: number | null;
  peakThreshold: number;
  isAngleExercise: boolean;
  needsUprightRest: boolean;
  hintText: string;
  hintTone: ProgressTone;
  activeHit: DamageEvent | null;
  hitSeq: number;
  breatherRemainingMs: number;
  breatherTip: string | null;
  bossIntroActive: boolean;
  bossFinisherActive: boolean;
  comboCheer: ComboMilestone | null;
  levelUpCelebration: LevelUpCelebration | null;
  liveXpInfo: XpProgressInfo;
}

interface DungeonRuntime {
  paused: boolean;
  dungeon: DungeonRunState;
  summary: DungeonSummaryData | null;
  lootRoll: LootChestRoll | null;
  chestOpened: boolean;
  finalized: boolean;
  inRep: boolean;
  awaitingRest: boolean;
  progress: number;
  metricValue: number | null;
  currentHoldMs: number;
  peakWithoutHoldFrames: number;
  frameCheck: FrameStabilitySnapshot;
  liveness: LivenessRunSnapshot;
  recentChallengeOutcome: 'passed' | 'failed' | null;
  recentOutcomeUntil: number;
  cancelledReason: FrameCheckReason | null;
  cancelledUntil: number;
  postRepHint: string | null;
  postRepTone: ProgressTone;
  postRepUntil: number;
  hintText: string;
  hintTone: ProgressTone;
  hitSeq: number;
  hitVisibleUntil: number;
  breatherEndWallMs: number | null;
  breatherTip: string | null;
  bossIntroEndWallMs: number | null;
  bossFinisherPending: boolean;
  comboCheer: ComboMilestone | null;
  comboCheerEndWallMs: number | null;
  highestCelebratedLevel: number;
  levelUpCelebration: LevelUpCelebration | null;
  levelUpSeq: number;
  lastChallengeSecond: number | null;
  lastUiSyncAt: number;
  lastFrameT: number;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function createInitialFrameSnapshot(): FrameStabilitySnapshot {
  return {
    stableOk: false,
    stableReason: 'NO_POSE',
    rawOk: false,
    rawReason: 'NO_POSE',
    transitioningTo: null,
    transitionProgress: 0,
    shoulderWidthRatio: null,
    torsoHeightRatio: null,
    shoulderEarRatio: null,
  };
}

function createPlaceholderLivenessSnapshot(): LivenessRunSnapshot {
  return {
    seed: 0,
    isFixedSeed: false,
    schedule: [],
    activeChallenge: null,
    passedCount: 0,
    failedCount: 0,
    lastOutcome: null,
  };
}

function mapRepFlagToHint(exerciseId: ExerciseId, flag: string): string {
  if (flag === 'NOT_DEEP_ENOUGH') {
    return i18n.play.practice.exercises[exerciseId].notDeepEnough;
  }
  return (
    i18n.play.practice.repFlags[flag] ?? i18n.play.practice.status.unknownIssue
  );
}

function createRuntime(
  dungeon: DungeonRunState,
  liveness: LivenessRunSnapshot,
  startingLevel: number
): DungeonRuntime {
  const firstMonster = dungeon.encounters[0];
  return {
    paused: false,
    dungeon,
    summary: null,
    lootRoll: null,
    chestOpened: false,
    finalized: false,
    inRep: false,
    awaitingRest: false,
    progress: 0,
    metricValue: null,
    currentHoldMs: 0,
    peakWithoutHoldFrames: 0,
    frameCheck: createInitialFrameSnapshot(),
    liveness,
    recentChallengeOutcome: null,
    recentOutcomeUntil: 0,
    cancelledReason: null,
    cancelledUntil: 0,
    postRepHint: null,
    postRepTone: 'neutral',
    postRepUntil: 0,
    hintText: firstMonster
      ? i18n.play.practice.exercises[firstMonster.exercise].readyCue
      : i18n.play.practice.status.waitingCamera,
    hintTone: 'neutral',
    hitSeq: 0,
    hitVisibleUntil: 0,
    breatherEndWallMs: null,
    breatherTip: null,
    bossIntroEndWallMs: null,
    bossFinisherPending: false,
    comboCheer: null,
    comboCheerEndWallMs: null,
    highestCelebratedLevel: startingLevel,
    levelUpCelebration: null,
    levelUpSeq: 0,
    lastChallengeSecond: null,
    lastUiSyncAt: 0,
    lastFrameT: 0,
  };
}

function snapshotUi(rt: DungeonRuntime, initialized: boolean): DungeonRunUiState {
  const nowWall = typeof performance !== 'undefined' ? performance.now() : 0;
  const currentMonster = rt.dungeon.encounters[rt.dungeon.currentIndex] ?? null;
  const nextMonster = rt.dungeon.encounters[rt.dungeon.currentIndex + 1] ?? null;
  const exerciseId: ExerciseId = currentMonster?.exercise ?? 'squat';
  const def = getExerciseDef(exerciseId);
  const targetHoldMs = def.holdMs;
  const isAngleExercise = exerciseId === 'side_bend' || exerciseId === 'neck_tilt';
  const frameReady = rt.frameCheck.stableOk;
  const movementProgress = frameReady ? clamp01(rt.progress) : 0;

  let ringProgress = movementProgress;
  let displayHoldMs = 0;

  if (targetHoldMs > 0) {
    if (!frameReady) {
      ringProgress = 0;
      displayHoldMs = 0;
    } else if (rt.awaitingRest) {
      ringProgress = 1;
      displayHoldMs = targetHoldMs;
    } else {
      displayHoldMs = Math.min(targetHoldMs, rt.currentHoldMs);
      ringProgress = clamp01(displayHoldMs / targetHoldMs);
    }
  }

  const activeHit =
    rt.dungeon.lastHit && rt.lastFrameT <= rt.hitVisibleUntil
      ? rt.dungeon.lastHit
      : null;

  const breatherRemainingMs =
    rt.dungeon.phase === 'transitioning' && rt.breatherEndWallMs !== null
      ? Math.max(0, rt.breatherEndWallMs - nowWall)
      : 0;

  const bossIntroActive =
    rt.bossIntroEndWallMs !== null && nowWall < rt.bossIntroEndWallMs;

  const comboCheer =
    rt.comboCheer !== null &&
    rt.comboCheerEndWallMs !== null &&
    nowWall < rt.comboCheerEndWallMs
      ? rt.comboCheer
      : null;

  const displayedXp = rt.summary
    ? rt.summary.totalXpAfter
    : rt.dungeon.startingTotalXp + rt.dungeon.tentativeXpEarned;

  return {
    initialized,
    paused: rt.paused,
    dungeon: rt.dungeon,
    currentMonster,
    nextMonster,
    summary: rt.summary,
    lootRoll: rt.lootRoll,
    chestOpened: rt.chestOpened,
    frameCheck: rt.frameCheck,
    liveness: rt.liveness,
    recentChallengeOutcome: rt.recentChallengeOutcome,
    cancelledReason: rt.cancelledReason,
    ringProgress,
    movementProgress,
    currentHoldMs: displayHoldMs,
    targetHoldMs,
    awaitingRest: rt.awaitingRest,
    liveMetric: rt.metricValue,
    peakThreshold: def.peak,
    isAngleExercise,
    needsUprightRest: rt.peakWithoutHoldFrames >= 3,
    hintText: rt.hintText,
    hintTone: rt.hintTone,
    activeHit,
    hitSeq: rt.hitSeq,
    breatherRemainingMs,
    breatherTip: rt.breatherTip,
    bossIntroActive,
    bossFinisherActive: rt.bossFinisherPending,
    comboCheer,
    levelUpCelebration: rt.levelUpCelebration,
    liveXpInfo: getXpProgressInfo(displayedXp),
  };
}

/**
 * Hook điều phối Dungeon Run (F5a + F5b + chế độ Ngồi F8):
 * - Tạo lượt và bộ đếm theo `postureMode` ('standing' | 'seated').
 * - Chế độ Ngồi chỉ sinh 3–5 quái từ 3 bài thân trên, không lặp liên tiếp; thử thách sống vẫn chạy bình thường.
 */
export function useDungeonRun(postureMode: PostureMode = 'standing') {
  const postureModeRef = useRef<PostureMode>(postureMode);
  const counterRef = useRef<RepCounter | null>(null);
  const filterRef = useRef<LandmarkOneEuroFilter | null>(null);
  const stabilityGateRef = useRef<FrameStabilityGate | null>(null);
  const livenessRef = useRef<LivenessRunController | null>(null);
  const guardRef = useRef<SessionGuard | null>(null);
  const runtimeRef = useRef<DungeonRuntime | null>(null);

  const breatherTimerRef = useRef<number | null>(null);
  const breatherTickRef = useRef<number | null>(null);
  const bossIntroTimerRef = useRef<number | null>(null);
  const bossFinisherTimerRef = useRef<number | null>(null);
  const levelUpTimerRef = useRef<number | null>(null);

  const [uiState, setUiState] = useState<DungeonRunUiState>(() => {
    const placeholderDungeon = createDungeonRunState({
      seed: 0,
      isFixedSeed: false,
      isSampleRun: false,
      postureMode,
      startingTotalXp: 0,
    });
    return snapshotUi(
      createRuntime(placeholderDungeon, createPlaceholderLivenessSnapshot(), 1),
      false
    );
  });

  const playSfx = useCallback(
    (effect: Parameters<typeof playGameSound>[0]) => {
      playGameSound(effect, useGameStore.getState().soundEnabled);
    },
    []
  );

  const clearAllTimers = useCallback(() => {
    if (breatherTimerRef.current !== null) {
      window.clearTimeout(breatherTimerRef.current);
      breatherTimerRef.current = null;
    }
    if (breatherTickRef.current !== null) {
      window.clearInterval(breatherTickRef.current);
      breatherTickRef.current = null;
    }
    if (bossIntroTimerRef.current !== null) {
      window.clearTimeout(bossIntroTimerRef.current);
      bossIntroTimerRef.current = null;
    }
    if (bossFinisherTimerRef.current !== null) {
      window.clearTimeout(bossFinisherTimerRef.current);
      bossFinisherTimerRef.current = null;
    }
    if (levelUpTimerRef.current !== null) {
      window.clearTimeout(levelUpTimerRef.current);
      levelUpTimerRef.current = null;
    }
  }, []);

  const triggerLevelUpBanner = useCallback(
    (fromLevel: number, toLevel: number) => {
      const rt = runtimeRef.current;
      if (!rt || toLevel <= rt.highestCelebratedLevel) return;

      const unlockedSkills = getNewlyUnlockedSkills(fromLevel, toLevel);
      rt.highestCelebratedLevel = toLevel;
      rt.levelUpSeq += 1;
      rt.levelUpCelebration = {
        newLevel: toLevel,
        unlockedSkills,
        seq: rt.levelUpSeq,
      };

      playSfx('levelUp');

      if (levelUpTimerRef.current !== null) {
        window.clearTimeout(levelUpTimerRef.current);
      }
      levelUpTimerRef.current = window.setTimeout(() => {
        const cur = runtimeRef.current;
        if (!cur) return;
        cur.levelUpCelebration = null;
        setUiState(snapshotUi(cur, true));
      }, FX_CONFIG.levelUpBannerMs);
    },
    [playSfx]
  );

  const switchCounterToExercise = useCallback(
    (exerciseId: ExerciseId, mode: PostureMode) => {
      counterRef.current = new RepCounter(
        getExerciseDefForPosture(exerciseId, mode)
      );
      stabilityGateRef.current?.reset();
    },
    []
  );

  const finalizeCurrentRun = useCallback(
    (endedAtMs: number) => {
      const rt = runtimeRef.current;
      const guard = guardRef.current;
      const livenessCtrl = livenessRef.current;
      if (!rt || !guard || !livenessCtrl || rt.finalized) return;

      clearAllTimers();
      rt.finalized = true;
      rt.paused = false;
      rt.inRep = false;
      rt.awaitingRest = false;
      rt.peakWithoutHoldFrames = 0;
      rt.breatherEndWallMs = null;
      rt.breatherTip = null;
      rt.bossIntroEndWallMs = null;
      rt.bossFinisherPending = false;
      rt.dungeon = {
        ...rt.dungeon,
        phase: 'finished',
        transitionUntilMs: null,
      };
      counterRef.current?.reset();

      const store = useGameStore.getState();
      const livenessSnap = livenessCtrl.getSnapshot(endedAtMs);

      const summary = buildDungeonSummary({
        state: rt.dungeon,
        endedAtMs,
        guardResult: guard.verdict(),
        livenessPassed: livenessSnap.passedCount,
        livenessFailed: livenessSnap.failedCount,
        verifiedRepsBefore: store.verifiedReps,
        totalXpBefore: store.totalXp,
      });

      store.commitDungeonRun(
        summary.engineResult,
        summary.countedRepsByExercise,
        summary
      );

      rt.lootRoll = rollLootChest(summary.seed, summary.verdict);
      rt.chestOpened = false;
      rt.summary = summary;
      rt.liveness = livenessSnap;

      if (summary.levelAfter > summary.levelBefore) {
        triggerLevelUpBanner(summary.levelBefore, summary.levelAfter);
      }

      setUiState(snapshotUi(rt, true));
    },
    [clearAllTimers, triggerLevelUpBanner]
  );

  const completeMonsterTransition = useCallback(
    (nowMs: number) => {
      const rt = runtimeRef.current;
      if (!rt || rt.dungeon.phase !== 'transitioning') return;

      if (breatherTimerRef.current !== null) {
        window.clearTimeout(breatherTimerRef.current);
        breatherTimerRef.current = null;
      }
      if (breatherTickRef.current !== null) {
        window.clearInterval(breatherTickRef.current);
        breatherTickRef.current = null;
      }

      const advanceAt = Math.max(
        nowMs,
        (rt.dungeon.transitionUntilMs ?? nowMs) + 10
      );
      const nextDungeon = advanceMonsterTransition(rt.dungeon, advanceAt);
      if (nextDungeon === rt.dungeon) return;

      rt.dungeon = nextDungeon;
      rt.breatherEndWallMs = null;
      rt.breatherTip = null;
      rt.inRep = false;
      rt.awaitingRest = false;
      rt.progress = 0;
      rt.metricValue = null;
      rt.currentHoldMs = 0;
      rt.peakWithoutHoldFrames = 0;
      rt.postRepHint = null;

      if (nextDungeon.phase === 'finished') {
        finalizeCurrentRun(nowMs);
        return;
      }

      const nextMonster = nextDungeon.encounters[nextDungeon.currentIndex];
      if (nextMonster) {
        switchCounterToExercise(nextMonster.exercise, nextDungeon.postureMode);
        rt.hintText = i18n.play.practice.exercises[nextMonster.exercise].readyCue;
        rt.hintTone = 'neutral';

        if (nextMonster.isBoss) {
          rt.bossIntroEndWallMs = performance.now() + FX_CONFIG.bossIntroMs;
          playSfx('bossIntro');
          if (bossIntroTimerRef.current !== null) {
            window.clearTimeout(bossIntroTimerRef.current);
          }
          bossIntroTimerRef.current = window.setTimeout(() => {
            const cur = runtimeRef.current;
            if (!cur) return;
            cur.bossIntroEndWallMs = null;
            setUiState(snapshotUi(cur, true));
          }, FX_CONFIG.bossIntroMs);
        }
      }

      setUiState(snapshotUi(rt, true));
    },
    [finalizeCurrentRun, playSfx, switchCounterToExercise]
  );

  const skipBreather = useCallback(() => {
    unlockGameAudio();
    const rt = runtimeRef.current;
    if (!rt || rt.dungeon.phase !== 'transitioning') return;
    completeMonsterTransition(
      rt.lastFrameT > 0 ? rt.lastFrameT : performance.now()
    );
  }, [completeMonsterTransition]);

  const openLootChest = useCallback(() => {
    unlockGameAudio();
    const rt = runtimeRef.current;
    if (!rt || !rt.lootRoll || rt.chestOpened) return;

    rt.chestOpened = true;
    useGameStore.getState().claimCosmetic(rt.lootRoll.item);
    playSfx('chestOpen');
    setUiState(snapshotUi(rt, true));
  }, [playSfx]);

  const startNewRun = useCallback(
    (isSampleRun = false, overrideMode?: PostureMode) => {
      clearAllTimers();

      const activeMode = overrideMode ?? postureModeRef.current;
      postureModeRef.current = activeMode;
      const { seed, isFixed } = createDungeonSeed();
      const store = useGameStore.getState();

      const dungeon = createDungeonRunState({
        seed,
        isFixedSeed: isFixed,
        isSampleRun,
        postureMode: activeMode,
        startingTotalXp: store.totalXp,
      });

      const firstExercise = dungeon.encounters[0]?.exercise ?? 'overhead_reach';
      const livenessSeed = (seed ^ 0x5f3759df) >>> 0;
      const livenessCtrl = new LivenessRunController(livenessSeed, isFixed);

      counterRef.current = new RepCounter(
        getExerciseDefForPosture(firstExercise, activeMode)
      );
      filterRef.current = new LandmarkOneEuroFilter();
      stabilityGateRef.current = new FrameStabilityGate();
      livenessRef.current = livenessCtrl;
      guardRef.current = new SessionGuard(seed, 0);

      store.startLivenessRun(livenessSeed, livenessCtrl.scheduledCount);

      const startingLevel = getLevelFromXp(store.totalXp);
      const rt = createRuntime(dungeon, livenessCtrl.getSnapshot(), startingLevel);
      runtimeRef.current = rt;
      setUiState(snapshotUi(rt, true));
    },
    [clearAllTimers]
  );

  // Khởi tạo lượt đầu tiên phía client và tự tạo lượt mới khi người chơi đổi công tắc Đứng/Ngồi
  useEffect(() => {
    postureModeRef.current = postureMode;
    startNewRun(false, postureMode);
    return () => {
      clearAllTimers();
    };
  }, [postureMode, startNewRun, clearAllTimers]);

  const togglePause = useCallback(() => {
    unlockGameAudio();
    const rt = runtimeRef.current;
    if (!rt || rt.finalized || rt.dungeon.phase !== 'fighting') return;
    if (rt.liveness.activeChallenge !== null || rt.bossFinisherPending) return;

    rt.paused = !rt.paused;
    if (rt.paused) {
      counterRef.current?.reset();
      rt.inRep = false;
      rt.awaitingRest = false;
      rt.progress = 0;
      rt.metricValue = null;
      rt.currentHoldMs = 0;
      rt.peakWithoutHoldFrames = 0;
    }
    setUiState(snapshotUi(rt, true));
  }, []);

  const swapMonster = useCallback(() => {
    unlockGameAudio();
    const rt = runtimeRef.current;
    if (
      !rt ||
      rt.finalized ||
      rt.paused ||
      rt.bossFinisherPending ||
      rt.dungeon.phase !== 'fighting'
    ) {
      return;
    }
    if (rt.liveness.activeChallenge !== null || rt.dungeon.swapsRemaining <= 0) {
      return;
    }

    const nextDungeon = swapCurrentMonster(rt.dungeon);
    if (nextDungeon === rt.dungeon) return;

    rt.dungeon = nextDungeon;
    rt.inRep = false;
    rt.awaitingRest = false;
    rt.progress = 0;
    rt.metricValue = null;
    rt.currentHoldMs = 0;
    rt.peakWithoutHoldFrames = 0;
    rt.cancelledReason = null;
    rt.postRepHint = null;

    const swapped = nextDungeon.encounters[nextDungeon.currentIndex];
    if (swapped) {
      switchCounterToExercise(swapped.exercise, nextDungeon.postureMode);
      rt.hintText = i18n.play.practice.exercises[swapped.exercise].readyCue;
      rt.hintTone = 'neutral';
    }

    setUiState(snapshotUi(rt, true));
  }, [switchCounterToExercise]);

  const finishRunNow = useCallback(() => {
    unlockGameAudio();
    const rt = runtimeRef.current;
    if (!rt || rt.finalized) return;
    const endedAt = rt.lastFrameT > 0 ? rt.lastFrameT : performance.now();
    finalizeCurrentRun(endedAt);
  }, [finalizeCurrentRun]);

  const pushFrame = useCallback(
    (frame: Frame) => {
      const counter = counterRef.current;
      const filter = filterRef.current;
      const stabilityGate = stabilityGateRef.current;
      const livenessCtrl = livenessRef.current;
      const guard = guardRef.current;
      const rt = runtimeRef.current;

      if (!counter || !filter || !stabilityGate || !livenessCtrl || !guard || !rt) {
        return;
      }

      rt.lastFrameT = frame.t;

      if (rt.finalized || rt.bossFinisherPending || rt.dungeon.phase === 'finished') {
        return;
      }

      let forceSync = false;

      if (frame.lm.length >= 33) {
        filter.applyInPlace(frame.lm, frame.t);
      } else {
        filter.reset();
      }

      if (rt.dungeon.phase === 'transitioning') {
        if (frame.t - rt.lastUiSyncAt >= UI_SYNC_INTERVAL_MS) {
          rt.lastUiSyncAt = frame.t;
          setUiState(snapshotUi(rt, true));
        }
        return;
      }

      const nowWall = performance.now();
      if (
        rt.paused ||
        (rt.bossIntroEndWallMs !== null && nowWall < rt.bossIntroEndWallMs)
      ) {
        return;
      }

      const currentMonster = rt.dungeon.encounters[rt.dungeon.currentIndex];
      if (!currentMonster) return;
      const exerciseId = currentMonster.exercise;
      const activeMode = rt.dungeon.postureMode;
      const reasonMap =
        activeMode === 'seated'
          ? i18n.play.practice.frameCheck.seatedReasons
          : i18n.play.practice.frameCheck.reasons;
      const def = counter.def;
      const isHold = def.holdMs > 0;

      // Lớp 0: Kiểm tra khung hình theo đúng chế độ Đứng / Ngồi
      const prevStableOk = rt.frameCheck.stableOk;
      const prevStableReason = rt.frameCheck.stableReason;
      const rawCheck = evaluateFrameCheck(frame, exerciseId, activeMode);
      const frameSnap = stabilityGate.update(rawCheck, frame.t);
      rt.frameCheck = frameSnap;

      if (
        prevStableOk !== frameSnap.stableOk ||
        prevStableReason !== frameSnap.stableReason
      ) {
        forceSync = true;
      }

      if (rt.cancelledReason && frame.t >= rt.cancelledUntil) {
        rt.cancelledReason = null;
        forceSync = true;
      }
      if (rt.recentChallengeOutcome && frame.t >= rt.recentOutcomeUntil) {
        rt.recentChallengeOutcome = null;
        forceSync = true;
      }

      if (frameSnap.stableOk && rt.dungeon.startedAtMs === null) {
        rt.dungeon = { ...rt.dungeon, startedAtMs: frame.t };
      }

      // Lớp 3b: Thử thách sống vẫn chạy bình thường ở chế độ Ngồi
      guard.onFrame(frame);
      const prevChallengeId = rt.liveness.activeChallenge?.id ?? null;
      const livenessStep = livenessCtrl.onFrame(
        frame,
        rt.dungeon.countedReps.length
      );
      rt.liveness = livenessStep.snapshot;

      if (livenessStep.startedNewChallenge) {
        counter.reset();
        rt.inRep = false;
        rt.awaitingRest = false;
        rt.progress = 0;
        rt.metricValue = null;
        rt.currentHoldMs = 0;
        rt.peakWithoutHoldFrames = 0;
        rt.lastChallengeSecond = null;
        rt.hintText = i18n.play.practice.status.challengePaused;
        rt.hintTone = 'warning';
        forceSync = true;
      }

      if (livenessStep.completedOutcome) {
        const passed = livenessStep.completedOutcome.passed;
        useGameStore.getState().recordChallengeOutcome(passed);
        rt.lastChallengeSecond = null;
        rt.recentChallengeOutcome = passed ? 'passed' : 'failed';
        rt.recentOutcomeUntil = frame.t + OUTCOME_BANNER_MS;
        rt.postRepHint = passed
          ? i18n.play.practice.liveness.outcomePassed
          : i18n.play.practice.liveness.outcomeFailed;
        rt.postRepTone = passed ? 'success' : 'error';
        rt.postRepUntil = frame.t + OUTCOME_BANNER_MS;
        forceSync = true;
      }

      const activeChallenge = rt.liveness.activeChallenge;
      if (prevChallengeId !== (activeChallenge?.id ?? null)) {
        forceSync = true;
      }

      if (activeChallenge !== null) {
        const secLeft = Math.ceil(activeChallenge.remainingMs / 1000);
        if (secLeft > 0 && secLeft !== rt.lastChallengeSecond) {
          rt.lastChallengeSecond = secLeft;
          playSfx('challengeTick');
        }

        rt.hintText = i18n.play.practice.status.challengePaused;
        rt.hintTone = 'warning';
        if (forceSync || frame.t - rt.lastUiSyncAt >= UI_SYNC_INTERVAL_MS) {
          rt.lastUiSyncAt = frame.t;
          setUiState(snapshotUi(rt, true));
        }
        return;
      }

      if (!frameSnap.stableOk) {
        if (rt.inRep && !rt.awaitingRest) {
          rt.cancelledReason = frameSnap.stableReason ?? 'NO_POSE';
          rt.cancelledUntil = frame.t + CANCELLED_BANNER_MS;
          rt.inRep = false;
          rt.dungeon = applyCancelledRepToDungeon(rt.dungeon);
          forceSync = true;
        }

        counter.reset();
        rt.awaitingRest = false;
        rt.progress = 0;
        rt.metricValue = null;
        rt.currentHoldMs = 0;
        rt.peakWithoutHoldFrames = 0;

        const reasonKey: FrameCheckReason = frameSnap.stableReason ?? 'NO_POSE';
        rt.hintText = reasonMap[reasonKey];
        rt.hintTone = rt.cancelledReason ? 'error' : 'warning';

        if (forceSync || frame.t - rt.lastUiSyncAt >= UI_SYNC_INTERVAL_MS) {
          rt.lastUiSyncAt = frame.t;
          setUiState(snapshotUi(rt, true));
        }
        return;
      }

      const pushRes = counter.push(frame);
      const { gate, progress, rep } = pushRes;
      const prevAwaitingRest = rt.awaitingRest;
      rt.metricValue = pushRes.metric ?? null;
      rt.awaitingRest = Boolean(pushRes.awaitingRest);
      rt.currentHoldMs = pushRes.holdMs ?? 0;

      if (!gate.ok) {
        if (rt.inRep && !rt.awaitingRest) {
          rt.cancelledReason = gate.reason ?? 'NO_POSE';
          rt.cancelledUntil = frame.t + CANCELLED_BANNER_MS;
          rt.inRep = false;
          rt.dungeon = applyCancelledRepToDungeon(rt.dungeon);
          forceSync = true;
        }
        rt.progress = 0;
        rt.currentHoldMs = 0;
        rt.peakWithoutHoldFrames = 0;
      } else {
        const p = progress ?? 0;
        rt.progress = p;

        const startThr = isHold
          ? THRESHOLDS.HOLD_START_PROGRESS
          : CONFIG.startProgress;
        const endThr = isHold
          ? THRESHOLDS.HOLD_REARM_PROGRESS
          : CONFIG.endProgress;

        if (isHold && p >= 1 && rt.currentHoldMs === 0 && !rt.awaitingRest && rep === null) {
          rt.peakWithoutHoldFrames += 1;
        } else {
          rt.peakWithoutHoldFrames = 0;
        }

        if (rep !== null) {
          guard.addRep(rep);
          rt.inRep = false;
          rt.cancelledReason = null;
          rt.peakWithoutHoldFrames = 0;

          const prevTentativeLevel = getLevelFromXp(
            rt.dungeon.startingTotalXp + rt.dungeon.tentativeXpEarned
          );
          const wasBoss = currentMonster.isBoss;
          const nextDungeon = applyRepToDungeon(rt.dungeon, rep, frame.t);
          rt.dungeon = nextDungeon;

          if (rep.counted && nextDungeon.lastHit) {
            const hit = nextDungeon.lastHit;
            rt.hitSeq += 1;
            rt.hitVisibleUntil = frame.t + HIT_BANNER_MS;

            const milestone = getComboMilestone(nextDungeon.combo);
            if (milestone !== null) {
              rt.comboCheer = milestone;
              rt.comboCheerEndWallMs =
                performance.now() + FX_CONFIG.comboCheerMs;
              playSfx('comboMilestone');
            }

            const nextTentativeLevel = getLevelFromXp(
              nextDungeon.startingTotalXp + nextDungeon.tentativeXpEarned
            );
            if (nextTentativeLevel > prevTentativeLevel) {
              triggerLevelUpBanner(prevTentativeLevel, nextTentativeLevel);
            }

            if (nextDungeon.phase === 'finished') {
              if (wasBoss && hit.defeatedMonster) {
                playSfx('bossFinisher');
                rt.bossFinisherPending = true;
                rt.hintText = i18n.dungeon.boss.finisherBadge;
                rt.hintTone = 'success';
                setUiState(snapshotUi(rt, true));

                const endT = frame.t;
                bossFinisherTimerRef.current = window.setTimeout(() => {
                  finalizeCurrentRun(endT);
                }, FX_CONFIG.bossFinisherMs);
                return;
              }

              playSfx('defeat');
              finalizeCurrentRun(frame.t);
              return;
            }

            if (nextDungeon.phase === 'transitioning') {
              playSfx('defeat');
              const tips = i18n.dungeon.breather.tips;
              const tipIdx = getBreatherTipIndex(
                currentMonster.stageNumber,
                nextDungeon.seed,
                tips.length
              );
              rt.breatherTip = tips[tipIdx] ?? tips[0];
              rt.breatherEndWallMs =
                performance.now() + FX_CONFIG.breatherDurationMs;
              rt.hintText = i18n.dungeon.defeatedBanner;
              rt.hintTone = 'success';

              if (breatherTimerRef.current !== null) {
                window.clearTimeout(breatherTimerRef.current);
              }
              if (breatherTickRef.current !== null) {
                window.clearInterval(breatherTickRef.current);
              }

              breatherTickRef.current = window.setInterval(() => {
                const cur = runtimeRef.current;
                if (!cur || cur.dungeon.phase !== 'transitioning') return;
                setUiState(snapshotUi(cur, true));
              }, 150);

              const capturedT = frame.t;
              breatherTimerRef.current = window.setTimeout(() => {
                completeMonsterTransition(
                  capturedT + FX_CONFIG.breatherDurationMs
                );
              }, FX_CONFIG.breatherDurationMs);
            } else {
              playSfx(hit.isCrit ? 'crit' : 'hit');
              const statusTexts = i18n.play.practice.status;
              if (rep.flags.length === 0) {
                rt.postRepHint = isHold
                  ? statusTexts.holdComplete
                  : statusTexts.countedGood;
                rt.postRepTone = 'success';
              } else {
                rt.postRepHint = `${statusTexts.countedWithNotePrefix} ${mapRepFlagToHint(def.id, rep.flags[0])}`;
                rt.postRepTone = 'warning';
              }
              rt.postRepUntil = frame.t + POST_REP_FEEDBACK_MS;
              rt.hintText = rt.postRepHint;
              rt.hintTone = rt.postRepTone;
            }
          } else {
            const reason = rep.flags[0]
              ? mapRepFlagToHint(def.id, rep.flags[0])
              : i18n.play.practice.status.unknownIssue;
            rt.postRepHint = `${i18n.play.practice.status.rejectedPrefix} ${reason}`;
            rt.postRepTone = 'error';
            rt.postRepUntil = frame.t + POST_REP_FEEDBACK_MS;
            rt.hintText = rt.postRepHint;
            rt.hintTone = 'error';
          }

          forceSync = true;
        } else if (rt.awaitingRest) {
          rt.inRep = false;
          if (rt.postRepHint && frame.t < rt.postRepUntil) {
            rt.hintText = rt.postRepHint;
            rt.hintTone = rt.postRepTone;
          } else {
            rt.hintText = i18n.play.practice.status.awaitingRest;
            rt.hintTone = 'success';
          }
        } else if (rt.peakWithoutHoldFrames >= 3) {
          rt.inRep = false;
          rt.hintText = i18n.play.practice.status.startFromRest;
          rt.hintTone = 'warning';
        } else {
          if (!rt.inRep) {
            if (p > startThr) {
              rt.inRep = true;
              rt.cancelledReason = null;
              rt.postRepHint = null;
            }
          } else if (p <= endThr) {
            rt.inRep = false;
          }

          if (rt.postRepHint && frame.t < rt.postRepUntil && !rt.inRep) {
            rt.hintText = rt.postRepHint;
            rt.hintTone = rt.postRepTone;
          } else if (rt.inRep) {
            let failedFormId: string | null = null;
            for (let i = 0; i < def.form.length; i++) {
              const check = def.form[i];
              const minCheckProgress = check.id === 'BOTH_WRISTS_UP' ? 0.85 : 0.4;
              if (p >= minCheckProgress && !check.pass(frame)) {
                failedFormId = check.id;
                break;
              }
            }

            if (failedFormId) {
              rt.hintText =
                i18n.play.practice.formChecks[failedFormId] ??
                i18n.play.practice.status.unknownIssue;
              rt.hintTone = 'warning';
            } else if (isHold) {
              if (rt.currentHoldMs > 0) {
                rt.hintText = i18n.play.practice.status.holding;
                rt.hintTone = 'info';
              } else {
                rt.hintText = i18n.play.practice.exercises[def.id].depthCue;
                rt.hintTone = 'info';
              }
            } else if (p >= 1) {
              rt.hintText = i18n.play.practice.exercises[def.id].peakCue;
              rt.hintTone = 'success';
            } else {
              rt.hintText = i18n.play.practice.exercises[def.id].depthCue;
              rt.hintTone = 'info';
            }
          } else {
            rt.postRepHint = null;
            rt.hintText = i18n.play.practice.exercises[def.id].readyCue;
            rt.hintTone = 'neutral';
          }
        }

        if (prevAwaitingRest !== rt.awaitingRest) {
          forceSync = true;
        }
      }

      if (forceSync || frame.t - rt.lastUiSyncAt >= UI_SYNC_INTERVAL_MS) {
        rt.lastUiSyncAt = frame.t;
        setUiState(snapshotUi(rt, true));
      }
    },
    [
      completeMonsterTransition,
      finalizeCurrentRun,
      playSfx,
      triggerLevelUpBanner,
    ]
  );

  return {
    uiState,
    pushFrame,
    togglePause,
    swapMonster,
    skipBreather,
    openLootChest,
    finishRunNow,
    startNewRun,
  };
}