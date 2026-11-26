/**
 * Logic thuần TypeScript cho Bảng xếp hạng minh họa & Thưởng tuần (Task F7).
 * KHÔNG phụ thuộc React/DOM; mọi phép tính lõi đều gọi qua lib/game/engineAdapter.ts.
 */
import {
  getMockPlayers,
  getRankOf,
  getRewardForRank,
  getWeeklyScore,
  type MockPlayer,
  type Reward,
  type Verdict,
} from '@/lib/game/engineAdapter';

/** Cấu hình hằng số cho bảng xếp hạng minh họa F7. */
export const LEADERBOARD_CONFIG = {
  /** Seed cố định để mỗi lần mở trang vẫn giữ cùng một bảng người chơi giả. */
  defaultSeed: 2026,
  /** Số người chơi giả hiển thị cùng người chơi thật. */
  demoPlayerCount: 20,
  /** Số ngày hoạt động tối đa được tính thưởng đều đặn (khớp weeklyScore trong pose-engine.ts). */
  maxActiveDays: 5,
  /** Lượng XP verified cộng nhanh ở chế độ debug để kiểm thử hạng. */
  debugQuickXp: 300,
} as const;

/** Trạng thái tiến độ tuần của người chơi (lưu hoàn toàn trong RAM). */
export interface WeeklyProgressState {
  verifiedXp: number;
  currentDemoDay: number;
  activeDays: Set<number>;
  rewardClaimed: boolean;
  lastReward: Reward | null;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  rank: number;
  isPlayer: boolean;
  isDemo: boolean;
}

export interface NextTargetAbove {
  name: string;
  score: number;
  /** Số điểm cần thêm để bắt kịp/vượt lên hạng của người đứng ngay trên. */
  pointsNeeded: number;
}

export interface LeaderboardSnapshot {
  seed: number;
  hasScored: boolean;
  playerScore: number;
  playerRank: number | null;
  totalParticipants: number;
  effectiveActiveDays: number;
  totalRecordedDays: number;
  nextAbove: NextTargetAbove | null;
  /** Danh sách dòng đã sắp xếp giảm dần theo điểm (nếu chưa có điểm, chỉ hiện 20 người giả). */
  rows: LeaderboardEntry[];
}

export interface RankChangeInfo {
  /** Hạng cũ trước khi đổi điểm (null nếu lần đầu lên bảng xếp hạng). */
  previousRank: number | null;
  newRank: number;
  /** > 0: tăng hạng; < 0: hạ hạng nhẹ; 0: giữ nguyên. */
  delta: number;
  seq: number;
}

export type WeekendClaimStatus = 'claimed' | 'already_claimed' | 'no_score';

export interface WeekendClaimResult {
  status: WeekendClaimStatus;
  nextWeek: WeeklyProgressState;
  reward: Reward | null;
  rank: number | null;
  totalParticipants: number;
}

/** Khởi tạo trạng thái tuần mới (ngày demo 1, 0 XP, chưa nhận thưởng). */
export function createInitialWeeklyState(): WeeklyProgressState {
  return {
    verifiedXp: 0,
    currentDemoDay: 1,
    activeDays: new Set<number>(),
    rewardClaimed: false,
    lastReward: null,
  };
}

/**
 * Tính điểm tuần của người chơi bằng đúng weeklyScore(verifiedXp, activeDays) của engine.
 * Khi chưa có phiên verified nào (verifiedXp <= 0) -> trả về 0 điểm.
 */
export function computePlayerWeeklyScore(
  verifiedXp: number,
  activeDays: ReadonlySet<number> | number
): number {
  const safeXp = Math.max(0, verifiedXp);
  const rawDays = typeof activeDays === 'number' ? activeDays : activeDays.size;
  const safeDays = Math.max(0, rawDays);

  if (safeXp <= 0 || safeDays <= 0) {
    return 0;
  }
  return getWeeklyScore(safeXp, safeDays);
}

/**
 * Ghi nhận kết quả một phiên Dungeon Run vào tiến độ tuần:
 * - Chỉ phiên `verified` mới cộng vào `verifiedXp` và đánh dấu `currentDemoDay` đã hoạt động.
 * - Phiên `review` hoặc `rejected` KHÔNG cộng bất kỳ điểm hay ngày hoạt động nào.
 */
export function applyRunVerdictToWeek(
  week: WeeklyProgressState,
  verdict: Verdict,
  officialXp: number,
  countedReps = 0
): WeeklyProgressState {
  if (verdict !== 'verified') {
    return week;
  }

  const gainXp = Math.max(0, officialXp);
  const didVerifiedWork = gainXp > 0 || countedReps > 0;
  if (!didVerifiedWork) {
    return week;
  }

  const nextActiveDays = new Set<number>(week.activeDays);
  nextActiveDays.add(week.currentDemoDay);

  return {
    ...week,
    verifiedXp: week.verifiedXp + gainXp,
    activeDays: nextActiveDays,
  };
}

/**
 * Cộng nhanh XP verified ở chế độ Debug để kiểm thử lên hạng và nhận thưởng tuần.
 */
export function applyDebugVerifiedXpToWeek(
  week: WeeklyProgressState,
  amount: number = LEADERBOARD_CONFIG.debugQuickXp
): WeeklyProgressState {
  const safeAmount = Math.max(0, amount);
  if (safeAmount <= 0) return week;

  const nextActiveDays = new Set<number>(week.activeDays);
  nextActiveDays.add(week.currentDemoDay);

  return {
    ...week,
    verifiedXp: week.verifiedXp + safeAmount,
    activeDays: nextActiveDays,
  };
}

/** Nút "Sang ngày mới (demo)": tăng ngày demo lên 1 để mô phỏng nhiều ngày tập. */
export function advanceDemoDayState(
  week: WeeklyProgressState
): WeeklyProgressState {
  return {
    ...week,
    currentDemoDay: week.currentDemoDay + 1,
  };
}

/** Nút "Đặt lại tuần": xóa tiến độ tuần hiện tại và mở khóa lại nút nhận thưởng tuần. */
export function resetWeekState(): WeeklyProgressState {
  return createInitialWeeklyState();
}

/**
 * Xây dựng dữ liệu bảng xếp hạng hoàn chỉnh (tất định theo `seed`):
 * - 20 người chơi giả từ `makeMockPlayers(seed, 20)`.
 * - Nếu người chơi đã có điểm (> 0): ghép vào bảng, tính hạng bằng `rankOf` và khoảng cách tới người ngay trên.
 * - Nếu người chơi chưa có điểm: chỉ hiển thị 20 người chơi giả (không xếp người chơi ở cuối bảng gây nản).
 */
export function buildLeaderboardSnapshot(options: {
  seed: number;
  playerName: string;
  verifiedXp: number;
  activeDays: ReadonlySet<number>;
}): LeaderboardSnapshot {
  const safeSeed = options.seed >>> 0;
  const mockPlayers: MockPlayer[] = getMockPlayers(
    safeSeed,
    LEADERBOARD_CONFIG.demoPlayerCount
  );
  const mockScores = mockPlayers.map((p) => p.score);
  const totalParticipants = mockPlayers.length + 1;

  const totalRecordedDays = options.activeDays.size;
  const effectiveActiveDays = Math.min(
    totalRecordedDays,
    LEADERBOARD_CONFIG.maxActiveDays
  );
  const playerScore = computePlayerWeeklyScore(
    options.verifiedXp,
    options.activeDays
  );
  const hasScored = playerScore > 0;

  // Xây danh sách đầu vào cho sắp xếp
  const rawEntries: Array<{
    id: string;
    name: string;
    score: number;
    isPlayer: boolean;
    isDemo: boolean;
  }> = mockPlayers.map((p, idx) => ({
    id: `demo-${safeSeed}-${idx}-${p.name}`,
    name: p.name,
    score: p.score,
    isPlayer: false,
    isDemo: true,
  }));

  let playerRank: number | null = null;
  let nextAbove: NextTargetAbove | null = null;

  if (hasScored) {
    playerRank = getRankOf(playerScore, mockScores);
    rawEntries.push({
      id: 'current-player',
      name: options.playerName,
      score: playerScore,
      isPlayer: true,
      isDemo: false,
    });

    // Tìm người chơi giả có điểm thấp nhất nhưng lớn hơn hẳn điểm người chơi hiện tại
    let closestAbove: MockPlayer | null = null;
    for (const mp of mockPlayers) {
      if (mp.score > playerScore) {
        if (
          closestAbove === null ||
          mp.score < closestAbove.score ||
          (mp.score === closestAbove.score && mp.name.localeCompare(closestAbove.name) < 0)
        ) {
          closestAbove = mp;
        }
      }
    }

    if (closestAbove) {
      nextAbove = {
        name: closestAbove.name,
        score: closestAbove.score,
        pointsNeeded: closestAbove.score - playerScore,
      };
    }
  }

  // Sắp xếp giảm dần theo điểm; nếu đồng điểm ưu tiên hiện người chơi trước, rồi theo tên
  rawEntries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Gán hạng nhất quán với quy tắc rankOf (đồng điểm dùng chung hạng cao hơn)
  const allScores = rawEntries.map((e) => e.score);
  const rows: LeaderboardEntry[] = rawEntries.map((entry, idx) => {
    const others = allScores.filter((_, i) => i !== idx);
    const rank = entry.isPlayer && playerRank !== null
      ? playerRank
      : getRankOf(entry.score, others);
    return {
      ...entry,
      rank,
    };
  });

  return {
    seed: safeSeed,
    hasScored,
    playerScore,
    playerRank,
    totalParticipants,
    effectiveActiveDays,
    totalRecordedDays,
    nextAbove,
    rows,
  };
}

/**
 * Nút "Mô phỏng cuối tuần":
 * - Mỗi tuần chỉ được nhận thưởng đúng 1 lần (cho đến khi bấm "Đặt lại tuần").
 * - Phải có điểm tuần > 0 mới được phát thưởng.
 * - Gọi đúng `rankOf` và `rewardForRank(rank, total)` của engine, trả về kiểu `Reward` gốc.
 */
export function simulateWeekendClaim(
  week: WeeklyProgressState,
  seed: number
): WeekendClaimResult {
  const safeSeed = seed >>> 0;
  const mockPlayers = getMockPlayers(
    safeSeed,
    LEADERBOARD_CONFIG.demoPlayerCount
  );
  const totalParticipants = mockPlayers.length + 1;

  if (week.rewardClaimed) {
    return {
      status: 'already_claimed',
      nextWeek: week,
      reward: null,
      rank: null,
      totalParticipants,
    };
  }

  const score = computePlayerWeeklyScore(week.verifiedXp, week.activeDays);
  if (score <= 0) {
    return {
      status: 'no_score',
      nextWeek: week,
      reward: null,
      rank: null,
      totalParticipants,
    };
  }

  const rank = getRankOf(
    score,
    mockPlayers.map((p) => p.score)
  );
  const reward = getRewardForRank(rank, totalParticipants);

  return {
    status: 'claimed',
    nextWeek: {
      ...week,
      rewardClaimed: true,
      lastReward: reward,
    },
    reward,
    rank,
    totalParticipants,
  };
}

/** Tính hạng hiện tại của người chơi theo seed (hoặc null nếu chưa có điểm). */
export function computeCurrentRank(
  verifiedXp: number,
  activeDays: ReadonlySet<number>,
  seed: number
): number | null {
  const score = computePlayerWeeklyScore(verifiedXp, activeDays);
  if (score <= 0) return null;
  const mockScores = getMockPlayers(
    seed >>> 0,
    LEADERBOARD_CONFIG.demoPlayerCount
  ).map((p) => p.score);
  return getRankOf(score, mockScores);
}