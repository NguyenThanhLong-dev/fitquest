'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CONFIG,
  EXERCISES,
  RepCounter,
  SessionGuard,
  THRESHOLDS,
  maxVelocity,
  newSeed,
  qualityGate,
  type ExerciseId,
  type Frame,
  type GateResult,
  type RepResult,
} from '@/lib/pose-engine';
import type { PostureMode } from '@/lib/game/engineAdapter';
import { LandmarkOneEuroFilter } from '@/lib/pose/landmarkFilter';
import {
  evaluateFrameCheck,
  getExerciseDefForPosture,
  getRequiredLandmarks,
  type FrameCheckResult,
} from '@/lib/pose/frameCheck';
import {
  finalizeCalibrationSession,
  isAngleMetricExercise,
  type CalibrationRepLog,
  type CalibrationSessionLog,
  type TrialType,
} from '@/lib/game/calibration';
import { i18n } from '@/lib/i18n';

const UI_SYNC_INTERVAL_MS = 100;

export interface CalibrationLiveTelemetry {
  exercise: ExerciseId;
  postureMode: PostureMode;
  isAngle: boolean;
  metric: number | null;
  restThreshold: number;
  peakThreshold: number;
  progress: number | null;
  holdMs: number;
  targetHoldMs: number;
  minRepMs: number;
  maxRepMs: number;
  maxVelocityThreshold: number;
  liveVelocity: number;
  awaitingRest: boolean;
  /** Kết quả trực tiếp từ qualityGate() của pose-engine.ts. */
  engineQualityGate: GateResult;
  /** Kết quả kiểm tra khung hình mở rộng (bao gồm TOO_CLOSE & chế độ ngồi). */
  frameCheck: FrameCheckResult;
  /** Lý do hiện tại chưa tính rep (hoặc lý do rep vừa bị loại). */
  notCountedReason: string;
  sessionId: number;
  sessionTotalReps: number;
  sessionCountedReps: number;
  sessionRejectedReps: number;
  sessionElapsedMs: number;
}

interface CalibrationRuntime {
  sessionId: number;
  sessionStartMs: number | null;
  lastFrameT: number;
  tester: string;
  trialType: TrialType;
  exercise: ExerciseId;
  postureMode: PostureMode;
  repSeq: number;
  sessionReps: RepResult[];
  /** Theo dõi giá trị đo ở điểm đạt maxProgress trong rep hiện tại. */
  inRep: boolean;
  maxProgressInRep: number;
  peakMetricInRep: number | null;
  prevT: number | null;
  prevP: number;
  liveVelocity: number;
  lastMetric: number | null;
  lastProgress: number | null;
  lastHoldMs: number;
  lastAwaitingRest: boolean;
  lastQualityGate: GateResult;
  lastFrameCheck: FrameCheckResult;
  lastRejectedHint: string | null;
  lastRejectedUntil: number;
  notCountedReason: string;
  lastUiSyncAt: number;
}

function createInitialFrameCheck(): FrameCheckResult {
  return {
    ok: false,
    reason: 'NO_POSE',
    shoulderWidthRatio: null,
    torsoHeightRatio: null,
    shoulderEarRatio: null,
  };
}

function createInitialTelemetry(
  exercise: ExerciseId,
  postureMode: PostureMode,
  sessionId: number
): CalibrationLiveTelemetry {
  const def = EXERCISES[exercise];
  return {
    exercise,
    postureMode,
    isAngle: isAngleMetricExercise(exercise),
    metric: null,
    restThreshold: def.rest,
    peakThreshold: def.peak,
    progress: null,
    holdMs: 0,
    targetHoldMs: def.holdMs,
    minRepMs: def.minRepMs,
    maxRepMs: def.maxRepMs,
    maxVelocityThreshold: maxVelocity(def),
    liveVelocity: 0,
    awaitingRest: false,
    engineQualityGate: { ok: false, reason: 'NO_POSE' },
    frameCheck: createInitialFrameCheck(),
    notCountedReason: i18n.calibration.telemetry.waitingCamera,
    sessionId,
    sessionTotalReps: 0,
    sessionCountedReps: 0,
    sessionRejectedReps: 0,
    sessionElapsedMs: 0,
  };
}

function formatRepFlagsVietnamese(exerciseId: ExerciseId, flags: string[]): string {
  if (flags.length === 0) return i18n.calibration.telemetry.repCountedOk;
  return flags
    .map((flag) => {
      if (flag === 'NOT_DEEP_ENOUGH') {
        return i18n.play.practice.exercises[exerciseId].notDeepEnough;
      }
      return i18n.play.practice.repFlags[flag] ?? flag;
    })
    .join('; ');
}

function snapshotTelemetry(rt: CalibrationRuntime): CalibrationLiveTelemetry {
  const def = EXERCISES[rt.exercise];
  const counted = rt.sessionReps.filter((r) => r.counted).length;
  const elapsed =
    rt.sessionStartMs !== null && rt.lastFrameT >= rt.sessionStartMs
      ? rt.lastFrameT - rt.sessionStartMs
      : 0;

  return {
    exercise: rt.exercise,
    postureMode: rt.postureMode,
    isAngle: isAngleMetricExercise(rt.exercise),
    metric: rt.lastMetric,
    restThreshold: def.rest,
    peakThreshold: def.peak,
    progress: rt.lastProgress,
    holdMs: rt.lastHoldMs,
    targetHoldMs: def.holdMs,
    minRepMs: def.minRepMs,
    maxRepMs: def.maxRepMs,
    maxVelocityThreshold: maxVelocity(def),
    liveVelocity: rt.liveVelocity,
    awaitingRest: rt.lastAwaitingRest,
    engineQualityGate: rt.lastQualityGate,
    frameCheck: rt.lastFrameCheck,
    notCountedReason: rt.notCountedReason,
    sessionId: rt.sessionId,
    sessionTotalReps: rt.sessionReps.length,
    sessionCountedReps: counted,
    sessionRejectedReps: rt.sessionReps.length - counted,
    sessionElapsedMs: elapsed,
  };
}

/**
 * Hook điều phối trang /calibrate (F6a):
 * - Dữ liệu từng frame lưu trong ref, chỉ đẩy vào React state mỗi ~100ms hoặc khi có rep/phiên mới.
 * - Dùng `SessionGuard(seed, 0)` để đo chuẩn lớp 0–3 (ảnh tĩnh, FPS, lặp quỹ đạo, nhịp đều) mà không bị timeout thử thách ẩn.
 * - Toàn bộ nhật ký rep & nhật ký phiên lưu thuần trong RAM (mất khi tải lại trang).
 */
export function useCalibrationSession(options: {
  exercise: ExerciseId;
  postureMode: PostureMode;
  tester: string;
  trialType: TrialType;
}) {
  const { exercise, postureMode, tester, trialType } = options;

  const counterRef = useRef<RepCounter | null>(null);
  const guardRef = useRef<SessionGuard | null>(null);
  const filterRef = useRef<LandmarkOneEuroFilter | null>(null);
  const rtRef = useRef<CalibrationRuntime | null>(null);

  const [telemetry, setTelemetry] = useState<CalibrationLiveTelemetry>(() =>
    createInitialTelemetry(exercise, postureMode, 1)
  );
  const [repLogs, setRepLogs] = useState<CalibrationRepLog[]>([]);
  const [sessionLogs, setSessionLogs] = useState<CalibrationSessionLog[]>([]);

  const initFreshSession = useCallback(
    (
      nextSessionId: number,
      ex: ExerciseId,
      mode: PostureMode,
      testerName: string,
      trial: TrialType,
      preserveRepSeq: number
    ) => {
      counterRef.current = new RepCounter(getExerciseDefForPosture(ex, mode));
      // Tạo SessionGuard phía client với maxChallenges = 0 để không phát sinh lỗi thử thách ẩn khi đo hiệu chỉnh
      guardRef.current = new SessionGuard(newSeed(), 0);
      filterRef.current = new LandmarkOneEuroFilter();

      const nextRt: CalibrationRuntime = {
        sessionId: nextSessionId,
        sessionStartMs: null,
        lastFrameT: 0,
        tester: testerName,
        trialType: trial,
        exercise: ex,
        postureMode: mode,
        repSeq: preserveRepSeq,
        sessionReps: [],
        inRep: false,
        maxProgressInRep: -Infinity,
        peakMetricInRep: null,
        prevT: null,
        prevP: 0,
        liveVelocity: 0,
        lastMetric: null,
        lastProgress: null,
        lastHoldMs: 0,
        lastAwaitingRest: false,
        lastQualityGate: { ok: false, reason: 'NO_POSE' },
        lastFrameCheck: createInitialFrameCheck(),
        lastRejectedHint: null,
        lastRejectedUntil: 0,
        notCountedReason: i18n.calibration.telemetry.waitingCamera,
        lastUiSyncAt: 0,
      };
      rtRef.current = nextRt;
      setTelemetry(snapshotTelemetry(nextRt));
    },
    []
  );

  // Khởi tạo phía client sau khi mount (tránh gọi newSeed() lúc SSR)
  useEffect(() => {
    if (!rtRef.current) {
      initFreshSession(1, exercise, postureMode, tester, trialType, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cập nhật tên người thử & kiểu thử trực tiếp vào ref
  useEffect(() => {
    if (rtRef.current) {
      rtRef.current.tester = tester;
      rtRef.current.trialType = trialType;
    }
  }, [tester, trialType]);

  // Khi đổi động tác hoặc đổi chế độ Đứng/Ngồi -> tạo RepCounter phù hợp (giữ nhật ký đã ghi)
  useEffect(() => {
    const rt = rtRef.current;
    if (!rt) return;
    if (rt.exercise === exercise && rt.postureMode === postureMode) return;

    rt.exercise = exercise;
    rt.postureMode = postureMode;
    counterRef.current = new RepCounter(
      getExerciseDefForPosture(exercise, postureMode)
    );
    filterRef.current?.reset();
    rt.inRep = false;
    rt.maxProgressInRep = -Infinity;
    rt.peakMetricInRep = null;
    rt.lastMetric = null;
    rt.lastProgress = null;
    rt.lastHoldMs = 0;
    rt.lastAwaitingRest = false;
    setTelemetry(snapshotTelemetry(rt));
  }, [exercise, postureMode]);

  /** Bắt đầu phiên đo mới sạch sẽ (dùng khi bấm "Bắt đầu thử gian lận" hoặc "Phiên mới"). */
  const startFreshSession = useCallback(
    (overrideTrialType?: TrialType) => {
      const rt = rtRef.current;
      const nextId = rt ? rt.sessionId + 1 : 1;
      const seq = rt ? rt.repSeq : 0;
      const ex = rt ? rt.exercise : exercise;
      const mode = rt ? rt.postureMode : postureMode;
      const name = rt ? rt.tester : tester;
      const trial = overrideTrialType ?? (rt ? rt.trialType : trialType);

      initFreshSession(nextId, ex, mode, name, trial, seq);
    },
    [exercise, postureMode, tester, trialType, initFreshSession]
  );

  /** Gọi finalizeRun() + analyzeReps() để ghi 1 dòng vào Nhật ký phiên và mở phiên kế tiếp. */
  const finalizeCurrentSession = useCallback(() => {
    const rt = rtRef.current;
    const guard = guardRef.current;
    if (!rt || !guard) return null;

    const durationMs =
      rt.sessionStartMs !== null && rt.lastFrameT >= rt.sessionStartMs
        ? rt.lastFrameT - rt.sessionStartMs
        : 0;

    const { log } = finalizeCalibrationSession({
      sessionId: rt.sessionId,
      timestampIso: new Date().toISOString(),
      tester: rt.tester.trim() || i18n.calibration.defaultTester,
      trialType: rt.trialType,
      exercise: rt.exercise,
      postureMode: rt.postureMode,
      durationMs,
      allReps: rt.sessionReps,
      guardResult: guard.verdict(),
      xpAlreadyEarned: 0,
    });

    setSessionLogs((prev) => [log, ...prev]);

    // Tự mở phiên kế tiếp sạch sẽ ngay sau khi đóng phiên
    initFreshSession(
      rt.sessionId + 1,
      rt.exercise,
      rt.postureMode,
      rt.tester,
      rt.trialType,
      rt.repSeq
    );

    return log;
  }, [initFreshSession]);

  /** Xóa toàn bộ nhật ký rep và phiên trong RAM. */
  const clearAllLogs = useCallback(() => {
    setRepLogs([]);
    setSessionLogs([]);
    const rt = rtRef.current;
    if (rt) {
      initFreshSession(1, rt.exercise, rt.postureMode, rt.tester, rt.trialType, 0);
    }
  }, [initFreshSession]);

  /** Đẩy từng frame từ MediaPipe (chạy hoàn toàn trên ref, đồng bộ UI mỗi ~100ms). */
  const pushFrame = useCallback((frame: Frame) => {
    const counter = counterRef.current;
    const guard = guardRef.current;
    const filter = filterRef.current;
    const rt = rtRef.current;
    if (!counter || !guard || !filter || !rt) return;

    rt.lastFrameT = frame.t;
    if (rt.sessionStartMs === null) {
      rt.sessionStartMs = frame.t;
    }

    // Làm mượt landmarks nhất quán với /play
    if (frame.lm.length >= 33) {
      filter.applyInPlace(frame.lm, frame.t);
    } else {
      filter.reset();
    }

    // Gọi trực tiếp qualityGate() của pose-engine.ts + evaluateFrameCheck()
    const required = getRequiredLandmarks(rt.exercise, rt.postureMode);
    const engineGate = qualityGate(frame, required);
    const frameCheck = evaluateFrameCheck(frame, rt.exercise, rt.postureMode);
    rt.lastQualityGate = engineGate;
    rt.lastFrameCheck = frameCheck;

    // Luôn gọi SessionGuard.onFrame để theo dõi STATIC_SUBJECT và LOW_FPS
    guard.onFrame(frame);

    const pushRes = counter.push(frame);
    const { gate, progress, rep } = pushRes;
    const metricVal = pushRes.metric ?? null;
    const holdVal = pushRes.holdMs ?? 0;
    const awaitingRest = Boolean(pushRes.awaitingRest);

    rt.lastMetric = metricVal;
    rt.lastProgress = progress;
    rt.lastHoldMs = holdVal;
    rt.lastAwaitingRest = awaitingRest;

    let forceSync = false;
    const def = counter.def;
    const isHold = def.holdMs > 0;
    const startThr = isHold ? THRESHOLDS.HOLD_START_PROGRESS : CONFIG.startProgress;
    const endThr = isHold ? THRESHOLDS.HOLD_REARM_PROGRESS : CONFIG.endProgress;
    const telTexts = i18n.calibration.telemetry;

    if (!gate.ok || progress === null) {
      rt.inRep = false;
      rt.maxProgressInRep = -Infinity;
      rt.peakMetricInRep = null;
      rt.prevT = null;
      rt.liveVelocity = 0;

      const reasonCode = gate.reason ?? 'NO_POSE';
      rt.notCountedReason = `${telTexts.gateBlockedPrefix} ${reasonCode}`;
    } else {
      // Tốc độ tức thời (progress/s)
      if (rt.prevT !== null && frame.t > rt.prevT) {
        const dt = (frame.t - rt.prevT) / 1000;
        rt.liveVelocity = dt > 0 ? Math.abs(progress - rt.prevP) / dt : 0;
      } else {
        rt.liveVelocity = 0;
      }
      rt.prevT = frame.t;
      rt.prevP = progress;

      // Theo dõi giá trị đo ở đỉnh rep
      if (progress > startThr && !awaitingRest) {
        if (!rt.inRep) {
          rt.inRep = true;
          rt.maxProgressInRep = progress;
          rt.peakMetricInRep = metricVal;
        } else if (progress >= rt.maxProgressInRep) {
          rt.maxProgressInRep = progress;
          rt.peakMetricInRep = metricVal;
        }
      } else if (progress <= endThr) {
        rt.inRep = false;
      }

      if (rep !== null) {
        guard.addRep(rep);
        rt.sessionReps.push(rep);
        rt.repSeq += 1;

        const recordedPeak = rt.peakMetricInRep ?? metricVal;
        const logItem: CalibrationRepLog = {
          index: rt.repSeq,
          sessionId: rt.sessionId,
          timestampIso: new Date().toISOString(),
          tester: rt.tester.trim() || i18n.calibration.defaultTester,
          trialType: rt.trialType,
          exercise: rep.exercise,
          postureMode: rt.postureMode,
          counted: rep.counted,
          flags: [...rep.flags],
          peakMetric: recordedPeak,
          maxProgress: rep.maxProgress,
          durationMs: rep.durationMs,
          holdMs: rep.holdMs,
          peakVelocity: rep.peakVelocity,
          reversals: rep.reversals,
          quality: rep.quality,
          xp: rep.xp,
        };

        setRepLogs((prev) => [logItem, ...prev]);

        if (!rep.counted) {
          rt.lastRejectedHint = `${telTexts.repRejectedPrefix} ${formatRepFlagsVietnamese(rep.exercise, rep.flags)} [${rep.flags.join(', ')}]`;
          rt.lastRejectedUntil = frame.t + 3500;
          rt.notCountedReason = rt.lastRejectedHint;
        } else {
          rt.lastRejectedHint = null;
          rt.notCountedReason =
            rep.flags.length > 0
              ? `${telTexts.repCountedWithFlagsPrefix} ${rep.flags.join(', ')}`
              : telTexts.repCountedOk;
        }

        rt.inRep = false;
        rt.maxProgressInRep = -Infinity;
        rt.peakMetricInRep = null;
        forceSync = true;
      } else if (rt.lastRejectedHint && frame.t < rt.lastRejectedUntil) {
        rt.notCountedReason = rt.lastRejectedHint;
      } else if (awaitingRest) {
        rt.notCountedReason = telTexts.awaitingRest;
      } else if (isHold && progress >= 1 && holdVal === 0) {
        rt.notCountedReason = telTexts.needRestToArm;
      } else if (isHold && holdVal > 0) {
        rt.notCountedReason = `${telTexts.holdingInProgress} (${(holdVal / 1000).toFixed(2)}s / ${(def.holdMs / 1000).toFixed(1)}s)`;
      } else if (progress > startThr && progress < 1) {
        rt.notCountedReason = `${telTexts.belowPeakThreshold} (${Math.round(progress * 100)}%)`;
      } else if (!isHold && progress >= 1) {
        rt.notCountedReason = telTexts.reachedPeakReturnRest;
      } else {
        rt.notCountedReason = telTexts.atRestReady;
      }
    }

    if (forceSync || frame.t - rt.lastUiSyncAt >= UI_SYNC_INTERVAL_MS) {
      rt.lastUiSyncAt = frame.t;
      setTelemetry(snapshotTelemetry(rt));
    }
  }, []);

  return {
    telemetry,
    repLogs,
    sessionLogs,
    pushFrame,
    startFreshSession,
    finalizeCurrentSession,
    clearAllLogs,
  };
}