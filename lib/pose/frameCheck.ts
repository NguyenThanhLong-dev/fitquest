import {
  EXERCISES,
  LM,
  qualityGate,
  type ExerciseDef,
  type ExerciseId,
  type Frame,
  type GateReason,
} from '@/lib/pose-engine';
import type { PostureMode } from '@/lib/game/engineAdapter';

// Chỉ số khớp 2 mắt trong MediaPipe Pose (dùng dự phòng cho bài Nghiêng cổ khi tai bị che bởi tóc/tai nghe)
const L_EYE_INDEX = 2;
const R_EYE_INDEX = 5;

/**
 * Các ngưỡng kiểm tra khung hình (Lớp 0) và chống nhấp nháy (300–500ms).
 * - Chế độ Đứng: kiểm tra bề ngang vai và chiều cao thân (vai->hông).
 * - Chế độ Ngồi: CHỈ đo theo thân trên (bề ngang vai và khoảng cách vai–tai), không bắt buộc hông/chân.
 */
export const FRAME_CHECK_CONFIG = {
  /** Độ tin cậy tối thiểu cho từng khớp bắt buộc. */
  minVisibility: 0.6,
  /** Khớp bắt buộc phải cách mép khung hình ít nhất 3% (0.03..0.97). */
  edgeMargin: 0.03,
  /** Ngưỡng đứng quá gần (chế độ Đứng). */
  tooCloseShoulderWidth: 0.62,
  tooCloseTorsoHeight: 0.78,
  /** Ngưỡng ngồi quá xa / quá gần (chế độ Ngồi — đo theo bề ngang vai & khoảng cách vai–tai). */
  seatedMinShoulderWidth: 0.14,
  seatedMaxShoulderWidth: 0.68,
  seatedMinShoulderEarDist: 0.06,
  seatedMaxShoulderEarDist: 0.34,
  /** Thời gian đạt / không đạt liên tục (ms) trước khi đổi trạng thái "Sẵn sàng". */
  debounceMs: 400,
} as const;

export type FrameCheckReason = GateReason | 'TOO_CLOSE';

export interface FrameCheckResult {
  ok: boolean;
  reason: FrameCheckReason | null;
  /** Tỷ lệ bề ngang vai theo khung hình (0..1). */
  shoulderWidthRatio: number | null;
  /** Tỷ lệ chiều cao thân (vai->hông) ở chế độ Đứng, hoặc null nếu ẩn hông. */
  torsoHeightRatio: number | null;
  /** Khoảng cách chuẩn hóa vai–tai dùng để kiểm tra cự ly ở chế độ Ngồi. */
  shoulderEarRatio: number | null;
  /** Danh sách chỉ số các khớp bắt buộc đang thiếu độ tin cậy (< 0.6) để báo rõ trên UI. */
  missingLandmarks?: number[];
}

export interface FrameStabilitySnapshot {
  stableOk: boolean;
  stableReason: FrameCheckReason | null;
  rawOk: boolean;
  rawReason: FrameCheckReason | null;
  transitioningTo: boolean | null;
  transitionProgress: number;
  shoulderWidthRatio: number | null;
  torsoHeightRatio: number | null;
  shoulderEarRatio: number | null;
  missingLandmarks?: number[];
}

/** Tính góc nghiêng (độ °) của đoạn nối 2 khớp so với phương ngang (đã hiệu chỉnh tỷ lệ khung hình). */
function lineTiltFromIndices(frame: Frame, idxA: number, idxB: number): number {
  const a = frame.lm[idxA];
  const b = frame.lm[idxB];
  const dx = Math.abs((b.x - a.x) * frame.aspect);
  const dy = b.y - a.y;
  return Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
}

/**
 * Danh sách khớp bắt buộc theo từng động tác và chế độ Đứng / Ngồi:
 * - Chế độ Ngồi: chỉ bắt buộc 3 khớp neo thân trên luôn thấy rõ trước webcam laptop
 *   (`NOSE`, `L_SHOULDER`, `R_SHOULDER`), tránh chặn oan khi cổ tay nghỉ dưới bàn hoặc tai bị che.
 * - Chế độ Đứng: Squat bỏ cổ chân/bàn chân; các động tác còn lại theo EXERCISES của pose-engine.ts.
 */
export function getRequiredLandmarks(
  exerciseId: ExerciseId,
  mode: PostureMode = 'standing'
): number[] {
  if (mode === 'seated') {
    return [LM.NOSE, LM.L_SHOULDER, LM.R_SHOULDER];
  }

  const base = EXERCISES[exerciseId].required;
  if (exerciseId === 'squat') {
    return base.filter((idx) => idx !== LM.L_ANKLE && idx !== LM.R_ANKLE);
  }
  return [...base];
}

/**
 * Trả về ExerciseDef truyền vào `new RepCounter(def)` phù hợp với chế độ Đứng / Ngồi
 * mà KHÔNG sửa `lib/pose-engine.ts`.
 * Giữ nguyên 100% id, rest, peak, holdMs, minRepMs, maxRepMs, baseXp để finalizeRun() xác thực chuẩn.
 */
export function getExerciseDefForPosture(
  exerciseId: ExerciseId,
  mode: PostureMode = 'standing'
): ExerciseDef {
  const base = EXERCISES[exerciseId];
  if (mode !== 'seated') {
    return base;
  }

  const seatedRequired = getRequiredLandmarks(exerciseId, 'seated');

  // 1. Vươn vai (ngồi): tay đặt nghỉ trên bàn -> tự trả về base.rest để mở khóa rep;
  //    khi giơ lên đo theo cổ tay (và hỗ trợ trường hợp cổ tay chạm mép trên khung hình).
  if (exerciseId === 'overhead_reach') {
    const wristsUpCheck = (f: Frame): boolean => {
      const nose = f.lm[LM.NOSE];
      const lw = f.lm[LM.L_WRIST];
      const rw = f.lm[LM.R_WRIST];
      const le = f.lm[LM.L_ELBOW];
      const re = f.lm[LM.R_ELBOW];
      const ls = f.lm[LM.L_SHOULDER];
      const rs = f.lm[LM.R_SHOULDER];

      const wristsClearlyUp =
        lw.visibility >= 0.35 &&
        rw.visibility >= 0.35 &&
        lw.y < nose.y &&
        rw.y < nose.y;

      const elbowsHighAboveShoulders =
        le.visibility >= 0.45 &&
        re.visibility >= 0.45 &&
        le.y < ls.y &&
        re.y < rs.y &&
        lw.y < nose.y &&
        rw.y < nose.y;

      return wristsClearlyUp || elbowsHighAboveShoulders;
    };

    return {
      ...base,
      required: seatedRequired,
      metric: (f: Frame) => {
        const lw = f.lm[LM.L_WRIST];
        const rw = f.lm[LM.R_WRIST];
        const le = f.lm[LM.L_ELBOW];
        const re = f.lm[LM.R_ELBOW];
        const ls = f.lm[LM.L_SHOULDER];
        const rs = f.lm[LM.R_SHOULDER];
        const nose = f.lm[LM.NOSE];

        if (lw.visibility >= 0.35 && rw.visibility >= 0.35) {
          return base.metric(f);
        }

        // Khi vươn tay quá cao làm cổ tay sát/vượt mép trên khung hình nhưng 2 khuỷu tay đã nâng cao hơn vai
        if (
          le.visibility >= 0.45 &&
          re.visibility >= 0.45 &&
          le.y < ls.y &&
          re.y < rs.y &&
          lw.y < nose.y &&
          rw.y < nose.y
        ) {
          return Math.max(base.peak, base.metric(f));
        }

        // Tay đang đặt nghỉ trên bàn / ngoài cạnh dưới khung hình -> tư thế nghỉ
        return base.rest;
      },
      form: base.form.map((check) =>
        check.id === 'BOTH_WRISTS_UP'
          ? { ...check, pass: wristsUpCheck }
          : check
      ),
    };
  }

  // 2. Nghiêng người (ngồi): đo nhất quán theo góc nghiêng đường nối hai vai (không phụ thuộc hông dưới bàn)
  if (exerciseId === 'side_bend') {
    return {
      ...base,
      required: seatedRequired,
      metric: (f: Frame) =>
        lineTiltFromIndices(f, LM.L_SHOULDER, LM.R_SHOULDER),
      form: [],
    };
  }

  // 3. Nghiêng cổ (ngồi): ưu tiên 2 tai; nếu tai bị tóc/tai nghe che thì tự chuyển sang đường nối 2 mắt
  if (exerciseId === 'neck_tilt') {
    return {
      ...base,
      required: seatedRequired,
      metric: (f: Frame) => {
        const lEar = f.lm[LM.L_EAR];
        const rEar = f.lm[LM.R_EAR];
        if (lEar.visibility >= 0.35 && rEar.visibility >= 0.35) {
          return base.metric(f);
        }
        const lEye = f.lm[L_EYE_INDEX];
        const rEye = f.lm[R_EYE_INDEX];
        if (lEye && rEye && lEye.visibility >= 0.35 && rEye.visibility >= 0.35) {
          return lineTiltFromIndices(f, L_EYE_INDEX, R_EYE_INDEX);
        }
        return base.rest;
      },
    };
  }

  return base;
}

/**
 * Đánh giá khung hình Lớp 0 theo từng động tác và chế độ Đứng / Ngồi:
 * - Chế độ Đứng: đo theo vai + thân (vai->hông).
 * - Chế độ Ngồi: đo theo thân trên (bề ngang vai & khoảng cách vai–tai), chỉ bắt buộc Mũi + 2 Vai.
 */
export function evaluateFrameCheck(
  frame: Frame,
  exerciseId: ExerciseId,
  mode: PostureMode = 'standing'
): FrameCheckResult {
  const required = getRequiredLandmarks(exerciseId, mode);
  const cfg = FRAME_CHECK_CONFIG;

  let shoulderWidthRatio: number | null = null;
  let torsoHeightRatio: number | null = null;
  let shoulderEarRatio: number | null = null;
  const missingLandmarks: number[] = [];

  if (frame.lm && frame.lm.length >= 33) {
    for (let i = 0; i < required.length; i++) {
      const idx = required[i];
      if (frame.lm[idx].visibility < cfg.minVisibility) {
        missingLandmarks.push(idx);
      }
    }

    const ls = frame.lm[LM.L_SHOULDER];
    const rs = frame.lm[LM.R_SHOULDER];
    if (ls.visibility >= cfg.minVisibility && rs.visibility >= cfg.minVisibility) {
      shoulderWidthRatio = Math.abs(ls.x - rs.x);
      const midShoulderX = ((ls.x + rs.x) / 2) * frame.aspect;
      const midShoulderY = (ls.y + rs.y) / 2;

      const le = frame.lm[LM.L_EAR];
      const re = frame.lm[LM.R_EAR];
      if (le.visibility >= 0.5 && re.visibility >= 0.5) {
        const midEarX = ((le.x + re.x) / 2) * frame.aspect;
        const midEarY = (le.y + re.y) / 2;
        shoulderEarRatio = Math.hypot(
          midEarX - midShoulderX,
          midEarY - midShoulderY
        );
      }

      const lh = frame.lm[LM.L_HIP];
      const rh = frame.lm[LM.R_HIP];
      if (lh.visibility >= cfg.minVisibility && rh.visibility >= cfg.minVisibility) {
        const midHipY = (lh.y + rh.y) / 2;
        torsoHeightRatio = Math.abs(midHipY - midShoulderY);
      }
    }
  }

  // Bước 1: Kiểm tra bằng qualityGate chính thức của pose-engine.ts
  const gate = qualityGate(frame, required, cfg.minVisibility);
  const maxShoulderWidth =
    mode === 'seated' ? cfg.seatedMaxShoulderWidth : cfg.tooCloseShoulderWidth;

  if (!gate.ok) {
    if (
      gate.reason === 'OUT_OF_FRAME' &&
      shoulderWidthRatio !== null &&
      shoulderWidthRatio > maxShoulderWidth
    ) {
      return {
        ok: false,
        reason: 'TOO_CLOSE',
        shoulderWidthRatio,
        torsoHeightRatio,
        shoulderEarRatio,
        missingLandmarks,
      };
    }

    return {
      ok: false,
      reason: gate.reason ?? 'NO_POSE',
      shoulderWidthRatio,
      torsoHeightRatio,
      shoulderEarRatio,
      missingLandmarks,
    };
  }

  // Bước 2: Đo cự ly quá xa / quá gần phù hợp với chế độ Ngồi hoặc Đứng
  if (mode === 'seated') {
    if (
      (shoulderWidthRatio !== null &&
        shoulderWidthRatio < cfg.seatedMinShoulderWidth) ||
      (shoulderEarRatio !== null &&
        shoulderEarRatio < cfg.seatedMinShoulderEarDist)
    ) {
      return {
        ok: false,
        reason: 'TOO_FAR',
        shoulderWidthRatio,
        torsoHeightRatio,
        shoulderEarRatio,
      };
    }

    if (
      (shoulderWidthRatio !== null &&
        shoulderWidthRatio > cfg.seatedMaxShoulderWidth) ||
      (shoulderEarRatio !== null &&
        shoulderEarRatio > cfg.seatedMaxShoulderEarDist)
    ) {
      return {
        ok: false,
        reason: 'TOO_CLOSE',
        shoulderWidthRatio,
        torsoHeightRatio,
        shoulderEarRatio,
      };
    }
  } else {
    const hipsRequired =
      required.includes(LM.L_HIP) || required.includes(LM.R_HIP);
    if (
      (shoulderWidthRatio !== null &&
        shoulderWidthRatio > cfg.tooCloseShoulderWidth) ||
      (hipsRequired &&
        torsoHeightRatio !== null &&
        torsoHeightRatio > cfg.tooCloseTorsoHeight)
    ) {
      return {
        ok: false,
        reason: 'TOO_CLOSE',
        shoulderWidthRatio,
        torsoHeightRatio,
        shoulderEarRatio,
      };
    }
  }

  // Bước 3: Phát hiện khớp bắt buộc quá sát mép khung hình
  const bottomLimit =
    mode === 'standing' && exerciseId === 'side_bend'
      ? 0.995
      : 1 - cfg.edgeMargin;

  for (let i = 0; i < required.length; i++) {
    const pt = frame.lm[required[i]];
    if (
      pt.x < cfg.edgeMargin ||
      pt.x > 1 - cfg.edgeMargin ||
      pt.y < cfg.edgeMargin ||
      pt.y > bottomLimit
    ) {
      return {
        ok: false,
        reason: 'OUT_OF_FRAME',
        shoulderWidthRatio,
        torsoHeightRatio,
        shoulderEarRatio,
      };
    }
  }

  return {
    ok: true,
    reason: null,
    shoulderWidthRatio,
    torsoHeightRatio,
    shoulderEarRatio,
  };
}

/**
 * Bộ chống nhấp nháy trạng thái khung hình (Lớp 0 — 400ms).
 */
export class FrameStabilityGate {
  private stableOk = false;
  private stableReason: FrameCheckReason | null = 'NO_POSE';
  private pendingOk: boolean | null = null;
  private pendingSinceMs: number | null = null;

  constructor(private readonly debounceMs: number = FRAME_CHECK_CONFIG.debounceMs) {}

  reset(): void {
    this.stableOk = false;
    this.stableReason = 'NO_POSE';
    this.pendingOk = null;
    this.pendingSinceMs = null;
  }

  get isReady(): boolean {
    return this.stableOk;
  }

  update(raw: FrameCheckResult, timestampMs: number): FrameStabilitySnapshot {
    let transitionProgress = 0;

    if (raw.ok === this.stableOk) {
      this.pendingOk = null;
      this.pendingSinceMs = null;
      if (!this.stableOk) {
        this.stableReason = raw.reason ?? 'NO_POSE';
      }
    } else {
      if (this.pendingOk !== raw.ok || this.pendingSinceMs === null) {
        this.pendingOk = raw.ok;
        this.pendingSinceMs = timestampMs;
      }

      const elapsed = Math.max(0, timestampMs - this.pendingSinceMs);
      transitionProgress =
        this.debounceMs <= 0 ? 1 : Math.min(1, elapsed / this.debounceMs);

      if (elapsed >= this.debounceMs) {
        this.stableOk = raw.ok;
        this.stableReason = raw.ok ? null : (raw.reason ?? 'NO_POSE');
        this.pendingOk = null;
        this.pendingSinceMs = null;
        transitionProgress = 1;
      }
    }

    return {
      stableOk: this.stableOk,
      stableReason: this.stableReason,
      rawOk: raw.ok,
      rawReason: raw.reason,
      transitioningTo: this.pendingOk,
      transitionProgress,
      shoulderWidthRatio: raw.shoulderWidthRatio,
      torsoHeightRatio: raw.torsoHeightRatio,
      shoulderEarRatio: raw.shoulderEarRatio,
      missingLandmarks: raw.missingLandmarks,
    };
  }
}