/**
 * File nối DUY NHẤT giữa tầng game (lib/game/) và lõi pose-engine.ts.
 * Giữ nguyên toàn bộ API F5a/F5b/F7 và bổ sung kiểu PostureMode + danh sách động tác theo chế độ cho F8.
 */
import {
  CONFIG,
  EXERCISES,
  SessionGuard,
  finalizeRun,
  levelFromXp,
  makeMockPlayers,
  makeRng,
  newSeed,
  rankOf,
  rewardForRank,
  weeklyScore,
  xpForLevel,
  type ExerciseDef,
  type ExerciseId,
  type MockPlayer,
  type Rarity,
  type RepResult,
  type RepSummary,
  type Reward,
  type RunInput,
  type RunResult,
  type Verdict,
} from '@/lib/pose-engine';

export type {
  ExerciseDef,
  ExerciseId,
  MockPlayer,
  Rarity,
  RepResult,
  RepSummary,
  Reward,
  RunInput,
  RunResult,
  Verdict,
};

export { SessionGuard };

/** Chế độ tư thế tập: mặc định 'standing' (Đứng), hỗ trợ 'seated' (Ngồi tại bàn học). */
export type PostureMode = 'standing' | 'seated';

/** Danh sách 5 ExerciseId chuẩn của engine (không đổi ID). */
export const ALL_EXERCISE_IDS: readonly ExerciseId[] = [
  'squat',
  'overhead_reach',
  'side_bend',
  'neck_tilt',
  'high_knees',
] as const;

/** Danh sách 3 động tác hợp lệ cho chế độ Ngồi (ẩn squat và nâng gối). */
export const SEATED_EXERCISE_IDS: readonly ExerciseId[] = [
  'overhead_reach',
  'side_bend',
  'neck_tilt',
] as const;

/** Trả về danh sách động tác hợp lệ theo chế độ Đứng hoặc Ngồi. */
export function getAllowedExercises(mode: PostureMode): readonly ExerciseId[] {
  return mode === 'seated' ? SEATED_EXERCISE_IDS : ALL_EXERCISE_IDS;
}

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

/** Sinh danh sách người chơi giả (mặc định 20) bằng đúng makeMockPlayers() của engine. */
export function getMockPlayers(seed?: number, n?: number): MockPlayer[] {
  return makeMockPlayers(seed, n);
}

/** Tính điểm tuần bằng đúng weeklyScore(verifiedXp, activeDays) của engine. */
export function getWeeklyScore(verifiedXp: number, activeDays: number): number {
  return weeklyScore(verifiedXp, activeDays);
}

/** Tính hạng 1-based của người chơi bằng đúng rankOf(score, others) của engine. */
export function getRankOf(score: number, others: number[]): number {
  return rankOf(score, others);
}

/** Lấy phần thưởng tuần theo hạng bằng đúng rewardForRank(rank, total) của engine. */
export function getRewardForRank(rank: number, total: number): Reward {
  return rewardForRank(rank, total);
}

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