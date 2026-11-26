'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CONFIG,
  EXERCISES,
  RepCounter,
  type ExerciseId,
  type Frame,
  type GateReason,
  type RepResult,
} from '@/lib/pose-engine';
import { LandmarkOneEuroFilter } from '@/lib/pose/landmarkFilter';
import type { ProgressTone } from '@/components/ProgressRing';
import { i18n } from '@/lib/i18n';

// Chỉ cập nhật React state tối đa mỗi 100ms khi không có sự kiện đổi rep / đổi gate
const UI_SYNC_INTERVAL_MS = 100;
// Thời gian giữ thông báo sau khi vừa hoàn thành hoặc hủy rep để người dùng kịp đọc
const POST_REP_FEEDBACK_MS = 2600;
const CANCELLED_BANNER_MS = 3000;

/** Khớp đúng công thức ngưỡng maxVelocity(d) bên trong lib/pose-engine.ts (đơn vị: progress/s). */
function getEngineMaxVelocity(exerciseId: ExerciseId): number {
  const d = EXERCISES[exerciseId];
  return (Math.PI / (d.minRepMs / 1000)) * 1.6;
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

export interface VelocityDebugState {
  /** Tốc độ tức thời đo ở khung hình hiện tại (progress/s). */
  currentVelocity: number;
  /** Tốc độ đỉnh tích lũy trong rep đang thực hiện (progress/s). */
  livePeakVelocity: number;
  /** Tốc độ đỉnh thực tế trả về từ RepResult của rep vừa xong (progress/s). */
  lastRepPeakVelocity: number | null;
  /** Ngưỡng TELEPORT của động tác hiện tại theo pose-engine.ts (progress/s). */
  maxVelocityThreshold: number;
  /** Lý do từ chối gần nhất (lưu lại kể cả sau khi banner phản hồi đã ẩn). */
  lastRejection: LastRejectionSnapshot | null;
}

export interface RepCounterUiState {
  exerciseId: ExerciseId;
  repCount: number;
  ringProgress: number;
  movementProgress: number;
  currentHoldMs: number;
  targetHoldMs: number;
  gateOk: boolean;
  gateReason: GateReason | null;
  cancelledReason: GateReason | null;
  lastRep: LastRepSnapshot | null;
  hintText: string;
  hintTone: ProgressTone;
  debug: VelocityDebugState;
}

interface RuntimeState {
  repCount: number;
  inRep: boolean;
  armed: boolean;
  progress: number;
  prevSampleT: number | null;
  prevSampleP: number;
  currentVelocity: number;
  livePeakVelocity: number;
  holdStart: number | null;
  bestHoldMs: number;
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

/** Dịch mã cờ lỗi của RepResult sang câu gợi ý tiếng Việt tương ứng với động tác. */
function mapRepFlagToHint(exerciseId: ExerciseId, flag: string): string {
  if (flag === 'NOT_DEEP_ENOUGH') {
    return i18n.play.practice.exercises[exerciseId].notDeepEnough;
  }
  return (
    i18n.play.practice.repFlags[flag] ?? i18n.play.practice.status.unknownIssue
  );
}

/** Tạo phản hồi tiếng Việt ngay khi RepCounter kết thúc một rep. */
function buildPostRepFeedback(
  exerciseId: ExerciseId,
  rep: RepResult
): { text: string; tone: ProgressTone } {
  const { status } = i18n.play.practice;

  if (rep.counted) {
    if (rep.flags.length === 0) {
      return { text: status.countedGood, tone: 'success' };
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
  return {
    repCount: 0,
    inRep: false,
    armed: true,
    progress: 0,
    prevSampleT: null,
    prevSampleP: 0,
    currentVelocity: 0,
    livePeakVelocity: 0,
    holdStart: null,
    bestHoldMs: 0,
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
  const targetHoldMs = EXERCISES[exerciseId].holdMs;
  const movementProgress = rt.gateOk ? clamp01(rt.progress) : 0;

  let ringProgress = movementProgress;
  if (targetHoldMs > 0) {
    if (!rt.gateOk) {
      ringProgress = 0;
    } else if (rt.bestHoldMs >= targetHoldMs) {
      ringProgress = 1;
    } else {
      ringProgress = clamp01(rt.currentHoldMs / targetHoldMs);
    }
  }

  return {
    exerciseId,
    repCount: rt.repCount,
    ringProgress,
    movementProgress,
    currentHoldMs: Math.min(
      targetHoldMs,
      rt.bestHoldMs >= targetHoldMs ? targetHoldMs : rt.currentHoldMs
    ),
    targetHoldMs,
    gateOk: rt.gateOk,
    gateReason: rt.gateReason,
    cancelledReason: rt.cancelledReason,
    lastRep: rt.lastRep,
    hintText: rt.hintText,
    hintTone: rt.hintTone,
    debug: {
      currentVelocity: rt.currentVelocity,
      livePeakVelocity: rt.livePeakVelocity,
      lastRepPeakVelocity: rt.lastRep ? rt.lastRep.peakVelocity : null,
      maxVelocityThreshold: getEngineMaxVelocity(exerciseId),
      lastRejection: rt.lastRejection,
    },
  };
}

/**
 * Hook quản lý RepCounter của pose-engine.ts:
 * - Làm mượt landmarks bằng One Euro Filter trước khi đẩy vào RepCounter (không sửa pose-engine.ts).
 * - Lưu toàn bộ biến động theo frame trong ref; chỉ cập nhật React state khi có rep mới,
 *   đổi trạng thái gate/hủy rep hoặc mỗi ~100ms.
 */
export function useRepCounter(exerciseId: ExerciseId) {
  const counterRef = useRef<RepCounter>(new RepCounter(EXERCISES[exerciseId]));
  const filterRef = useRef<LandmarkOneEuroFilter>(new LandmarkOneEuroFilter());
  const activeExerciseRef = useRef<ExerciseId>(exerciseId);
  const runtimeRef = useRef<RuntimeState>(createInitialRuntime(exerciseId));

  const [uiState, setUiState] = useState<RepCounterUiState>(() =>
    snapshotUiState(exerciseId, runtimeRef.current)
  );

  // Đặt lại bộ đếm, bộ lọc làm mượt và trạng thái debug
  const reset = useCallback(() => {
    const currentId = activeExerciseRef.current;
    counterRef.current.reset();
    filterRef.current.reset();
    runtimeRef.current = createInitialRuntime(currentId);
    setUiState(snapshotUiState(currentId, runtimeRef.current));
  }, []);

  // Khi người dùng đổi động tác: tạo RepCounter mới và reset bộ lọc
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
    const rt = runtimeRef.current;

    const prevGateOk = rt.gateOk;
    const prevGateReason = rt.gateReason;
    let forceSync = false;

    // Bước làm mượt landmarks ở tầng F3 trước khi đưa vào pose-engine.ts
    if (frame.lm.length >= 33) {
      filterRef.current.applyInPlace(frame.lm, frame.t);
    } else {
      filterRef.current.reset();
    }

    const { gate, progress, rep } = counter.push(frame);
    rt.gateOk = gate.ok;
    rt.gateReason = gate.reason ?? null;

    if (!gate.ok) {
      if (rt.inRep) {
        rt.cancelledReason = gate.reason ?? 'NO_POSE';
        rt.cancelledUntil = frame.t + CANCELLED_BANNER_MS;
        rt.inRep = false;
        forceSync = true;
      }

      rt.armed = true;
      rt.progress = 0;
      rt.prevSampleT = null;
      rt.prevSampleP = 0;
      rt.currentVelocity = 0;
      rt.livePeakVelocity = 0;
      rt.holdStart = null;
      rt.bestHoldMs = 0;
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

      const p = progress ?? 0;

      // Đo tốc độ tức thời progress/s giống hệt công thức trong RepCounter.finalize()
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

      if (rep !== null) {
        rt.inRep = false;
        rt.armed = p < CONFIG.endProgress;
        rt.livePeakVelocity = rep.peakVelocity;
        rt.holdStart = null;
        rt.bestHoldMs = 0;
        rt.currentHoldMs = 0;
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
      } else {
        if (!rt.inRep) {
          if (!rt.armed) {
            if (p < CONFIG.endProgress) rt.armed = true;
          } else if (p > CONFIG.startProgress) {
            rt.inRep = true;
            rt.livePeakVelocity = 0;
            rt.cancelledReason = null;
            rt.postRepHint = null;
            rt.holdStart = null;
            rt.bestHoldMs = 0;
            rt.currentHoldMs = 0;
          }
        } else if (p < CONFIG.endProgress) {
          rt.inRep = false;
          rt.livePeakVelocity = 0;
          rt.holdStart = null;
          rt.bestHoldMs = 0;
          rt.currentHoldMs = 0;
        } else {
          if (instVelocity > rt.livePeakVelocity) {
            rt.livePeakVelocity = instVelocity;
          }

          if (def.holdMs > 0) {
            if (p >= 1) {
              if (rt.holdStart === null) rt.holdStart = frame.t;
              const held = frame.t - rt.holdStart;
              rt.currentHoldMs = held;
              if (held > rt.bestHoldMs) rt.bestHoldMs = held;
            } else if (p < 0.9) {
              rt.holdStart = null;
              rt.currentHoldMs = 0;
            }
          }
        }

        // Gợi ý form theo thời gian thực
        if (rt.postRepHint && frame.t < rt.postRepUntil && !rt.inRep) {
          rt.hintText = rt.postRepHint;
          rt.hintTone = rt.postRepTone;
        } else if (rt.inRep) {
          let failedFormId: string | null = null;
          for (let i = 0; i < def.form.length; i++) {
            const check = def.form[i];
            const minCheckProgress = check.id === 'BOTH_WRISTS_UP' ? 0.85 : 0.35;
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
          } else if (def.holdMs > 0) {
            if (rt.bestHoldMs >= def.holdMs) {
              rt.hintText = i18n.play.practice.status.holdComplete;
              rt.hintTone = 'success';
            } else if (p >= 1) {
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

        if (prevGateOk !== gate.ok) {
          forceSync = true;
        }
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
          Math.round(prev.debug.currentVelocity * 10) ===
            Math.round(next.debug.currentVelocity * 10) &&
          Math.round(prev.debug.livePeakVelocity * 10) ===
            Math.round(next.debug.livePeakVelocity * 10) &&
          prev.debug.lastRepPeakVelocity === next.debug.lastRepPeakVelocity &&
          prev.debug.lastRejection === next.debug.lastRejection;

        if (
          !forceSync &&
          sameProgress &&
          sameDebug &&
          prev.repCount === next.repCount &&
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