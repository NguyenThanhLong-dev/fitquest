import { create } from 'zustand';
import {
  ALL_EXERCISE_IDS,
  ENGINE_XP_CAP,
  type Reward,
  type RunResult,
} from '@/lib/game/engineAdapter';
import {
  createEmptyVerifiedReps,
  type DungeonSummaryData,
  type VerifiedRepCounts,
} from '@/lib/game/dungeon';
import type { CosmeticItem, CosmeticItemId } from '@/lib/game/cosmetics';
import {
  LEADERBOARD_CONFIG,
  advanceDemoDayState,
  applyDebugVerifiedXpToWeek,
  applyRunVerdictToWeek,
  computeCurrentRank,
  createInitialWeeklyState,
  resetWeekState,
  simulateWeekendClaim,
  type RankChangeInfo,
  type WeeklyProgressState,
  type WeekendClaimResult,
} from '@/lib/game/leaderboard';

/**
 * Thống kê tạm thời của thử thách sống (lớp 3b) trong lượt tập hiện tại.
 * Lưu hoàn toàn trong RAM (không persistence).
 */
export interface LivenessRunStats {
  seed: number | null;
  scheduledCount: number;
  passed: number;
  failed: number;
}

export interface EquippedCosmetics {
  skin: CosmeticItemId | null;
  frame: CosmeticItemId | null;
  title: CosmeticItemId | null;
}

const createEmptyLivenessStats = (): LivenessRunStats => ({
  seed: null,
  scheduledCount: 0,
  passed: 0,
  failed: 0,
});

const createEmptyEquipped = (): EquippedCosmetics => ({
  skin: null,
  frame: null,
  title: null,
});

/**
 * Trạng thái nhân vật & trò chơi trong bộ nhớ (Zustand — KHÔNG dùng persist / localStorage).
 * Giữ nguyên toàn bộ khóa F1–F5b và bổ sung trạng thái Bảng xếp hạng tuần & thưởng tuần F7.
 */
interface GameState {
  displayName: string;
  setDisplayName: (name: string) => void;

  /** Tổng XP chính thức đã xác thực bởi finalizeRun trong lần tải trang này. */
  totalXp: number;

  /** Tổng số rep đã xác thực theo từng động tác (tính STR/AGI/VIT/WIS). */
  verifiedReps: VerifiedRepCounts;

  /** Số lượt Dungeon Run đã hoàn tất trong lần tải trang này. */
  runsCompleted: number;

  /** Dữ liệu tổng kết lượt gần nhất (lưu tạm trong RAM). */
  lastSummary: DungeonSummaryData | null;

  /** Kết quả thử thách sống của lượt tập hiện tại. */
  livenessStats: LivenessRunStats;
  startLivenessRun: (seed: number, scheduledCount: number) => void;
  recordChallengeOutcome: (passed: boolean) => void;
  resetLivenessRun: () => void;

  /** Cài đặt âm thanh Web Audio API (chỉ trong RAM). */
  soundEnabled: boolean;
  toggleSound: () => void;

  /** Kho vật phẩm cosmetic từ rương Dungeon Run F5b (chỉ trong RAM). */
  cosmeticInventory: CosmeticItem[];
  equippedCosmetics: EquippedCosmetics;
  claimCosmetic: (item: CosmeticItem) => void;
  equipCosmetic: (item: CosmeticItem) => void;

  // ── F7: Bảng xếp hạng minh họa & Thưởng tuần (chỉ trong RAM) ──
  /** Tổng XP verified tích lũy trong tuần mô phỏng hiện tại. */
  weeklyVerifiedXp: number;
  /** Ngày demo hiện tại (bắt đầu từ 1, tăng khi bấm "Sang ngày mới (demo)"). */
  currentDemoDay: number;
  /** Tập các "ngày demo" đã có ít nhất 1 phiên verified. */
  weeklyActiveDays: Set<number>;
  /** Seed cố định sinh 20 người chơi giả (mặc định 2026, đổi được ở Debug). */
  leaderboardSeed: number;
  /** Đánh dấu tuần này đã nhận thưởng cuối tuần hay chưa (khóa nút đến khi Đặt lại tuần). */
  weeklyRewardClaimed: boolean;
  /** Phần thưởng tuần vừa nhận gần nhất (kiểu Reward gốc từ pose-engine.ts). */
  lastWeeklyReward: Reward | null;
  /** Danh sách phần thưởng tuần cosmetic đã mở (kiểu Reward gốc từ pose-engine.ts, không tạo kiểu mới). */
  weeklyRewards: Reward[];
  /** ID phần thưởng tuần đang đeo làm huy hiệu/danh hiệu trên nhân vật. */
  equippedWeeklyRewardId: string | null;
  /** Thông tin đổi hạng gần nhất để hiển thị hiệu ứng ngắn trên /leaderboard. */
  lastRankChange: RankChangeInfo | null;

  advanceDemoDay: () => void;
  resetWeek: () => void;
  setLeaderboardSeed: (seed: number) => void;
  debugAddVerifiedWeeklyXp: (amount?: number) => void;
  simulateWeekendReward: () => WeekendClaimResult;
  equipWeeklyReward: (rewardId: string) => void;

  /**
   * Áp dụng kết quả đã được finalizeRun() xác nhận vào hồ sơ nhân vật & bảng xếp hạng tuần trong RAM.
   * Phiên review / rejected KHÔNG cộng XP, KHÔNG tăng chỉ số và KHÔNG cộng điểm tuần.
   */
  commitDungeonRun: (
    engineResult: RunResult,
    countedRepsByExercise: VerifiedRepCounts,
    summary: DungeonSummaryData
  ) => void;
}

function toWeeklyState(state: GameState): WeeklyProgressState {
  return {
    verifiedXp: state.weeklyVerifiedXp,
    currentDemoDay: state.currentDemoDay,
    activeDays: state.weeklyActiveDays,
    rewardClaimed: state.weeklyRewardClaimed,
    lastReward: state.lastWeeklyReward,
  };
}

export const useGameStore = create<GameState>((set, get) => ({
  displayName: '',
  setDisplayName: (name) => set({ displayName: name }),
  totalXp: 0,
  verifiedReps: createEmptyVerifiedReps(),
  runsCompleted: 0,
  lastSummary: null,
  livenessStats: createEmptyLivenessStats(),

  soundEnabled: true,
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),

  cosmeticInventory: [],
  equippedCosmetics: createEmptyEquipped(),

  // Khởi tạo trạng thái F7
  weeklyVerifiedXp: 0,
  currentDemoDay: 1,
  weeklyActiveDays: new Set<number>(),
  leaderboardSeed: LEADERBOARD_CONFIG.defaultSeed,
  weeklyRewardClaimed: false,
  lastWeeklyReward: null,
  weeklyRewards: [],
  equippedWeeklyRewardId: null,
  lastRankChange: null,

  claimCosmetic: (item) =>
    set((state) => {
      const exists = state.cosmeticInventory.some((x) => x.id === item.id);
      const nextInventory = exists
        ? state.cosmeticInventory
        : [...state.cosmeticInventory, item];

      const nextEquipped: EquippedCosmetics = {
        ...state.equippedCosmetics,
        [item.slot]: state.equippedCosmetics[item.slot] ?? item.id,
      };

      return {
        cosmeticInventory: nextInventory,
        equippedCosmetics: nextEquipped,
      };
    }),

  equipCosmetic: (item) =>
    set((state) => ({
      equippedCosmetics: {
        ...state.equippedCosmetics,
        [item.slot]:
          state.equippedCosmetics[item.slot] === item.id ? null : item.id,
      },
    })),

  startLivenessRun: (seed, scheduledCount) =>
    set({
      livenessStats: {
        seed,
        scheduledCount,
        passed: 0,
        failed: 0,
      },
    }),

  recordChallengeOutcome: (passed) =>
    set((state) => ({
      livenessStats: {
        ...state.livenessStats,
        passed: state.livenessStats.passed + (passed ? 1 : 0),
        failed: state.livenessStats.failed + (passed ? 0 : 1),
      },
    })),

  resetLivenessRun: () =>
    set({
      livenessStats: createEmptyLivenessStats(),
    }),

  advanceDemoDay: () =>
    set((state) => {
      const next = advanceDemoDayState(toWeeklyState(state));
      return {
        currentDemoDay: next.currentDemoDay,
      };
    }),

  resetWeek: () =>
    set(() => {
      const fresh = resetWeekState();
      return {
        weeklyVerifiedXp: fresh.verifiedXp,
        currentDemoDay: fresh.currentDemoDay,
        weeklyActiveDays: fresh.activeDays,
        weeklyRewardClaimed: fresh.rewardClaimed,
        lastWeeklyReward: fresh.lastReward,
        lastRankChange: null,
      };
    }),

  setLeaderboardSeed: (seed) =>
    set((state) => {
      const safeSeed = seed >>> 0;
      const oldRank = computeCurrentRank(
        state.weeklyVerifiedXp,
        state.weeklyActiveDays,
        state.leaderboardSeed
      );
      const newRank = computeCurrentRank(
        state.weeklyVerifiedXp,
        state.weeklyActiveDays,
        safeSeed
      );

      let nextRankChange = state.lastRankChange;
      if (newRank !== null && newRank !== oldRank) {
        const delta = oldRank !== null ? oldRank - newRank : 0;
        nextRankChange = {
          previousRank: oldRank,
          newRank,
          delta,
          seq: (state.lastRankChange?.seq ?? 0) + 1,
        };
      }

      return {
        leaderboardSeed: safeSeed,
        lastRankChange: nextRankChange,
      };
    }),

  debugAddVerifiedWeeklyXp: (amount = LEADERBOARD_CONFIG.debugQuickXp) =>
    set((state) => {
      const oldRank = computeCurrentRank(
        state.weeklyVerifiedXp,
        state.weeklyActiveDays,
        state.leaderboardSeed
      );
      const nextWeek = applyDebugVerifiedXpToWeek(toWeeklyState(state), amount);
      const newRank = computeCurrentRank(
        nextWeek.verifiedXp,
        nextWeek.activeDays,
        state.leaderboardSeed
      );

      let nextRankChange = state.lastRankChange;
      if (newRank !== null && newRank !== oldRank) {
        const delta = oldRank !== null ? oldRank - newRank : 0;
        nextRankChange = {
          previousRank: oldRank,
          newRank,
          delta,
          seq: (state.lastRankChange?.seq ?? 0) + 1,
        };
      }

      return {
        weeklyVerifiedXp: nextWeek.verifiedXp,
        weeklyActiveDays: nextWeek.activeDays,
        lastRankChange: nextRankChange,
      };
    }),

  simulateWeekendReward: () => {
    const state = get();
    const result = simulateWeekendClaim(
      toWeeklyState(state),
      state.leaderboardSeed
    );

    if (result.status === 'claimed' && result.reward) {
      const earnedReward = result.reward;
      set((prev) => {
        const alreadyHas = prev.weeklyRewards.some((r) => r.id === earnedReward.id);
        const nextWeeklyRewards = alreadyHas
          ? prev.weeklyRewards
          : [...prev.weeklyRewards, earnedReward];

        return {
          weeklyRewardClaimed: true,
          lastWeeklyReward: earnedReward,
          weeklyRewards: nextWeeklyRewards,
          equippedWeeklyRewardId:
            prev.equippedWeeklyRewardId ?? earnedReward.id,
        };
      });
    }

    return result;
  },

  equipWeeklyReward: (rewardId) =>
    set((state) => ({
      equippedWeeklyRewardId:
        state.equippedWeeklyRewardId === rewardId ? null : rewardId,
    })),

  commitDungeonRun: (engineResult, countedRepsByExercise, summary) =>
    set((state) => {
      if (engineResult.verdict !== 'verified') {
        return {
          runsCompleted: state.runsCompleted + 1,
          lastSummary: summary,
        };
      }

      const nextTotalXp = Math.min(ENGINE_XP_CAP, state.totalXp + engineResult.xp);
      const nextVerifiedReps: VerifiedRepCounts = { ...state.verifiedReps };
      for (const ex of ALL_EXERCISE_IDS) {
        nextVerifiedReps[ex] += countedRepsByExercise[ex];
      }

      // Cập nhật điểm tuần & ngày hoạt động cho Bảng xếp hạng F7 (chỉ phiên verified)
      const oldRank = computeCurrentRank(
        state.weeklyVerifiedXp,
        state.weeklyActiveDays,
        state.leaderboardSeed
      );
      const nextWeek = applyRunVerdictToWeek(
        toWeeklyState(state),
        engineResult.verdict,
        engineResult.xp,
        summary.countedReps
      );
      const newRank = computeCurrentRank(
        nextWeek.verifiedXp,
        nextWeek.activeDays,
        state.leaderboardSeed
      );

      let nextRankChange = state.lastRankChange;
      if (newRank !== null && newRank !== oldRank) {
        const delta = oldRank !== null ? oldRank - newRank : 0;
        nextRankChange = {
          previousRank: oldRank,
          newRank,
          delta,
          seq: (state.lastRankChange?.seq ?? 0) + 1,
        };
      }

      return {
        totalXp: nextTotalXp,
        verifiedReps: nextVerifiedReps,
        runsCompleted: state.runsCompleted + 1,
        lastSummary: summary,
        weeklyVerifiedXp: nextWeek.verifiedXp,
        weeklyActiveDays: nextWeek.activeDays,
        lastRankChange: nextRankChange,
      };
    }),
}));

export { createInitialWeeklyState };