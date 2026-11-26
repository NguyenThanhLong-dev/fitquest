import {
  LM,
  makeRng,
  newSeed,
  type ChallengeId,
  type Frame,
} from '@/lib/pose-engine';

/**
 * Cấu hình Thử thách sống (Lớp 3b) cho F4.
 * - Đổi `fixedSeed` thành một số nguyên (ví dụ 202604) để cố định lịch thử thách khi kiểm thử.
 * - Đặt `fixedSeed: null` để tự sinh seed ngẫu nhiên bằng newSeed() của pose-engine.ts.
 */
export const LIVENESS_CONFIG = {
  fixedSeed: null as number | null,
  minChallenges: 0,
  maxChallenges: 2,
  /** Số rep hợp lệ tối thiểu trong lượt trước khi thử thách đầu tiên được phép xuất hiện. */
  minValidRepsBeforeFirst: 3,
  /** Cửa sổ thời gian (ms kể từ đầu lượt) cho thử thách đầu tiên. */
  firstWindowMinMs: 8_000,
  firstWindowMaxMs: 20_000,
  /** Khoảng cách tối thiểu–tối đa (ms) giữa thử thách 1 và thử thách 2. */
  gapMinMs: 12_000,
  gapMaxMs: 24_000,
  /** Đồng hồ đếm ngược cho mỗi thử thách (5 giây). */
  deadlineMs: 5_000,
  /** Thời gian phải giữ tay cao hơn vai liên tục mới tính đạt (0,5 giây). */
  requiredHoldMs: 500,
  /** Độ tin cậy tối thiểu của vai và cổ tay khi kiểm tra thử thách. */
  minLandmarkVisibility: 0.5,
  /** Cổ tay đích phải cao hơn vai ít nhất 0.12 × chiều dài thân (trục y nhỏ hơn). */
  wristAboveShoulderMargin: 0.12,
  /** Cổ tay bên còn lại không được giơ cao hơn vai (chống giơ cả hai tay). */
  otherWristTolerance: 0.02,
} as const;

/**
 * ĐỊNH NGHĨA DUY NHẤT CÁCH ÁNH XẠ TRÁI/PHẢI VỚI VIDEO LẬT GƯƠNG:
 * - CameraView chỉ lật hiển thị bằng CSS (`-scale-x-100`); thẻ <video> đưa vào MediaPipe KHÔNG bị lật.
 * - MediaPipe gắn nhãn L_WRIST (15) / R_WRIST (16) theo GIẢI PHẪU THẬT của người tập:
 *   + Khi màn hình gương báo "Giơ tay trái lên": người tập giơ tay trái thật (hiện phía trái màn hình),
 *     MediaPipe nhận diện đúng LM.L_WRIST -> `swapAnatomicalLeftRight = false`.
 *   + Khi màn hình gương báo "Giơ tay phải lên": người tập giơ tay phải thật (hiện phía phải màn hình),
 *     MediaPipe nhận diện đúng LM.R_WRIST -> `swapAnatomicalLeftRight = false`.
 * - Chỉ đổi hằng số này thành `true` nếu camera/driver tự lật pixel đầu vào trước khi MediaPipe đọc.
 */
export const MIRROR_HAND_MAPPING = {
  swapAnatomicalLeftRight: false,
} as const;

export interface HandLandmarkPair {
  targetWrist: number;
  targetShoulder: number;
  otherWrist: number;
  otherShoulder: number;
}

/**
 * Hàm duy nhất ánh xạ ChallengeId ("Giơ tay trái/phải") sang cặp khớp cổ tay & vai cần kiểm tra.
 */
export function resolveChallengeHandMapping(
  challengeId: ChallengeId,
  swapAnatomical: boolean = MIRROR_HAND_MAPPING.swapAnatomicalLeftRight
): HandLandmarkPair {
  const checkAnatomicalLeft =
    challengeId === 'RAISE_LEFT_HAND' ? !swapAnatomical : swapAnatomical;

  if (checkAnatomicalLeft) {
    return {
      targetWrist: LM.L_WRIST,
      targetShoulder: LM.L_SHOULDER,
      otherWrist: LM.R_WRIST,
      otherShoulder: LM.R_SHOULDER,
    };
  }

  return {
    targetWrist: LM.R_WRIST,
    targetShoulder: LM.R_SHOULDER,
    otherWrist: LM.L_WRIST,
    otherShoulder: LM.L_SHOULDER,
  };
}

/** Tạo seed cho một lượt tập thử mới (dùng fixedSeed nếu đang bật chế độ cố định để test). */
export function createRunSeed(): { seed: number; isFixed: boolean } {
  if (LIVENESS_CONFIG.fixedSeed !== null) {
    return { seed: LIVENESS_CONFIG.fixedSeed >>> 0, isFixed: true };
  }
  return { seed: newSeed(), isFixed: false };
}

export type ScheduledChallengeStatus = 'pending' | 'active' | 'passed' | 'failed';

export interface ScheduledChallenge {
  index: number;
  id: ChallengeId;
  /** Số rep hợp lệ tối thiểu trong lượt để thử thách này được kích hoạt. */
  triggerAfterReps: number;
  /** Thời điểm sớm nhất (ms từ lúc bắt đầu lượt) để kích hoạt thử thách này. */
  triggerAfterMs: number;
  status: ScheduledChallengeStatus;
}

export interface ActiveChallengeSnapshot {
  index: number;
  id: ChallengeId;
  startedAtMs: number;
  deadlineMs: number;
  remainingMs: number;
  holdMs: number;
  requiredHoldMs: number;
  poseHeldNow: boolean;
}

export interface ChallengeOutcomeSnapshot {
  index: number;
  id: ChallengeId;
  passed: boolean;
  finishedAtMs: number;
}

export interface LivenessRunSnapshot {
  seed: number;
  isFixedSeed: boolean;
  schedule: ScheduledChallenge[];
  activeChallenge: ActiveChallengeSnapshot | null;
  passedCount: number;
  failedCount: number;
  lastOutcome: ChallengeOutcomeSnapshot | null;
}

export interface LivenessStepResult {
  snapshot: LivenessRunSnapshot;
  /** True ở đúng frame một thử thách mới vừa bật lên (UI/hook phải gọi counter.reset()). */
  startedNewChallenge: boolean;
  /** Khác null ở đúng frame một thử thách vừa kết thúc (đạt hoặc hết giờ). */
  completedOutcome: ChallengeOutcomeSnapshot | null;
}

/**
 * Sinh lịch thử thách tất định (0–2 lần) theo seed bằng đúng PRNG `makeRng` của pose-engine.ts.
 */
export function buildChallengeSchedule(seed: number): ScheduledChallenge[] {
  const rng = makeRng(seed);
  const {
    minChallenges,
    maxChallenges,
    minValidRepsBeforeFirst,
    firstWindowMinMs,
    firstWindowMaxMs,
    gapMinMs,
    gapMaxMs,
  } = LIVENESS_CONFIG;

  const spanCount = Math.max(0, maxChallenges - minChallenges) + 1;
  const count = minChallenges + Math.floor(rng() * spanCount);

  const items: ScheduledChallenge[] = [];
  let cursorMs = 0;
  let cursorReps = 0;

  for (let i = 0; i < count; i++) {
    const id: ChallengeId = rng() < 0.5 ? 'RAISE_LEFT_HAND' : 'RAISE_RIGHT_HAND';

    if (i === 0) {
      cursorMs =
        firstWindowMinMs +
        Math.round(rng() * Math.max(0, firstWindowMaxMs - firstWindowMinMs));
      cursorReps = minValidRepsBeforeFirst;
    } else {
      cursorMs += gapMinMs + Math.round(rng() * Math.max(0, gapMaxMs - gapMinMs));
      cursorReps += 2 + Math.floor(rng() * 3); // thêm 2..4 rep sau thử thách trước
    }

    items.push({
      index: i + 1,
      id,
      triggerAfterReps: cursorReps,
      triggerAfterMs: cursorMs,
      status: 'pending',
    });
  }

  return items;
}

/**
 * Kiểm tra tại một frame xem người tập có đang giơ ĐÚNG tay cao hơn vai hay không
 * (và không giơ cả hai tay cùng lúc).
 */
export function isChallengePoseHeld(
  challengeId: ChallengeId,
  frame: Frame,
  swapAnatomical: boolean = MIRROR_HAND_MAPPING.swapAnatomicalLeftRight
): boolean {
  if (!frame.lm || frame.lm.length < 33) return false;

  const { targetWrist, targetShoulder, otherWrist, otherShoulder } =
    resolveChallengeHandMapping(challengeId, swapAnatomical);

  const tw = frame.lm[targetWrist];
  const ts = frame.lm[targetShoulder];
  const ow = frame.lm[otherWrist];
  const os = frame.lm[otherShoulder];
  const minVis = LIVENESS_CONFIG.minLandmarkVisibility;

  if (tw.visibility < minVis || ts.visibility < minVis || os.visibility < minVis) {
    return false;
  }

  // Dùng chiều dài thân tương đương (1.1 × độ rộng vai đã hiệu chỉnh tỷ lệ khung hình)
  const shoulderDist = Math.hypot(
    (ts.x - os.x) * frame.aspect,
    ts.y - os.y
  );
  const torsoUnit = shoulderDist * 1.1;
  if (torsoUnit < 0.05) return false;

  // Hệ tọa độ chuẩn hóa: y càng nhỏ thì càng cao
  const targetRaised =
    tw.y < ts.y - LIVENESS_CONFIG.wristAboveShoulderMargin * torsoUnit;
  if (!targetRaised) return false;

  // Nếu tay kia nhìn rõ, yêu cầu tay kia không giơ cao quá vai (tránh giơ cả 2 tay)
  if (ow.visibility >= minVis) {
    const otherDown =
      ow.y > os.y - LIVENESS_CONFIG.otherWristTolerance * torsoUnit;
    if (!otherDown) return false;
  }

  return true;
}

/**
 * Bộ điều phối Thử thách sống trong một Lượt tập thử (Run):
 * - Kích hoạt thử thách theo lịch seed (0–2 lần).
 * - Đếm ngược 5 giây và yêu cầu giữ tay cao hơn vai liên tục 0,5 giây.
 * - Ghi nhận đạt / thất bại mà KHÔNG tự hủy phiên ở F4.
 */
export class LivenessRunController {
  readonly seed: number;
  readonly isFixedSeed: boolean;
  private readonly schedule: ScheduledChallenge[];
  private runStartMs: number | null = null;
  private activeIndex: number | null = null;
  private activeStartedAtMs = 0;
  private holdStartMs: number | null = null;
  private currentHoldMs = 0;
  private lastPoseHeld = false;
  private passedCount = 0;
  private failedCount = 0;
  private lastOutcome: ChallengeOutcomeSnapshot | null = null;

  constructor(
    seed: number,
    isFixedSeed = false,
    private readonly swapAnatomical: boolean = MIRROR_HAND_MAPPING.swapAnatomicalLeftRight
  ) {
    this.seed = seed >>> 0;
    this.isFixedSeed = isFixedSeed;
    this.schedule = buildChallengeSchedule(this.seed);
  }

  get scheduledCount(): number {
    return this.schedule.length;
  }

  get hasActiveChallenge(): boolean {
    return this.activeIndex !== null;
  }

  getSnapshot(nowMs: number | null = null): LivenessRunSnapshot {
    let activeChallenge: ActiveChallengeSnapshot | null = null;

    if (this.activeIndex !== null) {
      const item = this.schedule[this.activeIndex];
      const elapsed = nowMs !== null ? Math.max(0, nowMs - this.activeStartedAtMs) : 0;
      activeChallenge = {
        index: item.index,
        id: item.id,
        startedAtMs: this.activeStartedAtMs,
        deadlineMs: LIVENESS_CONFIG.deadlineMs,
        remainingMs: Math.max(0, LIVENESS_CONFIG.deadlineMs - elapsed),
        holdMs: Math.min(LIVENESS_CONFIG.requiredHoldMs, this.currentHoldMs),
        requiredHoldMs: LIVENESS_CONFIG.requiredHoldMs,
        poseHeldNow: this.lastPoseHeld,
      };
    }

    return {
      seed: this.seed,
      isFixedSeed: this.isFixedSeed,
      schedule: this.schedule.map((item) => ({ ...item })),
      activeChallenge,
      passedCount: this.passedCount,
      failedCount: this.failedCount,
      lastOutcome: this.lastOutcome ? { ...this.lastOutcome } : null,
    };
  }

  /** Cập nhật mỗi frame trong lượt tập đang hoạt động. */
  onFrame(frame: Frame, validRepsInRun: number): LivenessStepResult {
    if (this.runStartMs === null) {
      this.runStartMs = frame.t;
    }

    let startedNewChallenge = false;
    let completedOutcome: ChallengeOutcomeSnapshot | null = null;

    // 1. Nếu đang có thử thách mở -> kiểm tra giữ tay 0,5s và đồng hồ đếm ngược 5s
    if (this.activeIndex !== null) {
      const item = this.schedule[this.activeIndex];
      const held = isChallengePoseHeld(item.id, frame, this.swapAnatomical);
      this.lastPoseHeld = held;

      if (held) {
        if (this.holdStartMs === null) {
          this.holdStartMs = frame.t;
          this.currentHoldMs = 0;
        } else {
          this.currentHoldMs = Math.max(0, frame.t - this.holdStartMs);
        }

        if (this.currentHoldMs >= LIVENESS_CONFIG.requiredHoldMs) {
          item.status = 'passed';
          this.passedCount += 1;
          completedOutcome = {
            index: item.index,
            id: item.id,
            passed: true,
            finishedAtMs: frame.t,
          };
          this.lastOutcome = completedOutcome;
          this.clearActive();
        }
      } else {
        // Phải giữ liên tục 0,5s: hạ tay giữa chừng thì đồng hồ giữ về 0
        this.holdStartMs = null;
        this.currentHoldMs = 0;
      }

      // Kiểm tra hết 5 giây (nếu vẫn chưa đạt)
      if (
        this.activeIndex !== null &&
        frame.t - this.activeStartedAtMs >= LIVENESS_CONFIG.deadlineMs
      ) {
        item.status = 'failed';
        this.failedCount += 1;
        completedOutcome = {
          index: item.index,
          id: item.id,
          passed: false,
          finishedAtMs: frame.t,
        };
        this.lastOutcome = completedOutcome;
        this.clearActive();
      }

      return {
        snapshot: this.getSnapshot(frame.t),
        startedNewChallenge,
        completedOutcome,
      };
    }

    // 2. Chưa có thử thách mở -> kiểm tra xem đã tới lượt thử thách tiếp theo trong lịch chưa
    const nextIdx = this.schedule.findIndex((item) => item.status === 'pending');
    if (nextIdx !== -1) {
      const nextItem = this.schedule[nextIdx];
      const elapsedRunMs = frame.t - this.runStartMs;

      if (
        validRepsInRun >= nextItem.triggerAfterReps &&
        elapsedRunMs >= nextItem.triggerAfterMs
      ) {
        nextItem.status = 'active';
        this.activeIndex = nextIdx;
        this.activeStartedAtMs = frame.t;
        this.holdStartMs = null;
        this.currentHoldMs = 0;
        this.lastPoseHeld = false;
        startedNewChallenge = true;
      }
    }

    return {
      snapshot: this.getSnapshot(frame.t),
      startedNewChallenge,
      completedOutcome,
    };
  }

  private clearActive(): void {
    this.activeIndex = null;
    this.activeStartedAtMs = 0;
    this.holdStartMs = null;
    this.currentHoldMs = 0;
    this.lastPoseHeld = false;
  }
}