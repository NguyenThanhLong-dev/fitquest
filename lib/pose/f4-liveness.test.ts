import { describe, expect, it } from 'vitest';
import { LM, type Frame, type Landmark } from '@/lib/pose-engine';
import {
  FRAME_CHECK_CONFIG,
  FrameStabilityGate,
  evaluateFrameCheck,
  getRequiredLandmarks,
} from '@/lib/pose/frameCheck';
import {
  LIVENESS_CONFIG,
  LivenessRunController,
  buildChallengeSchedule,
  isChallengePoseHeld,
  resolveChallengeHandMapping,
} from '@/lib/pose/liveness';

/** Tạo bộ 33 khớp chuẩn đứng giữa khung hình (tỷ lệ 4:3, mọi khớp đều rõ). */
function makeGoodFrame(
  t: number,
  overrides: Partial<Record<number, Partial<Landmark>>> = {}
): Frame {
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.95,
  }));

  // Đặt vị trí các khớp chính hợp lý ở giữa khung hình
  lm[LM.NOSE] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 };
  lm[LM.L_EAR] = { x: 0.54, y: 0.2, z: 0, visibility: 0.95 };
  lm[LM.R_EAR] = { x: 0.46, y: 0.2, z: 0, visibility: 0.95 };
  lm[LM.L_SHOULDER] = { x: 0.62, y: 0.35, z: 0, visibility: 0.95 };
  lm[LM.R_SHOULDER] = { x: 0.38, y: 0.35, z: 0, visibility: 0.95 };
  lm[LM.L_ELBOW] = { x: 0.66, y: 0.48, z: 0, visibility: 0.95 };
  lm[LM.R_ELBOW] = { x: 0.34, y: 0.48, z: 0, visibility: 0.95 };
  lm[LM.L_WRIST] = { x: 0.66, y: 0.58, z: 0, visibility: 0.95 };
  lm[LM.R_WRIST] = { x: 0.34, y: 0.58, z: 0, visibility: 0.95 };
  lm[LM.L_HIP] = { x: 0.58, y: 0.6, z: 0, visibility: 0.95 };
  lm[LM.R_HIP] = { x: 0.42, y: 0.6, z: 0, visibility: 0.95 };
  lm[LM.L_KNEE] = { x: 0.58, y: 0.78, z: 0, visibility: 0.95 };
  lm[LM.R_KNEE] = { x: 0.42, y: 0.78, z: 0, visibility: 0.95 };
  lm[LM.L_ANKLE] = { x: 0.58, y: 0.92, z: 0, visibility: 0.95 };
  lm[LM.R_ANKLE] = { x: 0.42, y: 0.92, z: 0, visibility: 0.95 };

  for (const [idxStr, patch] of Object.entries(overrides)) {
    const idx = Number(idxStr);
    if (patch && lm[idx]) {
      lm[idx] = { ...lm[idx], ...patch };
    }
  }

  return { t, aspect: 4 / 3, lm };
}

describe('F4 — Kiểm tra khung hình Lớp 0 & chống nhấp nháy', () => {
  it('Squat không yêu cầu cổ chân/bàn chân và vẫn đạt khi cổ chân bị che', () => {
    const req = getRequiredLandmarks('squat');
    expect(req).not.toContain(LM.L_ANKLE);
    expect(req).not.toContain(LM.R_ANKLE);
    expect(req).toContain(LM.L_HIP);
    expect(req).toContain(LM.L_KNEE);

    const frame = makeGoodFrame(0, {
      [LM.L_ANKLE]: { visibility: 0.05 },
      [LM.R_ANKLE]: { visibility: 0.05 },
    });
    const res = evaluateFrameCheck(frame, 'squat');
    expect(res.ok).toBe(true);
    expect(res.reason).toBeNull();
  });

  it('Phân biệt rõ từng nguyên nhân: NO_POSE, LOW_VISIBILITY, OUT_OF_FRAME, TOO_FAR, TOO_CLOSE', () => {
    // 1. NO_POSE
    expect(evaluateFrameCheck({ t: 0, aspect: 4 / 3, lm: [] }, 'squat').reason).toBe(
      'NO_POSE'
    );

    // 2. LOW_VISIBILITY (thiếu khớp đầu gối khi tập squat)
    const missingKnee = makeGoodFrame(0, { [LM.L_KNEE]: { visibility: 0.3 } });
    expect(evaluateFrameCheck(missingKnee, 'squat').reason).toBe('LOW_VISIBILITY');

    // 3. OUT_OF_FRAME (khớp bắt buộc quá sát mép khung)
    const nearEdge = makeGoodFrame(0, { [LM.L_KNEE]: { y: 0.99 } });
    expect(evaluateFrameCheck(nearEdge, 'squat').reason).toBe('OUT_OF_FRAME');

    // 4. TOO_FAR (đứng quá xa, độ rộng vai < 0.1)
    const tooFar = makeGoodFrame(0, {
      [LM.L_SHOULDER]: { x: 0.52, y: 0.4 },
      [LM.R_SHOULDER]: { x: 0.48, y: 0.4 },
    });
    expect(evaluateFrameCheck(tooFar, 'squat').reason).toBe('TOO_FAR');

    // 5. TOO_CLOSE (đứng quá gần, bề rộng vai vượt ngưỡng 0.62)
    const tooClose = makeGoodFrame(0, {
      [LM.L_SHOULDER]: { x: 0.85, y: 0.35 },
      [LM.R_SHOULDER]: { x: 0.15, y: 0.35 },
    });
    expect(evaluateFrameCheck(tooClose, 'overhead_reach').reason).toBe('TOO_CLOSE');
  });

  it('Chống nhấp nháy (400ms): chỉ đổi Sẵn sàng / Chưa đạt khi duy trì liên tục đủ thời gian', () => {
    const gate = new FrameStabilityGate(FRAME_CHECK_CONFIG.debounceMs);
    const okRaw = { ok: true, reason: null, shoulderWidthRatio: 0.24, torsoHeightRatio: 0.25 };
    const badRaw = {
      ok: false,
      reason: 'LOW_VISIBILITY' as const,
      shoulderWidthRatio: 0.24,
      torsoHeightRatio: 0.25,
    };

    // Chưa đủ 400ms -> vẫn Chưa đạt
    expect(gate.update(okRaw, 0).stableOk).toBe(false);
    expect(gate.update(okRaw, 300).stableOk).toBe(false);

    // Đủ 400ms liên tục -> chuyển sang Sẵn sàng
    expect(gate.update(okRaw, 400).stableOk).toBe(true);

    // Nhiễu ngắn 200ms rồi quay lại đạt -> KHÔNG nhấp nháy về Chưa đạt
    expect(gate.update(badRaw, 500).stableOk).toBe(true);
    expect(gate.update(badRaw, 700).stableOk).toBe(true);
    expect(gate.update(okRaw, 750).stableOk).toBe(true);

    // Mất tư thế liên tục đủ 400ms -> mới chuyển sang Chưa đạt
    expect(gate.update(badRaw, 1000).stableOk).toBe(true);
    expect(gate.update(badRaw, 1350).stableOk).toBe(true);
    const lost = gate.update(badRaw, 1400);
    expect(lost.stableOk).toBe(false);
    expect(lost.stableReason).toBe('LOW_VISIBILITY');
  });
});

describe('F4 — Lịch thử thách theo seed & ánh xạ trái/phải gương', () => {
  it('Lịch thử thách cố định 100% theo seed và luôn nằm trong 0–2 lần', () => {
    const schedA = buildChallengeSchedule(202604);
    const schedB = buildChallengeSchedule(202604);
    expect(schedA).toEqual(schedB);

    const seenCounts = new Set<number>();
    for (let s = 1; s <= 120; s++) {
      const list = buildChallengeSchedule(s * 97);
      expect(list.length).toBeGreaterThanOrEqual(LIVENESS_CONFIG.minChallenges);
      expect(list.length).toBeLessThanOrEqual(LIVENESS_CONFIG.maxChallenges);
      seenCounts.add(list.length);
      if (list.length > 0) {
        expect(list[0].triggerAfterReps).toBeGreaterThanOrEqual(
          LIVENESS_CONFIG.minValidRepsBeforeFirst
        );
      }
    }
    expect(seenCounts.has(0)).toBe(true);
    expect(seenCounts.has(1)).toBe(true);
    expect(seenCounts.has(2)).toBe(true);
  });

  it('Ánh xạ trái/phải đúng với video lật gương bằng CSS và hỗ trợ chế độ đảo pixel', () => {
    // Mặc định CSS gương: MediaPipe nhận video gốc nên RAISE_LEFT_HAND -> LM.L_WRIST
    const leftCss = resolveChallengeHandMapping('RAISE_LEFT_HAND', false);
    expect(leftCss.targetWrist).toBe(LM.L_WRIST);
    expect(leftCss.targetShoulder).toBe(LM.L_SHOULDER);

    const rightCss = resolveChallengeHandMapping('RAISE_RIGHT_HAND', false);
    expect(rightCss.targetWrist).toBe(LM.R_WRIST);
    expect(rightCss.targetShoulder).toBe(LM.R_SHOULDER);

    // Nếu camera/driver tự lật pixel trước khi vào MediaPipe -> đảo sang khớp đối diện
    const leftSwapped = resolveChallengeHandMapping('RAISE_LEFT_HAND', true);
    expect(leftSwapped.targetWrist).toBe(LM.R_WRIST);

    // Giơ tay trái thật (L_WRIST cao hơn L_SHOULDER, R_WRIST ở dưới)
    const raiseLeftFrame = makeGoodFrame(0, {
      [LM.L_WRIST]: { x: 0.65, y: 0.15 },
      [LM.R_WRIST]: { x: 0.35, y: 0.58 },
    });
    expect(isChallengePoseHeld('RAISE_LEFT_HAND', raiseLeftFrame, false)).toBe(true);
    expect(isChallengePoseHeld('RAISE_RIGHT_HAND', raiseLeftFrame, false)).toBe(false);

    // Giơ cả hai tay cùng lúc -> không hợp lệ
    const raiseBothFrame = makeGoodFrame(0, {
      [LM.L_WRIST]: { x: 0.65, y: 0.15 },
      [LM.R_WRIST]: { x: 0.35, y: 0.15 },
    });
    expect(isChallengePoseHeld('RAISE_LEFT_HAND', raiseBothFrame, false)).toBe(false);
  });

  it('Phải giữ tay cao hơn vai liên tục 0,5s mới đạt; hết 5s ghi nhận 1 thất bại và không hủy lượt', () => {
    // Tìm 1 seed chắc chắn có ít nhất 1 thử thách
    let seedWithChallenge = 1;
    while (buildChallengeSchedule(seedWithChallenge).length === 0) {
      seedWithChallenge++;
    }

    const ctrlPass = new LivenessRunController(seedWithChallenge, true);
    const first = ctrlPass.getSnapshot().schedule[0];

    // Frame đầu tiên đánh dấu t = 0
    expect(ctrlPass.onFrame(makeGoodFrame(0), 0).startedNewChallenge).toBe(false);

    // Đạt đủ số rep và thời điểm theo lịch -> bật thử thách
    const startT = first.triggerAfterMs + 100;
    const triggered = ctrlPass.onFrame(
      makeGoodFrame(startT),
      first.triggerAfterReps
    );
    expect(triggered.startedNewChallenge).toBe(true);
    expect(triggered.snapshot.activeChallenge?.id).toBe(first.id);

    const raisedPatch =
      first.id === 'RAISE_LEFT_HAND'
        ? { [LM.L_WRIST]: { x: 0.65, y: 0.15 }, [LM.R_WRIST]: { x: 0.35, y: 0.58 } }
        : { [LM.R_WRIST]: { x: 0.35, y: 0.15 }, [LM.L_WRIST]: { x: 0.65, y: 0.58 } };

    // Giữ 300ms chưa đủ 500ms -> chưa đạt
    expect(
      ctrlPass.onFrame(makeGoodFrame(startT + 200, raisedPatch), first.triggerAfterReps)
        .completedOutcome
    ).toBeNull();
    expect(
      ctrlPass.onFrame(makeGoodFrame(startT + 500, raisedPatch), first.triggerAfterReps)
        .completedOutcome
    ).toBeNull();

    // Hạ tay giữa chừng -> reset đồng hồ giữ
    expect(
      ctrlPass.onFrame(makeGoodFrame(startT + 600), first.triggerAfterReps)
        .completedOutcome
    ).toBeNull();

    // Giữ lại liên tục từ +700 đến +1200 (đủ 500ms) -> ĐẠT
    ctrlPass.onFrame(makeGoodFrame(startT + 700, raisedPatch), first.triggerAfterReps);
    const passedStep = ctrlPass.onFrame(
      makeGoodFrame(startT + 1200, raisedPatch),
      first.triggerAfterReps
    );
    expect(passedStep.completedOutcome?.passed).toBe(true);
    expect(passedStep.snapshot.passedCount).toBe(1);
    expect(passedStep.snapshot.activeChallenge).toBeNull();

    // Kiểm tra trường hợp hết 5 giây không giơ tay -> ghi nhận 1 thất bại
    const ctrlFail = new LivenessRunController(seedWithChallenge, true);
    ctrlFail.onFrame(makeGoodFrame(0), 0);
    ctrlFail.onFrame(makeGoodFrame(startT), first.triggerAfterReps);
    const failedStep = ctrlFail.onFrame(
      makeGoodFrame(startT + LIVENESS_CONFIG.deadlineMs + 50),
      first.triggerAfterReps
    );
    expect(failedStep.completedOutcome?.passed).toBe(false);
    expect(failedStep.snapshot.failedCount).toBe(1);
    expect(failedStep.snapshot.activeChallenge).toBeNull();
  });
});