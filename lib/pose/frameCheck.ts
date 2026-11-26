import {
  EXERCISES,
  LM,
  qualityGate,
  type ExerciseId,
  type Frame,
  type GateReason,
} from '@/lib/pose-engine';

/**
 * Các ngưỡng kiểm tra khung hình (Lớp 0) và chống nhấp nháy (300–500ms).
 * Đặt tập trung thành hằng số để dễ hiệu chỉnh và viết test Vitest.
 */
export const FRAME_CHECK_CONFIG = {
  /** Độ tin cậy tối thiểu cho từng khớp bắt buộc. */
  minVisibility: 0.6,
  /** Khớp bắt buộc phải cách mép khung hình ít nhất 3% (0.03..0.97). */
  edgeMargin: 0.03,
  /** Tỷ lệ chiều rộng vai so với bề ngang khung hình vượt mức này => đứng quá gần. */
  tooCloseShoulderWidth: 0.62,
  /** Tỷ lệ chiều cao thân (vai->hông) so với chiều cao khung hình vượt mức này => đứng quá gần. */
  tooCloseTorsoHeight: 0.62,
  /** Thời gian đạt / không đạt liên tục (ms) trước khi đổi trạng thái "Sẵn sàng" (chống nhấp nháy). */
  debounceMs: 400,
} as const;

/** Mở rộng thêm lý do TOO_CLOSE bên cạnh 4 mã GateReason của pose-engine.ts. */
export type FrameCheckReason = GateReason | 'TOO_CLOSE';

export interface FrameCheckResult {
  ok: boolean;
  reason: FrameCheckReason | null;
  /** Tỷ lệ bề rộng vai theo chiều ngang khung hình (0..1), dùng để debug. */
  shoulderWidthRatio: number | null;
  /** Tỷ lệ chiều cao thân (vai->hông) theo chiều cao khung hình (0..1), dùng để debug. */
  torsoHeightRatio: number | null;
}

export interface FrameStabilitySnapshot {
  /** Trạng thái đã chống nhấp nháy (chỉ đổi khi liên tục >= debounceMs). */
  stableOk: boolean;
  stableReason: FrameCheckReason | null;
  /** Trạng thái tức thời của khung hình hiện tại. */
  rawOk: boolean;
  rawReason: FrameCheckReason | null;
  /** Đang đếm thời gian chuyển trạng thái sang true/false, hoặc null nếu đang ổn định. */
  transitioningTo: boolean | null;
  /** Tiến độ ổn định 0..1 trong khoảng debounceMs. */
  transitionProgress: number;
  shoulderWidthRatio: number | null;
  torsoHeightRatio: number | null;
}

/**
 * Trả về danh sách khớp bắt buộc cho từng động tác:
 * - Squat: chỉ dùng vai, hông và đầu gối (bỏ cổ chân/bàn chân; giữ vai vì pose-engine đo unit() theo vai).
 * - Các động tác còn lại: lấy nguyên danh sách required từ EXERCISES của pose-engine.ts.
 */
export function getRequiredLandmarks(exerciseId: ExerciseId): number[] {
  const base = EXERCISES[exerciseId].required;
  if (exerciseId === 'squat') {
    return base.filter((idx) => idx !== LM.L_ANKLE && idx !== LM.R_ANKLE);
  }
  return [...base];
}

/**
 * Đánh giá khung hình Lớp 0 theo từng động tác:
 * 1. Tận dụng trực tiếp qualityGate() của pose-engine.ts (visibility >= 0.6, TOO_FAR, NO_POSE).
 * 2. Bổ sung kiểm tra đứng quá gần (TOO_CLOSE) và khớp bắt buộc sát mép khung (OUT_OF_FRAME).
 */
export function evaluateFrameCheck(
  frame: Frame,
  exerciseId: ExerciseId
): FrameCheckResult {
  const required = getRequiredLandmarks(exerciseId);
  const { minVisibility, edgeMargin, tooCloseShoulderWidth, tooCloseTorsoHeight } =
    FRAME_CHECK_CONFIG;

  let shoulderWidthRatio: number | null = null;
  let torsoHeightRatio: number | null = null;

  if (frame.lm && frame.lm.length >= 33) {
    const ls = frame.lm[LM.L_SHOULDER];
    const rs = frame.lm[LM.R_SHOULDER];
    if (ls.visibility >= minVisibility && rs.visibility >= minVisibility) {
      shoulderWidthRatio = Math.abs(ls.x - rs.x);

      const lh = frame.lm[LM.L_HIP];
      const rh = frame.lm[LM.R_HIP];
      if (lh.visibility >= minVisibility && rh.visibility >= minVisibility) {
        const midShoulderY = (ls.y + rs.y) / 2;
        const midHipY = (lh.y + rh.y) / 2;
        torsoHeightRatio = Math.abs(midHipY - midShoulderY);
      }
    }
  }

  // Bước 1: Kiểm tra bằng hàm qualityGate chính thức của pose-engine.ts
  const gate = qualityGate(frame, required, minVisibility);
  if (!gate.ok) {
    // Nếu người đứng quá sát khiến khớp bị tràn mép nhưng hai vai đã quá to -> báo rõ TOO_CLOSE
    if (
      gate.reason === 'OUT_OF_FRAME' &&
      shoulderWidthRatio !== null &&
      shoulderWidthRatio > tooCloseShoulderWidth
    ) {
      return {
        ok: false,
        reason: 'TOO_CLOSE',
        shoulderWidthRatio,
        torsoHeightRatio,
      };
    }

    return {
      ok: false,
      reason: gate.reason ?? 'NO_POSE',
      shoulderWidthRatio,
      torsoHeightRatio,
    };
  }

  // Bước 2: Phát hiện đứng quá gần (thân hoặc vai chiếm quá lớn trong khung)
  const hipsRequired = required.includes(LM.L_HIP) || required.includes(LM.R_HIP);
  if (
    (shoulderWidthRatio !== null && shoulderWidthRatio > tooCloseShoulderWidth) ||
    (hipsRequired && torsoHeightRatio !== null && torsoHeightRatio > tooCloseTorsoHeight)
  ) {
    return {
      ok: false,
      reason: 'TOO_CLOSE',
      shoulderWidthRatio,
      torsoHeightRatio,
    };
  }

  // Bước 3: Phát hiện khớp bắt buộc quá sát mép khung hình (dễ bị cắt khi cử động)
  for (let i = 0; i < required.length; i++) {
    const pt = frame.lm[required[i]];
    if (
      pt.x < edgeMargin ||
      pt.x > 1 - edgeMargin ||
      pt.y < edgeMargin ||
      pt.y > 1 - edgeMargin
    ) {
      return {
        ok: false,
        reason: 'OUT_OF_FRAME',
        shoulderWidthRatio,
        torsoHeightRatio,
      };
    }
  }

  return {
    ok: true,
    reason: null,
    shoulderWidthRatio,
    torsoHeightRatio,
  };
}

/**
 * Bộ chống nhấp nháy trạng thái khung hình (Lớp 0):
 * Yêu cầu đạt hoặc không đạt liên tục ít nhất `debounceMs` (mặc định 400ms)
 * mới chuyển đổi trạng thái "Sẵn sàng" <-> "Chưa đạt".
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
      // Trạng thái tức thời khớp trạng thái ổn định -> hủy bộ đếm chuyển tiếp
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
    };
  }
}