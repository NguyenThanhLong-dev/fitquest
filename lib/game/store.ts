import { create } from 'zustand';
import {
  ALL_EXERCISE_IDS,
  ENGINE_XP_CAP,
  type PostureMode,
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
 * Bổ sung cho F8: `postureMode` (mặc định 'standing') và `hasSeenGuide` (chỉ trong RAM).
 */
interface GameState {
  displayName: string;
  setDisplayName: (name: string) => void;

  /** Chế độ tư thế: 'standing' (Đứng - mặc định) hoặc 'seated' (Ngồi tại bàn). */
  postureMode: PostureMode;
  setPostureMode: (mode: PostureMode) => void;

  /** Đã xem màn hướng dẫn trong lần tải trang này chưa (hiện tự động lần đầu vào /play). */
  hasSeenGuide: boolean;
  markGuideSeen: () => void;

  totalXp: number;
  verifiedReps: VerifiedRepCounts;
  runsCompleted: number;
  lastSummary: DungeonSummaryData | null;

  livenessStats: LivenessRunStats;
  startLivenessRun: (seed: number, scheduledCount: number) => void;
  recordChallengeOutcome: (passed: boolean) => void;
  resetLivenessRun: () => void;

  soundEnabled: boolean;
  toggleSound: () => void;

  cosmeticInventory: CosmeticItem[];
  equippedCosmetics: EquippedCosmetics;
  claimCosmetic: (item: CosmeticItem) => void;
  equipCosmetic: (item: CosmeticItem) => void;

  weeklyVerifiedXp: number;
  currentDemoDay: number;
  weeklyActiveDays: Set<number>;
  leaderboardSeed: number;
  weeklyRewardClaimed: boolean;
  lastWeeklyReward: Reward | null;
  weeklyRewards: Reward[];
  equippedWeeklyRewardId: string | null;
  lastRankChange: RankChangeInfo | null;

  advanceDemoDay: () => void;
  resetWeek: () => void;
  setLeaderboardSeed: (seed: number) => void;
  debugAddVerifiedWeeklyXp: (amount?: number) => void;
  simulateWeekendReward: () => WeekendClaimResult;
  equipWeeklyReward: (rewardId: string) => void;

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

  postureMode: 'standing',
  setPostureMode: (mode) => set({ postureMode: mode }),

  hasSeenGuide: false,
  markGuideSeen: () => set({ hasSeenGuide: true }),

  totalXp: 0,
  verifiedReps: createEmptyVerifiedReps(),
  runsCompleted: 0,
  lastSummary: null,
  livenessStats: createEmptyLivenessStats(),

  soundEnabled: true,
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),

  cosmeticInventory: [],
  equippedCosmetics: createEmptyEquipped(),

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