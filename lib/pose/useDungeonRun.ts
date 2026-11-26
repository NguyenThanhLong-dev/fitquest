'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CONFIG,
  EXERCISES,
  RepCounter,
  THRESHOLDS,
  type ExerciseId,
  type Frame,
} from '@/lib/pose-engine';
import { LandmarkOneEuroFilter } from '@/lib/pose/landmarkFilter';
import {
  FrameStabilityGate,
  evaluateFrameCheck,
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
  getXpProgressInfo,
  type XpProgressInfo,
} from '@/lib/game/engineAdapter';
import {
  DUNGEON_CONFIG,
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
} from '@/lib/game/dungeon';
import { useGameStore } from '@/lib/game/store';
import type { ProgressTone } from '@/components/ProgressRing';
import { i18n } from '@/lib/i18n';

// Chỉ đồng bộ React state tối đa mỗi 100ms khi không có sự kiện quan trọng
const UI_SYNC_INTERVAL_MS = 100;
const POST_REP_FEEDBACK_MS = 2200;
const CANCELLED_BANNER_MS = 2600;
const OUTCOME_BANNER_MS = 3500;
const HIT_BANNER_MS = 1800;

export interface DungeonRunUiState {
  initialized: boolean;
  paused: boolean;
  dungeon: DungeonRunState;
  currentMonster: MonsterEncounter | null;
  summary: DungeonSummaryData | null;
  frameCheck: FrameStabilitySnapshot;
  liveness: LivenessRunSnapshot;
  recentChallengeOutcome: 'passed' | 'failed' | null;
  cancelledReason: FrameCheckReason | null;
  ringProgress: number;
  movementProgress: number;
  currentHoldMs: number;
  targetHoldMs: number;
  awaitingRest: boolean;
  hintText: string;
  hintTone: ProgressTone;
  /** Sự kiện đòn đánh vừa tung ra để hiển thị sát thương / Chí mạng / +XP nổi. */
  activeHit: DamageEvent | null;
  hitSeq: number;
  /** Thanh XP hiển thị trực tiếp (cập nhật theo XP tạm khi đang đánh, và XP chính thức khi xong). */
  liveXpInfo: XpProgressInfo;
}

interface DungeonRuntime {
  paused: boolean;
  dungeon: DungeonRunState;
  summary: DungeonSummaryData | null;
  finalized: boolean;
  inRep: boolean;
  awaitingRest: boolean;
  progress: number;
  currentHoldMs: number;
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
  liveness: LivenessRunSnapshot
): DungeonRuntime {
  const firstMonster = dungeon.encounters[0];
  return {
    paused: false,
    dungeon,
    summary: null,
    finalized: false,
    inRep: false,
    awaitingRest: false,
    progress: 0,
    currentHoldMs: 0,
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
    lastUiSyncAt: 0,
    lastFrameT: 0,
  };
}

function snapshotUi(rt: DungeonRuntime, initialized: boolean): DungeonRunUiState {
  const currentMonster = rt.dungeon.encounters[rt.dungeon.currentIndex] ?? null;
  const exerciseId: ExerciseId = currentMonster?.exercise ?? 'squat';
  const targetHoldMs = getExerciseDef(exerciseId).holdMs;
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

  const displayedXp = rt.summary
    ? rt.summary.totalXpAfter
    : rt.dungeon.startingTotalXp + rt.dungeon.tentativeXpEarned;

  return {
    initialized,
    paused: rt.paused,
    dungeon: rt.dungeon,
    currentMonster,
    summary: rt.summary,
    frameCheck: rt.frameCheck,
    liveness: rt.liveness,
    recentChallengeOutcome: rt.recentChallengeOutcome,
    cancelledReason: rt.cancelledReason,
    ringProgress,
    movementProgress,
    currentHoldMs: displayHoldMs,
    targetHoldMs,
    awaitingRest: rt.awaitingRest,
    hintText: rt.hintText,
    hintTone: rt.hintTone,
    activeHit,
    hitSeq: rt.hitSeq,
    liveXpInfo: getXpProgressInfo(displayedXp),
  };
}

/**
 * Hook điều phối toàn bộ vòng lặp Dungeon Run (F5a):
 * - Kết nối FrameStabilityGate (F4 Lớp 0), LivenessRunController (F4 Lớp 3b),
 *   RepCounter + SessionGuard (pose-engine) và logic thuần lib/game/dungeon.ts.
 * - Không sinh seed lúc SSR (tránh lỗi Hydration), không re-render React mỗi frame.
 */
export function useDungeonRun() {
  const counterRef = useRef<RepCounter | null>(null);
  const filterRef = useRef<LandmarkOneEuroFilter | null>(null);
  const stabilityGateRef = useRef<FrameStabilityGate | null>(null);
  const livenessRef = useRef<LivenessRunController | null>(null);
  const guardRef = useRef<SessionGuard | null>(null);
  const runtimeRef = useRef<DungeonRuntime | null>(null);
  const transitionTimerRef = useRef<number | null>(null);

  // State khởi tạo tất định (seed: 0) để SSR và Client khớp nhau 100%
  const [uiState, setUiState] = useState<DungeonRunUiState>(() => {
    const placeholderDungeon = createDungeonRunState({
      seed: 0,
      isFixedSeed: false,
      isSampleRun: false,
      startingTotalXp: 0,
    });
    return snapshotUi(
      createRuntime(placeholderDungeon, createPlaceholderLivenessSnapshot()),
      false
    );
  });

  const clearTransitionTimer = useCallback(() => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  }, []);

  /** Tạo bộ đếm mới khi chuyển sang quái có động tác khác. */
  const switchCounterToExercise = useCallback((exerciseId: ExerciseId) => {
    counterRef.current = new RepCounter(EXERCISES[exerciseId]);
    stabilityGateRef.current?.reset();
  }, []);

  /** Kết thúc lượt & gọi finalizeRun() đúng MỘT lần, rồi ghi kết quả vào Zustand. */
  const finalizeCurrentRun = useCallback(
    (endedAtMs: number) => {
      const rt = runtimeRef.current;
      const guard = guardRef.current;
      const livenessCtrl = livenessRef.current;
      if (!rt || !guard || !livenessCtrl || rt.finalized) return;

      clearTransitionTimer();
      rt.finalized = true;
      rt.paused = false;
      rt.inRep = false;
      rt.awaitingRest = false;
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

      rt.summary = summary;
      rt.liveness = livenessSnap;
      setUiState(snapshotUi(rt, true));
    },
    [clearTransitionTimer]
  );

  /** Hoàn tất bước chuyển từ quái vừa bị hạ sang quái kế tiếp (~1s). */
  const completeMonsterTransition = useCallback(
    (nowMs: number) => {
      const rt = runtimeRef.current;
      if (!rt || rt.dungeon.phase !== 'transitioning') return;

      clearTransitionTimer();
      const nextDungeon = advanceMonsterTransition(rt.dungeon, nowMs);
      if (nextDungeon === rt.dungeon) return;

      rt.dungeon = nextDungeon;
      rt.inRep = false;
      rt.awaitingRest = false;
      rt.progress = 0;
      rt.currentHoldMs = 0;
      rt.postRepHint = null;

      if (nextDungeon.phase === 'finished') {
        finalizeCurrentRun(nowMs);
        return;
      }

      const nextMonster = nextDungeon.encounters[nextDungeon.currentIndex];
      if (nextMonster) {
        switchCounterToExercise(nextMonster.exercise);
        rt.hintText = i18n.play.practice.exercises[nextMonster.exercise].readyCue;
        rt.hintTone = 'neutral';
      }

      setUiState(snapshotUi(rt, true));
    },
    [clearTransitionTimer, finalizeCurrentRun, switchCounterToExercise]
  );

  /** Khởi tạo một lượt Dungeon Run mới (thường hoặc Lượt mẫu 3 quái × 2 rep). */
  const startNewRun = useCallback(
    (isSampleRun = false) => {
      clearTransitionTimer();

      const { seed, isFixed } = createDungeonSeed();
      const store = useGameStore.getState();

      const dungeon = createDungeonRunState({
        seed,
        isFixedSeed: isFixed,
        isSampleRun,
        startingTotalXp: store.totalXp,
      });

      const firstExercise = dungeon.encounters[0]?.exercise ?? 'squat';
      // Dùng hạt giống lệch bit cho lịch thử thách sống để độc lập với chuỗi quái
      const livenessSeed = (seed ^ 0x5f3759df) >>> 0;
      const livenessCtrl = new LivenessRunController(livenessSeed, isFixed);

      counterRef.current = new RepCounter(EXERCISES[firstExercise]);
      filterRef.current = new LandmarkOneEuroFilter();
      stabilityGateRef.current = new FrameStabilityGate();
      livenessRef.current = livenessCtrl;
      guardRef.current = new SessionGuard(seed, 0);

      store.startLivenessRun(livenessSeed, livenessCtrl.scheduledCount);

      const rt = createRuntime(dungeon, livenessCtrl.getSnapshot());
      runtimeRef.current = rt;
      setUiState(snapshotUi(rt, true));
    },
    [clearTransitionTimer]
  );

  // Chỉ sinh seed và khởi tạo lượt đầu tiên phía client sau khi mount
  useEffect(() => {
    startNewRun(false);
    return () => {
      clearTransitionTimer();
    };
  }, [startNewRun, clearTransitionTimer]);

  /** Tạm dừng / Tiếp tục lượt (khóa không cho tạm dừng trong lúc đang có Thử thách sống). */
  const togglePause = useCallback(() => {
    const rt = runtimeRef.current;
    if (!rt || rt.finalized || rt.dungeon.phase !== 'fighting') return;
    if (rt.liveness.activeChallenge !== null) return;

    rt.paused = !rt.paused;
    if (rt.paused) {
      counterRef.current?.reset();
      rt.inRep = false;
      rt.awaitingRest = false;
      rt.progress = 0;
      rt.currentHoldMs = 0;
    }
    setUiState(snapshotUi(rt, true));
  }, []);

  /** Kỹ năng hoạt động thật: "Đổi quái miễn phí" (1 lần/lượt, sang động tác khác). */
  const swapMonster = useCallback(() => {
    const rt = runtimeRef.current;
    if (!rt || rt.finalized || rt.paused || rt.dungeon.phase !== 'fighting') {
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
    rt.currentHoldMs = 0;
    rt.cancelledReason = null;
    rt.postRepHint = null;

    const swapped = nextDungeon.encounters[nextDungeon.currentIndex];
    if (swapped) {
      switchCounterToExercise(swapped.exercise);
      rt.hintText = i18n.play.practice.exercises[swapped.exercise].readyCue;
      rt.hintTone = 'neutral';
    }

    setUiState(snapshotUi(rt, true));
  }, [switchCounterToExercise]);

  /** Người chơi chủ động bấm "Kết thúc lượt" sớm để gọi finalizeRun và xem tổng kết. */
  const finishRunNow = useCallback(() => {
    const rt = runtimeRef.current;
    if (!rt || rt.finalized) return;
    const endedAt = rt.lastFrameT > 0 ? rt.lastFrameT : performance.now();
    finalizeCurrentRun(endedAt);
  }, [finalizeCurrentRun]);

  /** Nhận từng khung hình từ MediaPipe (chạy trên ref, chỉ sync UI khi đổi sự kiện hoặc ~100ms). */
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

      // Đã kết thúc lượt -> không xử lý thêm
      if (rt.finalized || rt.dungeon.phase === 'finished') return;

      let forceSync = false;

      // 1. Làm mượt landmarks bằng One Euro Filter
      if (frame.lm.length >= 33) {
        filter.applyInPlace(frame.lm, frame.t);
      } else {
        filter.reset();
      }

      // 2. Xử lý giai đoạn chờ ~1s sau khi vừa hạ quái
      if (rt.dungeon.phase === 'transitioning') {
        if (
          rt.dungeon.transitionUntilMs !== null &&
          frame.t >= rt.dungeon.transitionUntilMs
        ) {
          completeMonsterTransition(frame.t);
        } else if (frame.t - rt.lastUiSyncAt >= UI_SYNC_INTERVAL_MS) {
          rt.lastUiSyncAt = frame.t;
          setUiState(snapshotUi(rt, true));
        }
        return;
      }

      // 3. Nếu đang tạm dừng -> giữ nguyên trạng thái, không đếm rep
      if (rt.paused) return;

      const currentMonster = rt.dungeon.encounters[rt.dungeon.currentIndex];
      if (!currentMonster) return;
      const exerciseId = currentMonster.exercise;
      const def = counter.def;
      const isHold = def.holdMs > 0;

      // 4. Lớp 0: Kiểm tra khung hình có chống nhấp nháy 400ms
      const prevStableOk = rt.frameCheck.stableOk;
      const prevStableReason = rt.frameCheck.stableReason;
      const rawCheck = evaluateFrameCheck(frame, exerciseId);
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

      // Ghi nhận mốc bắt đầu lượt ngay khi người tập ở khung hình sẵn sàng lần đầu
      if (frameSnap.stableOk && rt.dungeon.startedAtMs === null) {
        rt.dungeon = { ...rt.dungeon, startedAtMs: frame.t };
      }

      // 5. Lớp 3b: SessionGuard + Thử thách sống theo seed
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
        rt.currentHoldMs = 0;
        rt.hintText = i18n.play.practice.status.challengePaused;
        rt.hintTone = 'warning';
        forceSync = true;
      }

      if (livenessStep.completedOutcome) {
        const passed = livenessStep.completedOutcome.passed;
        useGameStore.getState().recordChallengeOutcome(passed);
        rt.recentChallengeOutcome = passed ? 'passed' : 'failed';
        rt.recentOutcomeUntil = frame.t + OUTCOME_BANNER_MS;
        rt.postRepHint = passed
          ? i18n.play.practice.liveness.outcomePassed
          : i18n.play.practice.liveness.outcomeFailed;
        rt.postRepTone = passed ? 'success' : 'error';
        rt.postRepUntil = frame.t + OUTCOME_BANNER_MS;
        forceSync = true;
      }

      const currentChallengeId = rt.liveness.activeChallenge?.id ?? null;
      if (prevChallengeId !== currentChallengeId) {
        forceSync = true;
      }

      // Tạm dừng đếm rep trong khi Thử thách sống đang hiện
      if (rt.liveness.activeChallenge !== null) {
        rt.hintText = i18n.play.practice.status.challengePaused;
        rt.hintTone = 'warning';
        if (forceSync || frame.t - rt.lastUiSyncAt >= UI_SYNC_INTERVAL_MS) {
          rt.lastUiSyncAt = frame.t;
          setUiState(snapshotUi(rt, true));
        }
        return;
      }

      // 6. Chỉ đếm rep khi khung hình ở trạng thái "Sẵn sàng"
      if (!frameSnap.stableOk) {
        if (rt.inRep && !rt.awaitingRest) {
          rt.cancelledReason = frameSnap.stableReason ?? 'NO_POSE';
          rt.cancelledUntil = frame.t + CANCELLED_BANNER_MS;
          rt.inRep = false;
          // Hủy rep -> reset combo về 0
          rt.dungeon = applyCancelledRepToDungeon(rt.dungeon);
          forceSync = true;
        }

        counter.reset();
        rt.awaitingRest = false;
        rt.progress = 0;
        rt.currentHoldMs = 0;

        const reasonKey: FrameCheckReason = frameSnap.stableReason ?? 'NO_POSE';
        rt.hintText = i18n.play.practice.frameCheck.reasons[reasonKey];
        rt.hintTone = rt.cancelledReason ? 'error' : 'warning';

        if (forceSync || frame.t - rt.lastUiSyncAt >= UI_SYNC_INTERVAL_MS) {
          rt.lastUiSyncAt = frame.t;
          setUiState(snapshotUi(rt, true));
        }
        return;
      }

      // 7. Đẩy khung hình vào RepCounter của pose-engine.ts
      const pushRes = counter.push(frame);
      const { gate, progress, rep } = pushRes;
      const prevAwaitingRest = rt.awaitingRest;
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
      } else {
        const p = progress ?? 0;
        rt.progress = p;

        const startThr = isHold
          ? THRESHOLDS.HOLD_START_PROGRESS
          : CONFIG.startProgress;
        const endThr = isHold
          ? THRESHOLDS.HOLD_REARM_PROGRESS
          : CONFIG.endProgress;

        if (rep !== null) {
          guard.addRep(rep);
          rt.inRep = false;
          rt.cancelledReason = null;

          const nextDungeon = applyRepToDungeon(rt.dungeon, rep, frame.t);
          rt.dungeon = nextDungeon;

          if (rep.counted && nextDungeon.lastHit) {
            rt.hitSeq += 1;
            rt.hitVisibleUntil = frame.t + HIT_BANNER_MS;

            if (nextDungeon.phase === 'finished') {
              finalizeCurrentRun(frame.t);
              return;
            }

            if (nextDungeon.phase === 'transitioning') {
              rt.hintText = i18n.dungeon.defeatedBanner;
              rt.hintTone = 'success';
              // Hẹn giờ dự phòng ~1s để vẫn chuyển quái mượt kể cả khi người chơi tạm rời khung ăn mừng
              clearTransitionTimer();
              const targetAt = nextDungeon.transitionUntilMs ?? frame.t + DUNGEON_CONFIG.transitionDelayMs;
              transitionTimerRef.current = window.setTimeout(() => {
                completeMonsterTransition(targetAt + 10);
              }, DUNGEON_CONFIG.transitionDelayMs);
            } else {
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
        } else {
          if (!rt.inRep) {
            if (p > startThr && (!isHold || p <= 1.0 || rt.currentHoldMs > 0)) {
              if (isHold && p >= 1 && rt.currentHoldMs === 0) {
                rt.hintText = i18n.play.practice.status.startFromRest;
                rt.hintTone = 'warning';
              } else {
                rt.inRep = true;
                rt.cancelledReason = null;
                rt.postRepHint = null;
              }
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
              if (rt.currentHoldMs > 0 || p >= 1) {
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
          } else if (!(isHold && p >= 1 && rt.currentHoldMs === 0)) {
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
    [clearTransitionTimer, completeMonsterTransition, finalizeCurrentRun]
  );

  return {
    uiState,
    pushFrame,
    togglePause,
    swapMonster,
    finishRunNow,
    startNewRun,
  };
}