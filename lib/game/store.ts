import { create } from 'zustand';
import {
  ALL_EXERCISE_IDS,
  ENGINE_XP_CAP,
  type RunResult,
} from '@/lib/game/engineAdapter';
import {
  createEmptyVerifiedReps,
  type DungeonSummaryData,
  type VerifiedRepCounts,
} from '@/lib/game/dungeon';

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

const createEmptyLivenessStats = (): LivenessRunStats => ({
  seed: null,
  scheduledCount: 0,
  passed: 0,
  failed: 0,
});

/**
 * Trạng thái nhân vật & trò chơi trong bộ nhớ (Zustand — KHÔNG dùng persist / localStorage).
 * Tải lại trang sẽ đặt lại toàn bộ tiến độ về ban đầu.
 */
interface GameState {
  /** Tên hiển thị tùy chọn nhập ở trang chủ. */
  displayName: string;
  setDisplayName: (name: string) => void;

  /** Tổng XP chính thức đã xác thực bởi finalizeRun trong lần tải trang này. */
  totalXp: number;

  /** Tổng số rep đã xác thực theo từng động tác (dùng để tính chỉ số STR/AGI/VIT/WIS). */
  verifiedReps: VerifiedRepCounts;

  /** Số lượt Dungeon Run đã hoàn tất trong lần tải trang này. */
  runsCompleted: number;

  /** Dữ liệu tổng kết lượt gần nhất (lưu tạm trong RAM). */
  lastSummary: DungeonSummaryData | null;

  /** Kết quả thử thách sống của lượt tập hiện tại (dùng cho F4 và F5a). */
  livenessStats: LivenessRunStats;
  startLivenessRun: (seed: number, scheduledCount: number) => void;
  recordChallengeOutcome: (passed: boolean) => void;
  resetLivenessRun: () => void;

  /**
   * Áp dụng kết quả đã được finalizeRun() xác nhận vào hồ sơ nhân vật trong RAM.
   * Nếu verdict !== 'verified' (review / rejected) thì KHÔNG cộng XP và KHÔNG tăng chỉ số.
   */
  commitDungeonRun: (
    engineResult: RunResult,
    countedRepsByExercise: VerifiedRepCounts,
    summary: DungeonSummaryData
  ) => void;
}

export const useGameStore = create<GameState>((set) => ({
  displayName: '',
  setDisplayName: (name) => set({ displayName: name }),
  totalXp: 0,
  verifiedReps: createEmptyVerifiedReps(),
  runsCompleted: 0,
  lastSummary: null,
  livenessStats: createEmptyLivenessStats(),

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

      return {
        totalXp: nextTotalXp,
        verifiedReps: nextVerifiedReps,
        runsCompleted: state.runsCompleted + 1,
        lastSummary: summary,
      };
    }),
}));