import { describe, expect, it } from 'vitest';
import { LM, RepCounter, type Frame, type Landmark } from '@/lib/pose-engine';
import {
  ALL_EXERCISE_IDS,
  SEATED_EXERCISE_IDS,
  finalizeDungeonRun,
  getAllowedExercises,
} from '@/lib/game/engineAdapter';
import {
  DUNGEON_CONFIG,
  createDungeonRunState,
  generateEncounters,
  swapCurrentMonster,
} from '@/lib/game/dungeon';
import {
  evaluateFrameCheck,
  getExerciseDefForPosture,
  getRequiredLandmarks,
} from '@/lib/pose/frameCheck';

/** Tạo khung hình người ngồi tại bàn học: rõ mũi + vai, hông và chân bị bàn che. */
function makeSeatedUpperBodyFrame(
  t: number,
  shoulderTiltDeg = 0,
  overrides: Partial<Record<number, Partial<Landmark>>> = {}
): Frame {
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.9,
    z: 0,
    visibility: 0,
  }));

  const halfShoulderX = 0.16;
  const aspect = 4 / 3;
  const dy = Math.tan((shoulderTiltDeg * Math.PI) / 180) * halfShoulderX * aspect;

  lm[LM.NOSE] = { x: 0.5, y: 0.3, z: 0, visibility: 0.95 };
  lm[2] = { x: 0.53, y: 0.28, z: 0, visibility: 0.95 }; // L_EYE
  lm[5] = { x: 0.47, y: 0.28, z: 0, visibility: 0.95 }; // R_EYE
  lm[LM.L_EAR] = { x: 0.56, y: 0.3, z: 0, visibility: 0.95 };
  lm[LM.R_EAR] = { x: 0.44, y: 0.3, z: 0, visibility: 0.95 };
  lm[LM.L_SHOULDER] = { x: 0.5 + halfShoulderX, y: 0.5 + dy, z: 0, visibility: 0.95 };
  lm[LM.R_SHOULDER] = { x: 0.5 - halfShoulderX, y: 0.5 - dy, z: 0, visibility: 0.95 };
  lm[LM.L_ELBOW] = { x: 0.72, y: 0.68, z: 0, visibility: 0.95 };
  lm[LM.R_ELBOW] = { x: 0.28, y: 0.68, z: 0, visibility: 0.95 };
  lm[LM.L_WRIST] = { x: 0.72, y: 0.82, z: 0, visibility: 0.95 };
  lm[LM.R_WRIST] = { x: 0.28, y: 0.82, z: 0, visibility: 0.95 };

  // Hông, gối, cổ chân hoàn toàn bị che dưới bàn học
  lm[LM.L_HIP] = { x: 0.6, y: 1.15, z: 0, visibility: 0 };
  lm[LM.R_HIP] = { x: 0.4, y: 1.15, z: 0, visibility: 0 };
  lm[LM.L_KNEE] = { x: 0.6, y: 1.4, z: 0, visibility: 0 };
  lm[LM.R_KNEE] = { x: 0.4, y: 1.4, z: 0, visibility: 0 };
  lm[LM.L_ANKLE] = { x: 0.6, y: 1.7, z: 0, visibility: 0 };
  lm[LM.R_ANKLE] = { x: 0.4, y: 1.7, z: 0, visibility: 0 };

  for (const [idxStr, patch] of Object.entries(overrides)) {
    const idx = Number(idxStr);
    if (patch && lm[idx]) {
      lm[idx] = { ...lm[idx], ...patch };
    }
  }

  return { t, aspect, lm };
}

describe('F8 — Chế độ Ngồi: danh sách động tác, Dungeon Run & khung hình thân trên', () => {
  it('Danh sách động tác theo chế độ: Đứng có đủ 5 bài, Ngồi chỉ có 3 bài thân trên', () => {
    expect(getAllowedExercises('standing')).toEqual(ALL_EXERCISE_IDS);
    expect(getAllowedExercises('seated')).toEqual(SEATED_EXERCISE_IDS);
    expect(getAllowedExercises('seated')).not.toContain('squat');
    expect(getAllowedExercises('seated')).not.toContain('high_knees');
  });

  it('Dungeon Run chế độ Ngồi luôn tạo đủ 3–5 nhiệm vụ, không lặp liên tiếp và chỉ gồm 3 bài ngồi', () => {
    const allowedSet = new Set(SEATED_EXERCISE_IDS);

    for (let s = 1; s <= 100; s++) {
      const encounters = generateEncounters(s * 173, false, 'seated');
      expect(encounters.length).toBeGreaterThanOrEqual(DUNGEON_CONFIG.minEncounters);
      expect(encounters.length).toBeLessThanOrEqual(DUNGEON_CONFIG.maxEncounters);

      for (let i = 0; i < encounters.length; i++) {
        expect(allowedSet.has(encounters[i].exercise)).toBe(true);
        if (i > 0) {
          expect(encounters[i].exercise).not.toBe(encounters[i - 1].exercise);
        }
      }
      expect(encounters[encounters.length - 1].isBoss).toBe(true);
    }

    const seatedRun = createDungeonRunState({ seed: 202608, postureMode: 'seated' });
    const oldEx = seatedRun.encounters[0].exercise;
    const swapped = swapCurrentMonster(seatedRun);
    const newEx = swapped.encounters[0].exercise;
    expect(newEx).not.toBe(oldEx);
    expect(allowedSet.has(newEx)).toBe(true);
  });

  it('Danh sách khớp bắt buộc chế độ Ngồi chỉ chứa thân trên và bỏ qua hông/chân', () => {
    const lowerBody = [
      LM.L_HIP,
      LM.R_HIP,
      LM.L_KNEE,
      LM.R_KNEE,
      LM.L_ANKLE,
      LM.R_ANKLE,
    ];

    for (const ex of SEATED_EXERCISE_IDS) {
      const seatedReq = getRequiredLandmarks(ex, 'seated');
      for (const lowerIdx of lowerBody) {
        expect(seatedReq).not.toContain(lowerIdx);
      }
    }

    const standingSideBendReq = getRequiredLandmarks('side_bend', 'standing');
    expect(standingSideBendReq).toContain(LM.L_HIP);
    expect(standingSideBendReq).toContain(LM.R_HIP);

    const seatedFrame = makeSeatedUpperBodyFrame(0);
    expect(evaluateFrameCheck(seatedFrame, 'overhead_reach', 'seated').ok).toBe(true);
    expect(evaluateFrameCheck(seatedFrame, 'side_bend', 'seated').ok).toBe(true);
    expect(evaluateFrameCheck(seatedFrame, 'neck_tilt', 'seated').ok).toBe(true);
  });

  it('Chế độ Ngồi phát hiện TOO_FAR và TOO_CLOSE dựa theo thân trên (bề ngang vai / vai–tai)', () => {
    const tooFar = makeSeatedUpperBodyFrame(0, 0, {
      [LM.L_SHOULDER]: { x: 0.55, y: 0.5 },
      [LM.R_SHOULDER]: { x: 0.45, y: 0.5 },
    });
    expect(evaluateFrameCheck(tooFar, 'side_bend', 'seated').reason).toBe('TOO_FAR');

    const tooClose = makeSeatedUpperBodyFrame(0, 0, {
      [LM.L_SHOULDER]: { x: 0.88, y: 0.5 },
      [LM.R_SHOULDER]: { x: 0.12, y: 0.5 },
    });
    expect(evaluateFrameCheck(tooClose, 'side_bend', 'seated').reason).toBe('TOO_CLOSE');
  });

  it('Bài Nghiêng người (side_bend) chế độ Ngồi vẫn đếm rep và qua finalizeRun khi hông bị bàn che', () => {
    const seatedDef = getExerciseDefForPosture('side_bend', 'seated');
    const counter = new RepCounter(seatedDef);

    let countedRep = null;
    for (let t = 0; t <= 400; t += 50) {
      counter.push(makeSeatedUpperBodyFrame(t, 1));
    }
    for (let t = 450; t <= 850; t += 50) {
      const ratio = (t - 450) / 400;
      counter.push(makeSeatedUpperBodyFrame(t, 1 + ratio * 14));
    }
    for (let t = 900; t <= 2600; t += 50) {
      const res = counter.push(makeSeatedUpperBodyFrame(t, 15));
      if (res.rep) {
        countedRep = res.rep;
        break;
      }
    }

    expect(countedRep).not.toBeNull();
    expect(countedRep?.counted).toBe(true);

    const runResult = finalizeDungeonRun(
      countedRep ? [countedRep] : [],
      3500,
      'verified',
      0
    );
    expect(runResult.verdict).toBe('verified');
    expect(runResult.xp).toBeGreaterThan(0);
  });

  it('Bài Vươn vai (overhead_reach) chế độ Ngồi đạt Sẵn sàng cả khi tay nghỉ dưới bàn và đếm rep khi giơ lên', () => {
    // Khi tay đặt nghỉ trên bàn (cổ tay & khuỷu bị che visibility = 0) -> vẫn Sẵn sàng
    const restDeskFrame = (t: number) =>
      makeSeatedUpperBodyFrame(t, 0, {
        [LM.L_ELBOW]: { y: 1.05, visibility: 0.1 },
        [LM.R_ELBOW]: { y: 1.05, visibility: 0.1 },
        [LM.L_WRIST]: { y: 1.15, visibility: 0.1 },
        [LM.R_WRIST]: { y: 1.15, visibility: 0.1 },
      });

    expect(evaluateFrameCheck(restDeskFrame(0), 'overhead_reach', 'seated').ok).toBe(true);

    const seatedDef = getExerciseDefForPosture('overhead_reach', 'seated');
    const counter = new RepCounter(seatedDef);

    let countedRep = null;
    // 0..400ms: nghỉ tay trên bàn -> mở khóa armed
    for (let t = 0; t <= 400; t += 50) {
      counter.push(restDeskFrame(t));
    }
    // 450..850ms: đưa hai tay từ dưới lên cao quá mũi
    for (let t = 450; t <= 850; t += 50) {
      const u = (t - 450) / 400;
      const wristY = 0.55 - u * 0.45; // 0.55 -> 0.10 (trên mũi y = 0.30)
      counter.push(
        makeSeatedUpperBodyFrame(t, 0, {
          [LM.L_WRIST]: { x: 0.66, y: wristY, visibility: 0.8 },
          [LM.R_WRIST]: { x: 0.34, y: wristY, visibility: 0.8 },
        })
      );
    }
    // 900..3200ms: giữ hai tay trên cao > 2s -> tính rep
    for (let t = 900; t <= 3200; t += 50) {
      const res = counter.push(
        makeSeatedUpperBodyFrame(t, 0, {
          [LM.L_WRIST]: { x: 0.66, y: 0.1, visibility: 0.8 },
          [LM.R_WRIST]: { x: 0.34, y: 0.1, visibility: 0.8 },
        })
      );
      if (res.rep) {
        countedRep = res.rep;
        break;
      }
    }

    expect(countedRep).not.toBeNull();
    expect(countedRep?.counted).toBe(true);
  });

  it('Bài Nghiêng cổ (neck_tilt) chế độ Ngồi vẫn đếm rep khi tai bị tóc/tai nghe che nhờ dự phòng 2 mắt', () => {
    const makeEyeTiltFrame = (t: number, tiltDeg: number) => {
      const halfEyeX = 0.03;
      const aspect = 4 / 3;
      const dy = Math.tan((tiltDeg * Math.PI) / 180) * halfEyeX * aspect;
      return makeSeatedUpperBodyFrame(t, 0, {
        [LM.L_EAR]: { visibility: 0.15 },
        [LM.R_EAR]: { visibility: 0.15 },
        [2]: { x: 0.5 + halfEyeX, y: 0.28 + dy, visibility: 0.9 },
        [5]: { x: 0.5 - halfEyeX, y: 0.28 - dy, visibility: 0.9 },
      });
    };

    expect(evaluateFrameCheck(makeEyeTiltFrame(0, 0), 'neck_tilt', 'seated').ok).toBe(true);

    const seatedDef = getExerciseDefForPosture('neck_tilt', 'seated');
    const counter = new RepCounter(seatedDef);

    let countedRep = null;
    for (let t = 0; t <= 400; t += 50) {
      counter.push(makeEyeTiltFrame(t, 1));
    }
    for (let t = 450; t <= 850; t += 50) {
      const u = (t - 450) / 400;
      counter.push(makeEyeTiltFrame(t, 1 + u * 13));
    }
    for (let t = 900; t <= 3200; t += 50) {
      const res = counter.push(makeEyeTiltFrame(t, 14));
      if (res.rep) {
        countedRep = res.rep;
        break;
      }
    }

    expect(countedRep).not.toBeNull();
    expect(countedRep?.counted).toBe(true);
  });
});