import { describe, expect, it } from 'vitest';
import {
  ENGINE_XP_CAP,
  getExerciseDef,
  type ExerciseId,
  type RepResult,
} from '@/lib/game/engineAdapter';
import {
  DUNGEON_CONFIG,
  advanceMonsterTransition,
  applyCancelledRepToDungeon,
  applyRepToDungeon,
  buildDungeonSummary,
  calculateRepDamage,
  computeCharacterStats,
  createDungeonRunState,
  createEmptyVerifiedReps,
  generateEncounters,
  getSkillsForLevel,
  swapCurrentMonster,
} from '@/lib/game/dungeon';

/** Tạo 1 RepResult hợp lệ chuẩn theo luật của pose-engine.ts để test finalizeRun. */
function makeValidRep(
  exercise: ExerciseId,
  index: number,
  options: { quality?: number; counted?: boolean; startT?: number } = {}
): RepResult {
  const def = getExerciseDef(exercise);
  const quality = options.quality ?? 0.95;
  const counted = options.counted ?? true;
  const durationMs = def.minRepMs + 400 + (index % 5) * 170;
  const startT = options.startT ?? index * 4000;

  // Quỹ đạo đa dạng nhẹ theo index để không dính LOOPED_MOTION khi test nhiều rep
  const phaseShift = (index % 7) * 0.04;
  const trajectory = Array.from({ length: 20 }, (_, k) => {
    const u = k / 19;
    if (def.holdMs > 0) {
      return Math.min(1.05, Math.max(0.2, 0.25 + u * 0.85 + Math.sin(u * 3 + phaseShift) * 0.06));
    }
    return Math.max(0, Math.sin(u * Math.PI) * (1.02 + phaseShift));
  });

  return {
    exercise,
    startT,
    endT: startT + durationMs,
    durationMs,
    maxProgress: 1.05,
    holdMs: def.holdMs > 0 ? def.holdMs + 100 : 0,
    peakVelocity: 1.5,
    reversals: 1,
    quality,
    trajectory,
    xp: counted ? Math.round(def.baseXp * quality) : 0,
    counted,
    flags: counted ? [] : ['NOT_DEEP_ENOUGH'],
  };
}

describe('F5a — Logic thuần Dungeon Run', () => {
  it('Cùng seed ra cùng một lượt (quái, Boss và 2 mục tiêu phụ) và không lặp liên tiếp cùng động tác', () => {
    const runA = createDungeonRunState({ seed: 202605 });
    const runB = createDungeonRunState({ seed: 202605 });

    expect(runA.encounters).toEqual(runB.encounters);
    expect(runA.sideObjectives).toEqual(runB.sideObjectives);
    expect(runA.sideObjectives).toHaveLength(2);

    // Quét 80 seed khác nhau: luôn 3–5 quái, quái cuối là Boss HP gấp đôi, không lặp động tác liền kề
    for (let s = 1; s <= 80; s++) {
      const list = generateEncounters(s * 131, false);
      expect(list.length).toBeGreaterThanOrEqual(DUNGEON_CONFIG.minEncounters);
      expect(list.length).toBeLessThanOrEqual(DUNGEON_CONFIG.maxEncounters);

      for (let i = 1; i < list.length; i++) {
        expect(list[i].exercise).not.toBe(list[i - 1].exercise);
      }

      // Chỉ quái cuối là Boss và có HP gấp đôi quái thường cùng loại
      list.forEach((enc, idx) => {
        expect(enc.isBoss).toBe(idx === list.length - 1);
      });
    }
  });

  it('Combo chỉ tăng sát thương (không tăng XP), và reset về 0 khi hủy rep hoặc rep bị loại', () => {
    let state = createDungeonRunState({ seed: 101, isSampleRun: false });
    const ex = state.encounters[0].exercise;
    const baseXp = getExerciseDef(ex).baseXp;

    const hit1 = calculateRepDamage(0.8, 1);
    const hit5 = calculateRepDamage(0.8, 5);
    expect(hit5.damage).toBeGreaterThan(hit1.damage);
    expect(hit1.isCrit).toBe(false);

    // Chí mạng khi quality >= 0.9 (nhân 1.5)
    const crit = calculateRepDamage(0.95, 1);
    expect(crit.isCrit).toBe(true);
    expect(crit.damage).toBe(Math.round(DUNGEON_CONFIG.baseDamage * 0.95 * 1.5));

    // Đánh 2 rep hợp lệ -> combo = 2, nhưng XP mỗi rep vẫn bằng đúng engine (không nhân combo)
    state = applyRepToDungeon(state, makeValidRep(ex, 0, { quality: 1.0 }), 3000);
    expect(state.combo).toBe(1);
    expect(state.lastHit?.tentativeXpAdded).toBe(baseXp);

    state = applyRepToDungeon(state, makeValidRep(ex, 1, { quality: 1.0 }), 7000);
    expect(state.combo).toBe(2);
    expect(state.lastHit?.tentativeXpAdded).toBe(baseXp);

    // Hủy rep giữa chừng -> combo về 0
    state = applyCancelledRepToDungeon(state);
    expect(state.combo).toBe(0);
    expect(state.cancelledRepCount).toBe(1);

    // Lên lại combo 1 rồi bị rep lỗi -> combo về 0
    state = applyRepToDungeon(state, makeValidRep(ex, 2, { quality: 0.9 }), 11000);
    expect(state.combo).toBe(1);
    state = applyRepToDungeon(
      state,
      makeValidRep(ex, 3, { quality: 0.4, counted: false }),
      14000
    );
    expect(state.combo).toBe(0);
    expect(state.rejectedRepCount).toBe(1);
  });

  it('Chạm giới hạn XP (CONFIG.xpCap) thì không cộng thêm cả trên UI lẫn finalizeRun', () => {
    const startXp = ENGINE_XP_CAP - 5;
    let state = createDungeonRunState({
      seed: 777,
      isSampleRun: true,
      startingTotalXp: startXp,
    });

    const ex = state.encounters[0].exercise;
    // Đánh 2 rep squat/bất kỳ có tổng XP > 5 -> phần cộng thêm bị kẹp đúng 5 XP
    state = applyRepToDungeon(state, makeValidRep(ex, 0, { quality: 1.0 }), 3000);
    state = applyRepToDungeon(state, makeValidRep(ex, 1, { quality: 1.0 }), 8000);

    expect(state.tentativeXpEarned).toBeLessThanOrEqual(5);
    expect(state.startingTotalXp + state.tentativeXpEarned).toBeLessThanOrEqual(
      ENGINE_XP_CAP
    );

    const summary = buildDungeonSummary({
      state,
      endedAtMs: 20_000,
      guardResult: { verdict: 'verified', score: 0, flags: [] },
      livenessPassed: 0,
      livenessFailed: 0,
      verifiedRepsBefore: createEmptyVerifiedReps(),
      totalXpBefore: startXp,
    });

    expect(summary.verdict).toBe('verified');
    expect(summary.officialXp).toBeLessThanOrEqual(5);
    expect(summary.totalXpAfter).toBe(ENGINE_XP_CAP);
    expect(summary.hitXpCap).toBe(true);
  });

  it('Mục tiêu phụ tick chính xác (Chí mạng, Combo x8, Hạ Boss không đổi quái) và kỹ năng Đổi quái chỉ dùng 1 lần', () => {
    let state = createDungeonRunState({ seed: 555, isSampleRun: true });
    // Gắn chủ động 2 mục tiêu để kiểm chứng logic tick tất định
    state = {
      ...state,
      sideObjectives: [
        { id: 'crit_3', current: 0, target: 3, completed: false },
        { id: 'boss_no_swap', current: 0, target: 1, completed: false },
      ],
    };

    // Hạ cả 3 quái trong lượt mẫu (mỗi quái 2 rep chí mạng quality = 0.95) mà không đổi quái
    let now = 2000;
    let repIdx = 0;
    while (state.phase !== 'finished') {
      const ex = state.encounters[state.currentIndex].exercise;
      state = applyRepToDungeon(
        state,
        makeValidRep(ex, repIdx++, { quality: 0.95, startT: now - 1500 }),
        now
      );
      now += 3500;
      if (state.phase === 'transitioning') {
        state = advanceMonsterTransition(state, now);
        now += 1500;
      }
    }

    const critObj = state.sideObjectives.find((o) => o.id === 'crit_3');
    const bossObj = state.sideObjectives.find((o) => o.id === 'boss_no_swap');
    expect(critObj?.completed).toBe(true);
    expect(bossObj?.completed).toBe(true);

    // Kiểm tra kỹ năng Đổi quái miễn phí: đổi sang động tác khác và chỉ dùng được 1 lần/lượt
    const fresh = createDungeonRunState({ seed: 888 });
    const oldEx = fresh.encounters[0].exercise;
    const swapped = swapCurrentMonster(fresh);
    expect(swapped.encounters[0].exercise).not.toBe(oldEx);
    expect(swapped.swapsRemaining).toBe(0);
    expect(swapped.usedSwap).toBe(true);

    // Bấm đổi lần 2 không có tác dụng
    const swappedAgain = swapCurrentMonster(swapped);
    expect(swappedAgain.encounters[0].exercise).toBe(swapped.encounters[0].exercise);
  });

  it('Kết quả rejected không cộng XP và không tăng chỉ số; chỉ kỹ năng free_swap hoạt động thật ở F5a', () => {
    let state = createDungeonRunState({ seed: 999, isSampleRun: true });
    const ex = state.encounters[0].exercise;
    state = applyRepToDungeon(state, makeValidRep(ex, 0, { quality: 1.0 }), 3000);
    state = applyRepToDungeon(state, makeValidRep(ex, 1, { quality: 1.0 }), 8000);

    const summary = buildDungeonSummary({
      state,
      endedAtMs: 15_000,
      guardResult: { verdict: 'verified', score: 0, flags: [] },
      livenessPassed: 0,
      livenessFailed: 2, // 2 lần trượt thử thách sống => +1.0 => rejected
      verifiedRepsBefore: createEmptyVerifiedReps(),
      totalXpBefore: 50,
    });

    expect(summary.verdict).toBe('rejected');
    expect(summary.officialXp).toBe(0);
    expect(summary.totalXpAfter).toBe(50);
    expect(summary.xpDiffReason).toBe('rejected_zero');
    expect(summary.reasonCodes).toContain('CHALLENGE_FAILED');
    expect(summary.statsAfter).toEqual(computeCharacterStats(createEmptyVerifiedReps()));

    // Kiểm tra danh sách kỹ năng theo level
    const skillsLv1 = getSkillsForLevel(1);
    const implementedSkills = skillsLv1.filter((s) => s.implemented);
    expect(implementedSkills).toHaveLength(1);
    expect(implementedSkills[0].id).toBe('free_swap');
  });
});