'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CONFIG,
  EXERCISES,
  LM,
  RepCounter,
  THRESHOLDS,
  maxVelocity,
  type ExerciseId,
  type Frame,
  type GateReason,
  type RepResult,
} from '@/lib/pose-engine';
import { LandmarkOneEuroFilter } from '@/lib/pose/landmarkFilter';
import type { ProgressTone } from '@/components/ProgressRing';
import { i18n } from '@/lib/i18n';

// Chỉ cập nhật React state tối đa mỗi 100ms khi không có sự kiện đổi rep / đổi trạng thái
const UI_SYNC_INTERVAL_MS = 100;
const POST_REP_FEEDBACK_MS = 2600;
const CANCELLED_BANNER_MS = 3000;

type SecondaryAngleKind = 'shoulderTilt' | 'hipTilt' | 'torsoLean';

function deg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Tính góc kiểm tra phụ (độ °) để hiển thị trong bảng debug (khớp công thức pose-engine.ts). */
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
  /** True nếu bài tập dùng đơn vị góc (°), false nếu dùng tỷ lệ hình học. */
  isAngleExercise: boolean;
  /** Giá trị góc/chỉ số hiện tại sau EMA từ RepCounter. */
  metricValue: number | null;
  restThreshold: number;
  peakThreshold: number;
  /** Góc kiểm tra phụ (vai ngang / hông ngang / lưng thẳng) và dung sai tối đa. */
  secondaryKind: SecondaryAngleKind;
  secondaryValueDeg: number | null;
  secondaryMaxDeg: number;
  /** Thời gian đã giữ liên tục hiện tại (ms) và mục tiêu (ms). */
  currentHoldMs: number;
  targetHoldMs: number;
  /** Trạng thái máy trạng thái của bộ đếm. */
  phase: 'ready' | 'active' | 'awaitingRest';
  /** Thông số tốc độ để theo dõi TELEPORT. */
  currentVelocity: number;
  livePeakVelocity: number;
  lastRepPeakVelocity: number | null;
  maxVelocityThreshold: number;
  /** Lý do từ chối gần nhất. */
  lastRejection: LastRejectionSnapshot | null;
}

export interface RepCounterUiState {
  exerciseId: ExerciseId;
  repCount: number;
  ringProgress: number;
  movementProgress: number;
  currentHoldMs: number;
  targetHoldMs: number;
  awaitingRest: boolean;
  gateOk: boolean;
  gateReason: GateReason | null;
  cancelledReason: GateReason | null;
  lastRep: LastRepSnapshot | null;
  hintText: string;
  hintTone: ProgressTone;
  debug: ExerciseDebugState;
}

interface RuntimeState {
  repCount: number;
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
  gateOk: boolean;
  gateReason: GateReason | null;
  cancelledReason: GateReason | null;
  cancelledUntil: number;
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

function createInitialRuntime(exerciseId: ExerciseId): RuntimeState {
  const secondary = getDefaultSecondaryMeta(exerciseId);
  return {
    repCount: 0,
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
    gateOk: false,
    gateReason: 'NO_POSE',
    cancelledReason: null,
    cancelledUntil: 0,
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
  const movementProgress = rt.gateOk ? clamp01(rt.progress) : 0;

  let ringProgress = movementProgress;
  let displayHoldMs = 0;
  if (targetHoldMs > 0) {
    if (!rt.gateOk) {
      ringProgress = 0;
      displayHoldMs = 0;
    } else if (rt.awaitingRest) {
      // Sau khi vừa đủ giờ và đã tính rep, giữ vòng xanh đầy 100% lúc thả lỏng về tư thế nghỉ
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
    repCount: rt.repCount,
    ringProgress,
    movementProgress,
    currentHoldMs: displayHoldMs,
    targetHoldMs,
    awaitingRest: rt.awaitingRest,
    gateOk: rt.gateOk,
    gateReason: rt.gateReason,
    cancelledReason: rt.cancelledReason,
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
 * Hook bọc RepCounter của pose-engine.ts:
 * - Làm mượt landmarks bằng One Euro Filter trước khi đẩy vào engine.
 * - Đồng bộ trực tiếp metric, holdMs và awaitingRest từ RepCounter.push(frame).
 * - Cập nhật React state tiết kiệm (chỉ khi đổi rep/trạng thái hoặc mỗi ~100ms).
 */
export function useRepCounter(exerciseId: ExerciseId) {
  const counterRef = useRef<RepCounter>(new RepCounter(EXERCISES[exerciseId]));
  const filterRef = useRef<LandmarkOneEuroFilter>(new LandmarkOneEuroFilter());
  const activeExerciseRef = useRef<ExerciseId>(exerciseId);
  const runtimeRef = useRef<RuntimeState>(createInitialRuntime(exerciseId));

  const [uiState, setUiState] = useState<RepCounterUiState>(() =>
    snapshotUiState(exerciseId, runtimeRef.current)
  );

  const reset = useCallback(() => {
    const currentId = activeExerciseRef.current;
    counterRef.current.reset();
    filterRef.current.reset();
    runtimeRef.current = createInitialRuntime(currentId);
    setUiState(snapshotUiState(currentId, runtimeRef.current));
  }, []);

  useEffect(() => {
    activeExerciseRef.current = exerciseId;
    counterRef.current = new RepCounter(EXERCISES[exerciseId]);
    filterRef.current.reset();
    runtimeRef.current = createInitialRuntime(exerciseId);
    setUiState(snapshotUiState(exerciseId, runtimeRef.current));
  }, [exerciseId]);

  const pushFrame = useCallback((frame: Frame) => {
    const counter = counterRef.current;
    const def = counter.def;
    const isHold = def.holdMs > 0;
    const rt = runtimeRef.current;

    const prevGateOk = rt.gateOk;
    const prevGateReason = rt.gateReason;
    const prevAwaitingRest = rt.awaitingRest;
    let forceSync = false;

    // Làm mượt landmarks ở tầng F3 trước khi đưa vào pose-engine.ts
    if (frame.lm.length >= 33) {
      filterRef.current.applyInPlace(frame.lm, frame.t);
    } else {
      filterRef.current.reset();
    }

    const pushRes = counter.push(frame);
    const { gate, progress, rep } = pushRes;
    rt.gateOk = gate.ok;
    rt.gateReason = gate.reason ?? null;
    rt.metricValue = pushRes.metric ?? null;
    rt.awaitingRest = Boolean(pushRes.awaitingRest);
    rt.currentHoldMs = pushRes.holdMs ?? 0;

    if (!gate.ok) {
      // Chỉ báo hủy rep nếu đang tập dở (không báo hủy trong pha thả lỏng sau khi đã chốt rep)
      if (rt.inRep && !rt.awaitingRest) {
        rt.cancelledReason = gate.reason ?? 'NO_POSE';
        rt.cancelledUntil = frame.t + CANCELLED_BANNER_MS;
        rt.inRep = false;
        forceSync = true;
      }

      rt.progress = 0;
      rt.secondaryValueDeg = null;
      rt.prevSampleT = null;
      rt.prevSampleP = 0;
      rt.currentVelocity = 0;
      rt.livePeakVelocity = 0;
      rt.currentHoldMs = 0;

      const reasonKey: GateReason = gate.reason ?? 'NO_POSE';
      rt.hintText = i18n.play.practice.gateReasons[reasonKey];
      rt.hintTone = rt.cancelledReason ? 'error' : 'warning';

      if (prevGateOk !== gate.ok || prevGateReason !== rt.gateReason) {
        forceSync = true;
      }
    } else {
      if (rt.cancelledReason && frame.t >= rt.cancelledUntil) {
        rt.cancelledReason = null;
        forceSync = true;
      }

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
        rt.inRep = false;
        rt.livePeakVelocity = rep.peakVelocity;
        rt.cancelledReason = null;

        if (rep.counted) {
          rt.repCount += 1;
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
        // Pha thả lỏng sau khi rep giữ đã tính: tuyệt đối không cảnh báo tốc độ hay hủy rep
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
            // Với bài giữ: nếu chưa có currentHoldMs và mở đầu đã > 1.0 (ảnh tĩnh / vào sẵn tư thế)
            // thì RepCounter đang chờ về tư thế nghỉ trước.
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

        // Gợi ý form tiếng Việt theo thời gian thực
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

      if (prevGateOk !== gate.ok || prevAwaitingRest !== rt.awaitingRest) {
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
          sameDebug &&
          prev.repCount === next.repCount &&
          prev.awaitingRest === next.awaitingRest &&
          prev.gateOk === next.gateOk &&
          prev.gateReason === next.gateReason &&
          prev.cancelledReason === next.cancelledReason &&
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
  };
}