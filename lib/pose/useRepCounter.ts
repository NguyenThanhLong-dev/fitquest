'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CONFIG,
  EXERCISES,
  LM,
  RepCounter,
  SessionGuard,
  THRESHOLDS,
  maxVelocity,
  type ExerciseId,
  type Frame,
  type RepResult,
} from '@/lib/pose-engine';
import type { PostureMode } from '@/lib/game/engineAdapter';
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
  createRunSeed,
  type LivenessRunSnapshot,
} from '@/lib/pose/liveness';
import { useGameStore } from '@/lib/game/store';
import type { ProgressTone } from '@/components/ProgressRing';
import { i18n } from '@/lib/i18n';

const UI_SYNC_INTERVAL_MS = 100;
const POST_REP_FEEDBACK_MS = 2600;
const CANCELLED_BANNER_MS = 3000;
const OUTCOME_BANNER_MS = 3500;

type SecondaryAngleKind = 'shoulderTilt' | 'hipTilt' | 'torsoLean';

function deg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function measureSecondaryAngle(
  exerciseId: ExerciseId,
  frame: Frame
): { kind: SecondaryAngleKind; valueDeg: number; maxDeg: number } | null {
  if (!frame.lm || frame.lm.length < 33) return null;

  const pt = (i: number) => ({ x: frame.lm[i].x * frame.aspect, y: frame.lm[i].y });
  const lineTilt = (i: number, j: number) => {
    const a = pt(i);
    const b = pt(j);
    return Math.abs(deg(Math.atan2(b.y - a.y, Math.abs(b.x - a.x))));
  };
  const torsoLean = () => {
    const ls = pt(LM.L_SHOULDER);
    const rs = pt(LM.R_SHOULDER);
    const lh = pt(LM.L_HIP);
    const rh = pt(LM.R_HIP);
    const sx = (ls.x + rs.x) / 2;
    const sy = (ls.y + rs.y) / 2;
    const hx = (lh.x + rh.x) / 2;
    const hy = (lh.y + rh.y) / 2;
    return deg(Math.atan2(Math.abs(sx - hx), Math.abs(sy - hy)));
  };

  switch (exerciseId) {
    case 'neck_tilt':
      return {
        kind: 'shoulderTilt',
        valueDeg: lineTilt(LM.L_SHOULDER, LM.R_SHOULDER),
        maxDeg: THRESHOLDS.NECK_TILT_SHOULDER_TILT_MAX_DEG,
      };
    case 'side_bend':
      return {
        kind: 'hipTilt',
        valueDeg: lineTilt(LM.L_HIP, LM.R_HIP),
        maxDeg: THRESHOLDS.SIDE_BEND_HIP_TILT_MAX_DEG,
      };
    case 'overhead_reach':
      return {
        kind: 'shoulderTilt',
        valueDeg: lineTilt(LM.L_SHOULDER, LM.R_SHOULDER),
        maxDeg: THRESHOLDS.OVERHEAD_SHOULDER_TILT_MAX_DEG,
      };
    case 'squat':
      return {
        kind: 'torsoLean',
        valueDeg: torsoLean(),
        maxDeg: THRESHOLDS.SQUAT_TORSO_MAX_DEG,
      };
    case 'high_knees':
      return {
        kind: 'torsoLean',
        valueDeg: torsoLean(),
        maxDeg: THRESHOLDS.HIGH_KNEES_TORSO_MAX_DEG,
      };
  }
}

export interface LastRepSnapshot {
  counted: boolean;
  quality: number;
  flags: string[];
  holdMs: number;
  durationMs: number;
  peakVelocity: number;
}

export interface LastRejectionSnapshot {
  flags: string[];
  reasonText: string;
  peakVelocity: number;
  durationMs: number;
  maxProgress: number;
  holdMs: number;
}

export interface ExerciseDebugState {
  isAngleExercise: boolean;
  metricValue: number | null;
  restThreshold: number;
  peakThreshold: number;
  secondaryKind: SecondaryAngleKind;
  secondaryValueDeg: number | null;
  secondaryMaxDeg: number;
  currentHoldMs: number;
  targetHoldMs: number;
  phase: 'ready' | 'active' | 'awaitingRest';
  currentVelocity: number;
  livePeakVelocity: number;
  lastRepPeakVelocity: number | null;
  maxVelocityThreshold: number;
  lastRejection: LastRejectionSnapshot | null;
}

export interface RepCounterUiState {
  exerciseId: ExerciseId;
  runActive: boolean;
  repCount: number;
  validRepsInRun: number;
  ringProgress: number;
  movementProgress: number;
  currentHoldMs: number;
  targetHoldMs: number;
  awaitingRest: boolean;
  frameCheck: FrameStabilitySnapshot;
  cancelledReason: FrameCheckReason | null;
  liveness: LivenessRunSnapshot;
  recentChallengeOutcome: 'passed' | 'failed' | null;
  lastRep: LastRepSnapshot | null;
  hintText: string;
  hintTone: ProgressTone;
  debug: ExerciseDebugState;
}

interface RuntimeState {
  runActive: boolean;
  repCount: number;
  validRepsInRun: number;
  inRep: boolean;
  awaitingRest: boolean;
  progress: number;
  metricValue: number | null;
  secondaryKind: SecondaryAngleKind;
  secondaryValueDeg: number | null;
  secondaryMaxDeg: number;
  prevSampleT: number | null;
  prevSampleP: number;
  currentVelocity: number;
  livePeakVelocity: number;
  currentHoldMs: number;
  frameCheck: FrameStabilitySnapshot;
  cancelledReason: FrameCheckReason | null;
  cancelledUntil: number;
  liveness: LivenessRunSnapshot;
  recentChallengeOutcome: 'passed' | 'failed' | null;
  recentOutcomeUntil: number;
  lastRep: LastRepSnapshot | null;
  lastRejection: LastRejectionSnapshot | null;
  postRepHint: string | null;
  postRepTone: ProgressTone;
  postRepUntil: number;
  hintText: string;
  hintTone: ProgressTone;
  lastUiSyncAt: number;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function getDefaultSecondaryMeta(exerciseId: ExerciseId): {
  kind: SecondaryAngleKind;
  maxDeg: number;
} {
  switch (exerciseId) {
    case 'neck_tilt':
      return { kind: 'shoulderTilt', maxDeg: THRESHOLDS.NECK_TILT_SHOULDER_TILT_MAX_DEG };
    case 'side_bend':
      return { kind: 'hipTilt', maxDeg: THRESHOLDS.SIDE_BEND_HIP_TILT_MAX_DEG };
    case 'overhead_reach':
      return { kind: 'shoulderTilt', maxDeg: THRESHOLDS.OVERHEAD_SHOULDER_TILT_MAX_DEG };
    case 'squat':
      return { kind: 'torsoLean', maxDeg: THRESHOLDS.SQUAT_TORSO_MAX_DEG };
    case 'high_knees':
      return { kind: 'torsoLean', maxDeg: THRESHOLDS.HIGH_KNEES_TORSO_MAX_DEG };
  }
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

function buildPostRepFeedback(
  exerciseId: ExerciseId,
  rep: RepResult
): { text: string; tone: ProgressTone } {
  const { status } = i18n.play.practice;
  const isHold = EXERCISES[exerciseId].holdMs > 0;

  if (rep.counted) {
    if (rep.flags.length === 0) {
      return {
        text: isHold ? status.holdComplete : status.countedGood,
        tone: 'success',
      };
    }
    const note = mapRepFlagToHint(exerciseId, rep.flags[0]);
    return {
      text: `${status.countedWithNotePrefix} ${note}`,
      tone: 'warning',
    };
  }

  const primaryFlag = rep.flags[0];
  const reason = primaryFlag
    ? mapRepFlagToHint(exerciseId, primaryFlag)
    : status.unknownIssue;
  return {
    text: `${status.rejectedPrefix} ${reason}`,
    tone: 'error',
  };
}

function createInitialRuntime(
  exerciseId: ExerciseId,
  livenessSnapshot: LivenessRunSnapshot,
  runActive: boolean,
  validRepsInRun = 0
): RuntimeState {
  const secondary = getDefaultSecondaryMeta(exerciseId);
  return {
    runActive,
    repCount: 0,
    validRepsInRun,
    inRep: false,
    awaitingRest: false,
    progress: 0,
    metricValue: null,
    secondaryKind: secondary.kind,
    secondaryValueDeg: null,
    secondaryMaxDeg: secondary.maxDeg,
    prevSampleT: null,
    prevSampleP: 0,
    currentVelocity: 0,
    livePeakVelocity: 0,
    currentHoldMs: 0,
    frameCheck: createInitialFrameSnapshot(),
    cancelledReason: null,
    cancelledUntil: 0,
    liveness: livenessSnapshot,
    recentChallengeOutcome: null,
    recentOutcomeUntil: 0,
    lastRep: null,
    lastRejection: null,
    postRepHint: null,
    postRepTone: 'neutral',
    postRepUntil: 0,
    hintText: i18n.play.practice.status.waitingCamera,
    hintTone: 'neutral',
    lastUiSyncAt: 0,
  };
}

function snapshotUiState(
  exerciseId: ExerciseId,
  rt: RuntimeState
): RepCounterUiState {
  const def = EXERCISES[exerciseId];
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

  const phase: ExerciseDebugState['phase'] = rt.awaitingRest
    ? 'awaitingRest'
    : rt.inRep
      ? 'active'
      : 'ready';

  return {
    exerciseId,
    runActive: rt.runActive,
    repCount: rt.repCount,
    validRepsInRun: rt.validRepsInRun,
    ringProgress,
    movementProgress,
    currentHoldMs: displayHoldMs,
    targetHoldMs,
    awaitingRest: rt.awaitingRest,
    frameCheck: rt.frameCheck,
    cancelledReason: rt.cancelledReason,
    liveness: rt.liveness,
    recentChallengeOutcome: rt.recentChallengeOutcome,
    lastRep: rt.lastRep,
    hintText: rt.hintText,
    hintTone: rt.hintTone,
    debug: {
      isAngleExercise,
      metricValue: rt.metricValue,
      restThreshold: def.rest,
      peakThreshold: def.peak,
      secondaryKind: rt.secondaryKind,
      secondaryValueDeg: rt.secondaryValueDeg,
      secondaryMaxDeg: rt.secondaryMaxDeg,
      currentHoldMs: displayHoldMs,
      targetHoldMs,
      phase,
      currentVelocity: rt.currentVelocity,
      livePeakVelocity: rt.livePeakVelocity,
      lastRepPeakVelocity: rt.lastRep ? rt.lastRep.peakVelocity : null,
      maxVelocityThreshold: maxVelocity(def),
      lastRejection: rt.lastRejection,
    },
  };
}

/**
 * Hook Chế độ luyện tập (F3 + F4 + hỗ trợ chế độ Ngồi F8):
 * - Dùng `getExerciseDefForPosture` và `evaluateFrameCheck(..., postureMode)`
 *   để chế độ Ngồi chỉ yêu cầu khớp thân trên mà không sửa `pose-engine.ts`.
 */
export function useRepCounter(
  exerciseId: ExerciseId,
  postureMode: PostureMode = 'standing'
) {
  const activeExerciseRef = useRef<ExerciseId>(exerciseId);
  const postureModeRef = useRef<PostureMode>(postureMode);
  const counterRef = useRef<RepCounter | null>(null);
  const filterRef = useRef<LandmarkOneEuroFilter | null>(null);
  const stabilityGateRef = useRef<FrameStabilityGate | null>(null);
  const livenessRef = useRef<LivenessRunController | null>(null);
  const guardRef = useRef<SessionGuard | null>(null);
  const runtimeRef = useRef<RuntimeState | null>(null);

  const [uiState, setUiState] = useState<RepCounterUiState>(() =>
    snapshotUiState(
      exerciseId,
      createInitialRuntime(exerciseId, createPlaceholderLivenessSnapshot(), true, 0)
    )
  );

  // Khởi tạo hoàn toàn phía client sau khi mount
  useEffect(() => {
    const currentId = activeExerciseRef.current;
    const currentMode = postureModeRef.current;
    const { seed, isFixed } = createRunSeed();
    const controller = new LivenessRunController(seed, isFixed);

    counterRef.current = new RepCounter(
      getExerciseDefForPosture(currentId, currentMode)
    );
    filterRef.current = new LandmarkOneEuroFilter();
    stabilityGateRef.current = new FrameStabilityGate();
    livenessRef.current = controller;
    guardRef.current = new SessionGuard(seed, 0);

    const initialRt = createInitialRuntime(
      currentId,
      controller.getSnapshot(),
      true,
      0
    );
    runtimeRef.current = initialRt;

    useGameStore.getState().startLivenessRun(seed, controller.scheduledCount);
    setUiState(snapshotUiState(currentId, initialRt));
  }, []);

  // Khi đổi động tác hoặc đổi chế độ Đứng/Ngồi -> tạo lại RepCounter & reset bộ kiểm tra khung hình
  useEffect(() => {
    const prevId = activeExerciseRef.current;
    const prevMode = postureModeRef.current;
    activeExerciseRef.current = exerciseId;
    postureModeRef.current = postureMode;
    if (prevId === exerciseId && prevMode === postureMode) return;

    const rt = runtimeRef.current;
    counterRef.current = new RepCounter(
      getExerciseDefForPosture(exerciseId, postureMode)
    );
    filterRef.current?.reset();
    stabilityGateRef.current?.reset();

    const livenessSnap =
      livenessRef.current?.getSnapshot() ?? createPlaceholderLivenessSnapshot();
    const nextRt = createInitialRuntime(
      exerciseId,
      livenessSnap,
      rt?.runActive ?? true,
      rt?.validRepsInRun ?? 0
    );
    runtimeRef.current = nextRt;
    setUiState(snapshotUiState(exerciseId, nextRt));
  }, [exerciseId, postureMode]);

  const reset = useCallback(() => {
    const currentId = activeExerciseRef.current;
    const rt = runtimeRef.current;
    if (!rt) return;

    counterRef.current?.reset();
    filterRef.current?.reset();
    rt.repCount = 0;
    rt.inRep = false;
    rt.awaitingRest = false;
    rt.progress = 0;
    rt.currentHoldMs = 0;
    rt.livePeakVelocity = 0;
    rt.lastRep = null;
    rt.lastRejection = null;
    rt.cancelledReason = null;
    rt.postRepHint = null;
    rt.hintText = i18n.play.practice.exercises[currentId].readyCue;
    rt.hintTone = 'neutral';
    setUiState(snapshotUiState(currentId, rt));
  }, []);

  const startNewRun = useCallback(() => {
    const currentId = activeExerciseRef.current;
    const currentMode = postureModeRef.current;
    const { seed, isFixed } = createRunSeed();
    const nextController = new LivenessRunController(seed, isFixed);

    livenessRef.current = nextController;
    guardRef.current = new SessionGuard(seed, 0);
    counterRef.current = new RepCounter(
      getExerciseDefForPosture(currentId, currentMode)
    );
    filterRef.current = new LandmarkOneEuroFilter();
    stabilityGateRef.current = new FrameStabilityGate();

    useGameStore.getState().startLivenessRun(seed, nextController.scheduledCount);

    const nextRt = createInitialRuntime(
      currentId,
      nextController.getSnapshot(),
      true,
      0
    );
    runtimeRef.current = nextRt;
    setUiState(snapshotUiState(currentId, nextRt));
  }, []);

  const stopRun = useCallback(() => {
    const currentId = activeExerciseRef.current;
    const rt = runtimeRef.current;
    if (!rt) return;

    counterRef.current?.reset();
    rt.runActive = false;
    rt.inRep = false;
    rt.awaitingRest = false;
    rt.progress = 0;
    rt.currentHoldMs = 0;
    rt.hintText = i18n.play.practice.status.runEnded;
    rt.hintTone = 'neutral';
    setUiState(snapshotUiState(currentId, rt));
  }, []);

  const pushFrame = useCallback((frame: Frame) => {
    const counter = counterRef.current;
    const filter = filterRef.current;
    const stabilityGate = stabilityGateRef.current;
    const livenessCtrl = livenessRef.current;
    const guard = guardRef.current;
    const rt = runtimeRef.current;

    if (!counter || !filter || !stabilityGate || !livenessCtrl || !guard || !rt) {
      return;
    }

    const def = counter.def;
    const isHold = def.holdMs > 0;
    const currentMode = postureModeRef.current;
    const reasonMap =
      currentMode === 'seated'
        ? i18n.play.practice.frameCheck.seatedReasons
        : i18n.play.practice.frameCheck.reasons;

    const prevStableOk = rt.frameCheck.stableOk;
    const prevStableReason = rt.frameCheck.stableReason;
    const prevAwaitingRest = rt.awaitingRest;
    const prevChallengeId = rt.liveness.activeChallenge?.id ?? null;
    let forceSync = false;

    if (frame.lm.length >= 33) {
      filter.applyInPlace(frame.lm, frame.t);
    } else {
      filter.reset();
    }

    // Kiểm tra khung hình theo đúng chế độ Đứng / Ngồi
    const rawCheck = evaluateFrameCheck(frame, def.id, currentMode);
    const frameSnap = stabilityGate.update(rawCheck, frame.t);
    rt.frameCheck = frameSnap;

    if (prevStableOk !== frameSnap.stableOk || prevStableReason !== frameSnap.stableReason) {
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

    if (!rt.runActive) {
      rt.hintText = i18n.play.practice.status.runEnded;
      rt.hintTone = 'neutral';
      if (forceSync || frame.t - rt.lastUiSyncAt >= UI_SYNC_INTERVAL_MS) {
        rt.lastUiSyncAt = frame.t;
        setUiState(snapshotUiState(def.id, rt));
      }
      return;
    }

    // Thử thách sống vẫn chạy bình thường ở chế độ Ngồi
    guard.onFrame(frame);
    const livenessStep = livenessCtrl.onFrame(frame, rt.validRepsInRun);
    rt.liveness = livenessStep.snapshot;

    if (livenessStep.startedNewChallenge) {
      counter.reset();
      rt.inRep = false;
      rt.awaitingRest = false;
      rt.progress = 0;
      rt.currentHoldMs = 0;
      rt.livePeakVelocity = 0;
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

    if (rt.liveness.activeChallenge !== null) {
      rt.hintText = i18n.play.practice.status.challengePaused;
      rt.hintTone = 'warning';

      if (forceSync || frame.t - rt.lastUiSyncAt >= UI_SYNC_INTERVAL_MS) {
        rt.lastUiSyncAt = frame.t;
        setUiState(snapshotUiState(def.id, rt));
      }
      return;
    }

    if (!frameSnap.stableOk) {
      if (rt.inRep && !rt.awaitingRest) {
        rt.cancelledReason = frameSnap.stableReason ?? 'NO_POSE';
        rt.cancelledUntil = frame.t + CANCELLED_BANNER_MS;
        rt.inRep = false;
        forceSync = true;
      }

      counter.reset();
      rt.awaitingRest = false;
      rt.progress = 0;
      rt.metricValue = null;
      rt.secondaryValueDeg = null;
      rt.prevSampleT = null;
      rt.prevSampleP = 0;
      rt.currentVelocity = 0;
      rt.livePeakVelocity = 0;
      rt.currentHoldMs = 0;

      const reasonKey: FrameCheckReason = frameSnap.stableReason ?? 'NO_POSE';
      rt.hintText = reasonMap[reasonKey];
      rt.hintTone = rt.cancelledReason ? 'error' : 'warning';

      if (forceSync || frame.t - rt.lastUiSyncAt >= UI_SYNC_INTERVAL_MS) {
        rt.lastUiSyncAt = frame.t;
        setUiState(snapshotUiState(def.id, rt));
      }
      return;
    }

    const pushRes = counter.push(frame);
    const { gate, progress, rep } = pushRes;
    rt.metricValue = pushRes.metric ?? null;
    rt.awaitingRest = Boolean(pushRes.awaitingRest);
    rt.currentHoldMs = pushRes.holdMs ?? 0;

    if (!gate.ok) {
      if (rt.inRep && !rt.awaitingRest) {
        rt.cancelledReason = gate.reason ?? 'NO_POSE';
        rt.cancelledUntil = frame.t + CANCELLED_BANNER_MS;
        rt.inRep = false;
        forceSync = true;
      }
      rt.progress = 0;
      rt.currentHoldMs = 0;
      rt.livePeakVelocity = 0;
    } else {
      const secondary = measureSecondaryAngle(def.id, frame);
      if (secondary) {
        rt.secondaryKind = secondary.kind;
        rt.secondaryValueDeg = secondary.valueDeg;
        rt.secondaryMaxDeg = secondary.maxDeg;
      }

      const p = progress ?? 0;

      let instVelocity = 0;
      if (rt.prevSampleT !== null && frame.t > rt.prevSampleT) {
        const dtSec = (frame.t - rt.prevSampleT) / 1000;
        if (dtSec > 0) {
          instVelocity = Math.abs(p - rt.prevSampleP) / dtSec;
        }
      }
      rt.prevSampleT = frame.t;
      rt.prevSampleP = p;
      rt.currentVelocity = instVelocity;
      rt.progress = p;

      const startThr = isHold ? THRESHOLDS.HOLD_START_PROGRESS : CONFIG.startProgress;
      const endThr = isHold ? THRESHOLDS.HOLD_REARM_PROGRESS : CONFIG.endProgress;

      if (rep !== null) {
        guard.addRep(rep);
        rt.inRep = false;
        rt.livePeakVelocity = rep.peakVelocity;
        rt.cancelledReason = null;

        if (rep.counted) {
          rt.repCount += 1;
          rt.validRepsInRun += 1;
        }

        rt.lastRep = {
          counted: rep.counted,
          quality: rep.quality,
          flags: rep.flags,
          holdMs: rep.holdMs,
          durationMs: rep.durationMs,
          peakVelocity: rep.peakVelocity,
        };

        const feedback = buildPostRepFeedback(def.id, rep);
        if (!rep.counted) {
          rt.lastRejection = {
            flags: [...rep.flags],
            reasonText: feedback.text,
            peakVelocity: rep.peakVelocity,
            durationMs: rep.durationMs,
            maxProgress: rep.maxProgress,
            holdMs: rep.holdMs,
          };
        }

        rt.postRepHint = feedback.text;
        rt.postRepTone = feedback.tone;
        rt.postRepUntil = frame.t + POST_REP_FEEDBACK_MS;
        rt.hintText = feedback.text;
        rt.hintTone = feedback.tone;
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
              rt.livePeakVelocity = 0;
              rt.cancelledReason = null;
              rt.postRepHint = null;
            }
          }
        } else if (p <= endThr) {
          rt.inRep = false;
          rt.livePeakVelocity = 0;
        } else if (instVelocity > rt.livePeakVelocity) {
          rt.livePeakVelocity = instVelocity;
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

    const elapsedSinceSync = frame.t - rt.lastUiSyncAt;
    if (forceSync || elapsedSinceSync >= UI_SYNC_INTERVAL_MS) {
      rt.lastUiSyncAt = frame.t;
      const next = snapshotUiState(def.id, rt);

      setUiState((prev) => {
        const sameProgress =
          Math.round(prev.ringProgress * 100) ===
            Math.round(next.ringProgress * 100) &&
          Math.round(prev.movementProgress * 100) ===
            Math.round(next.movementProgress * 100) &&
          Math.round(prev.currentHoldMs / 50) ===
            Math.round(next.currentHoldMs / 50);

        const sameFrameCheck =
          prev.frameCheck.stableOk === next.frameCheck.stableOk &&
          prev.frameCheck.stableReason === next.frameCheck.stableReason &&
          prev.frameCheck.rawOk === next.frameCheck.rawOk &&
          prev.frameCheck.rawReason === next.frameCheck.rawReason &&
          prev.frameCheck.transitioningTo === next.frameCheck.transitioningTo;

        const sameDebug =
          Math.round((prev.debug.metricValue ?? -999) * 10) ===
            Math.round((next.debug.metricValue ?? -999) * 10) &&
          Math.round((prev.debug.secondaryValueDeg ?? -999) * 10) ===
            Math.round((next.debug.secondaryValueDeg ?? -999) * 10) &&
          Math.round(prev.debug.currentVelocity * 10) ===
            Math.round(next.debug.currentVelocity * 10) &&
          Math.round(prev.debug.livePeakVelocity * 10) ===
            Math.round(next.debug.livePeakVelocity * 10) &&
          prev.debug.phase === next.debug.phase &&
          prev.debug.lastRepPeakVelocity === next.debug.lastRepPeakVelocity &&
          prev.debug.lastRejection === next.debug.lastRejection;

        if (
          !forceSync &&
          sameProgress &&
          sameFrameCheck &&
          sameDebug &&
          prev.runActive === next.runActive &&
          prev.repCount === next.repCount &&
          prev.validRepsInRun === next.validRepsInRun &&
          prev.awaitingRest === next.awaitingRest &&
          prev.cancelledReason === next.cancelledReason &&
          prev.recentChallengeOutcome === next.recentChallengeOutcome &&
          prev.hintText === next.hintText &&
          prev.hintTone === next.hintTone &&
          prev.lastRep === next.lastRep
        ) {
          return prev;
        }

        return next;
      });
    }
  }, []);

  return {
    uiState,
    pushFrame,
    reset,
    startNewRun,
    stopRun,
  };
}