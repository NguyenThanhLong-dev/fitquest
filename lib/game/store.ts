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
import type { CosmeticItem, CosmeticItemId } from '@/lib/game/cosmetics';

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
 * Giữ nguyên toàn bộ khóa F1–F5a và bổ sung kho cosmetic + cài đặt âm thanh F5b trong RAM.
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

  /** Kho vật phẩm cosmetic mở được từ rương (chỉ trong RAM, không ảnh hưởng XP/sức mạnh). */
  cosmeticInventory: CosmeticItem[];
  equippedCosmetics: EquippedCosmetics;
  claimCosmetic: (item: CosmeticItem) => void;
  equipCosmetic: (item: CosmeticItem) => void;

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

  soundEnabled: true,
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),

  cosmeticInventory: [],
  equippedCosmetics: createEmptyEquipped(),

  claimCosmetic: (item) =>
    set((state) => {
      const exists = state.cosmeticInventory.some((x) => x.id === item.id);
      const nextInventory = exists
        ? state.cosmeticInventory
        : [...state.cosmeticInventory, item];

      // Tự trang bị nếu ô loại đó đang trống
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