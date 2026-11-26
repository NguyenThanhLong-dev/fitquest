/**
 * File nối DUY NHẤT giữa tầng game (lib/game/) và lõi pose-engine.ts.
 * Giữ nguyên toàn bộ logic F5a và re-export thêm kiểu `Rarity` của engine cho phần thưởng cosmetic F5b.
 */
import {
  CONFIG,
  EXERCISES,
  SessionGuard,
  finalizeRun,
  levelFromXp,
  makeRng,
  newSeed,
  xpForLevel,
  type ExerciseDef,
  type ExerciseId,
  type Rarity,
  type RepResult,
  type RepSummary,
  type RunInput,
  type RunResult,
  type Verdict,
} from '@/lib/pose-engine';

export type {
  ExerciseDef,
  ExerciseId,
  Rarity,
  RepResult,
  RepSummary,
  RunInput,
  RunResult,
  Verdict,
};

export { SessionGuard };

/** Danh sách 5 ExerciseId chuẩn của engine (không đổi ID). */
export const ALL_EXERCISE_IDS: readonly ExerciseId[] = [
  'squat',
  'overhead_reach',
  'side_bend',
  'neck_tilt',
  'high_knees',
] as const;

/** Giới hạn XP tối đa mỗi lần tải trang, đọc trực tiếp từ CONFIG.xpCap của engine. */
export const ENGINE_XP_CAP: number = CONFIG.xpCap;

/** Lấy định nghĩa động tác (baseXp, holdMs, minRepMs...) từ EXERCISES của engine. */
export function getExerciseDef(id: ExerciseId): ExerciseDef {
  return EXERCISES[id];
}

/** Tạo seed 32-bit ngẫu nhiên bằng newSeed() của engine. */
export function createEngineSeed(): number {
  return newSeed();
}

/** Tạo bộ sinh số giả ngẫu nhiên tất định theo seed bằng makeRng() của engine. */
export function createEngineRng(seed: number): () => number {
  return makeRng(seed);
}

/** Tính cấp độ hiện tại từ tổng XP bằng đúng levelFromXp() của engine. */
export function getLevelFromXp(xp: number): number {
  return levelFromXp(xp);
}

/** Tính mốc XP tích lũy để đạt một cấp độ bằng đúng xpForLevel() của engine. */
export function getXpForLevel(level: number): number {
  return xpForLevel(level);
}

/**
 * Thông tin thanh tiến độ XP đến cấp tiếp theo (dùng 100% levelFromXp / xpForLevel / CONFIG.xpCap).
 */
export interface XpProgressInfo {
  xp: number;
  cap: number;
  remainingToCap: number;
  atCap: boolean;
  level: number;
  currentLevelStartXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpNeededForLevel: number;
  progressRatio: number;
}

export function getXpProgressInfo(totalXp: number): XpProgressInfo {
  const safeXp = Math.max(0, totalXp);
  const level = levelFromXp(safeXp);
  const currentLevelStartXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const xpNeededForLevel = Math.max(1, nextLevelXp - currentLevelStartXp);
  const xpIntoLevel = Math.max(0, safeXp - currentLevelStartXp);
  const progressRatio = Math.min(1, Math.max(0, xpIntoLevel / xpNeededForLevel));
  const remainingToCap = Math.max(0, CONFIG.xpCap - safeXp);

  return {
    xp: safeXp,
    cap: CONFIG.xpCap,
    remainingToCap,
    atCap: safeXp >= CONFIG.xpCap,
    level,
    currentLevelStartXp,
    nextLevelXp,
    xpIntoLevel,
    xpNeededForLevel,
    progressRatio,
  };
}

/**
 * Chuyển RepResult thành RepSummary theo đúng hợp đồng §4 của AGENT_SPEC
 * (lược bỏ startT, endT, counted, flags trước khi gửi vào finalizeRun).
 */
export function toRepSummary(rep: RepResult): RepSummary {
  return {
    exercise: rep.exercise,
    durationMs: rep.durationMs,
    maxProgress: rep.maxProgress,
    holdMs: rep.holdMs,
    peakVelocity: rep.peakVelocity,
    reversals: rep.reversals,
    quality: rep.quality,
    trajectory: [...rep.trajectory],
    xp: rep.xp,
  };
}

export interface CombinedGuardEvaluation {
  verdict: Verdict;
  score: number;
  flags: string[];
}

/**
 * Gộp verdict từ SessionGuard (ảnh tĩnh, FPS thấp, rep nhiễu, lặp quỹ đạo)
 * với số lần thất bại thử thách sống của lớp F4 theo đúng trọng số (+0.5 / lần)
 * của SessionGuard.verdict() trong pose-engine.ts.
 */
export function combineGuardVerdict(
  guardResult: { verdict: Verdict; score: number; flags: string[] },
  livenessFailedCount: number
): CombinedGuardEvaluation {
  let score = guardResult.score;
  const flags = [...guardResult.flags];

  if (livenessFailedCount > 0 && !flags.includes('CHALLENGE_FAILED')) {
    score += 0.5 * livenessFailedCount;
    flags.push('CHALLENGE_FAILED');
  }

  const verdict: Verdict =
    score >= 0.7 ? 'rejected' : score >= 0.3 ? 'review' : 'verified';

  return { verdict, score, flags };
}

/**
 * Gọi finalizeRun của pose-engine.ts một lần khi kết thúc lượt.
 * Chỉ truyền vào các rep hợp lệ (counted === true) đã chuyển sang RepSummary.
 */
export function finalizeDungeonRun(
  countedReps: readonly RepResult[],
  durationMs: number,
  guardVerdict: Verdict,
  xpAlreadyEarned: number
): RunResult {
  const input: RunInput = {
    reps: countedReps.map(toRepSummary),
    durationMs: Math.max(0, durationMs),
    guardVerdict,
  };
  return finalizeRun(input, Math.max(0, xpAlreadyEarned));
}