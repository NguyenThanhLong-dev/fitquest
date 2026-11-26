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
}

/**
 * Danh sách khớp bắt buộc theo từng động tác và chế độ Đứng / Ngồi:
 * - Chế độ Ngồi: CHỈ yêu cầu khớp thân trên (mũi, tai, vai, khuỷu, cổ tay tùy bài; hông không bắt buộc).
 * - Chế độ Đứng: Squat bỏ cổ chân/bàn chân; các động tác còn lại theo EXERCISES của pose-engine.ts.
 */
export function getRequiredLandmarks(
  exerciseId: ExerciseId,
  mode: PostureMode = 'standing'
): number[] {
  if (mode === 'seated') {
    switch (exerciseId) {
      case 'overhead_reach':
        return [
          LM.NOSE,
          LM.L_SHOULDER,
          LM.R_SHOULDER,
          LM.L_ELBOW,
          LM.R_ELBOW,
          LM.L_WRIST,
          LM.R_WRIST,
        ];
      case 'side_bend':
        // Chỉ yêu cầu mũi và 2 vai; hông là tùy chọn nếu thấy được
        return [LM.NOSE, LM.L_SHOULDER, LM.R_SHOULDER];
      case 'neck_tilt':
        return [LM.NOSE, LM.L_EAR, LM.R_EAR, LM.L_SHOULDER, LM.R_SHOULDER];
      default:
        // Fallback an toàn cho các động tác khác nếu bị gọi ở chế độ ngồi
        return [LM.NOSE, LM.L_SHOULDER, LM.R_SHOULDER];
    }
  }

  const base = EXERCISES[exerciseId].required;
  if (exerciseId === 'squat') {
    return base.filter((idx) => idx !== LM.L_ANKLE && idx !== LM.R_ANKLE);
  }
  return [...base];
}

/** Kiểm tra nhanh cặp hông có nhìn rõ và nằm trong khung hình hay không. */
function areHipsClearlyVisible(frame: Frame): boolean {
  if (!frame.lm || frame.lm.length < 33) return false;
  const lh = frame.lm[LM.L_HIP];
  const rh = frame.lm[LM.R_HIP];
  const minVis = FRAME_CHECK_CONFIG.minVisibility;
  return (
    lh.visibility >= minVis &&
    rh.visibility >= minVis &&
    lh.x >= 0 &&
    lh.x <= 1 &&
    rh.x >= 0 &&
    rh.x <= 1 &&
    lh.y >= 0 &&
    lh.y <= 1 &&
    rh.y >= 0 &&
    rh.y <= 1
  );
}

/**
 * Trả về ExerciseDef truyền vào `new RepCounter(def)` phù hợp với chế độ Đứng / Ngồi
 * mà KHÔNG sửa `lib/pose-engine.ts`.
 * - Giữ nguyên 100% id, rest, peak, holdMs, minRepMs, maxRepMs, baseXp để finalizeRun() xác thực đồng nhất.
 * - Riêng `side_bend` ở chế độ Ngồi: bỏ bắt buộc hông; nếu bàn học che hông thì đo độ nghiêng đường nối hai vai.
 */
export function getExerciseDefForPosture(
  exerciseId: ExerciseId,
  mode: PostureMode = 'standing'
): ExerciseDef {
  const base = EXERCISES[exerciseId];
  if (mode !== 'seated') {
    return base;
  }

  if (exerciseId === 'overhead_reach' || exerciseId === 'neck_tilt') {
    return {
      ...base,
      required: getRequiredLandmarks(exerciseId, 'seated'),
    };
  }

  if (exerciseId === 'side_bend') {
    const hipFormCheck = base.form[0];
    return {
      ...base,
      required: getRequiredLandmarks('side_bend', 'seated'),
      metric: (f: Frame) => {
        // Nếu thấy rõ cả hai hông -> dùng nguyên công thức torsoLean gốc của pose-engine
        if (areHipsClearlyVisible(f)) {
          return base.metric(f);
        }
        // Khi bàn học che hông -> đo góc nghiêng đường nối hai vai (tương đương độ nghiêng thân trên)
        const ls = f.lm[LM.L_SHOULDER];
        const rs = f.lm[LM.R_SHOULDER];
        const dx = Math.abs((rs.x - ls.x) * f.aspect);
        const dy = rs.y - ls.y;
        return Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
      },
      form: hipFormCheck
        ? [
            {
              id: hipFormCheck.id,
              penalty: hipFormCheck.penalty,
              // Chỉ kiểm tra lệch hông khi thực sự nhìn thấy hông
              pass: (f: Frame) =>
                areHipsClearlyVisible(f) ? hipFormCheck.pass(f) : true,
            },
          ]
        : [],
    };
  }

  return base;
}

/**
 * Đánh giá khung hình Lớp 0 theo từng động tác và chế độ Đứng / Ngồi:
 * - Chế độ Đứng: đo theo vai + thân (vai->hông).
 * - Chế độ Ngồi: CHỈ đo theo thân trên (bề ngang vai & khoảng cách vai–tai), không yêu cầu hông/chân.
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

  if (frame.lm && frame.lm.length >= 33) {
    const ls = frame.lm[LM.L_SHOULDER];
    const rs = frame.lm[LM.R_SHOULDER];
    if (ls.visibility >= cfg.minVisibility && rs.visibility >= cfg.minVisibility) {
      shoulderWidthRatio = Math.abs(ls.x - rs.x);
      const midShoulderX = ((ls.x + rs.x) / 2) * frame.aspect;
      const midShoulderY = (ls.y + rs.y) / 2;

      // Khoảng cách vai–tai (dùng để đo cự ly ngồi xa/gần theo thân trên)
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

      // Chiều cao thân vai->hông (chỉ dùng cho chế độ Đứng)
      const lh = frame.lm[LM.L_HIP];
      const rh = frame.lm[LM.R_HIP];
      if (lh.visibility >= cfg.minVisibility && rh.visibility >= cfg.minVisibility) {
        const midHipY = (lh.y + rh.y) / 2;
        torsoHeightRatio = Math.abs(midHipY - midShoulderY);
      }
    }
  }

  // Bước 1: Kiểm tra bằng hàm qualityGate chính thức của pose-engine.ts
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
      };
    }

    return {
      ok: false,
      reason: gate.reason ?? 'NO_POSE',
      shoulderWidthRatio,
      torsoHeightRatio,
      shoulderEarRatio,
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
    };
  }
}