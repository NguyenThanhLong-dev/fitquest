import { create } from 'zustand';

/**
 * Thống kê tạm thời của thử thách sống (lớp 3b) trong lượt tập hiện tại.
 * Lưu hoàn toàn trong RAM (không persistence) để bước F5 dùng khi tổng kết Run.
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
 * Trạng thái trò chơi trong bộ nhớ (Zustand — KHÔNG dùng persist / localStorage).
 * Giữ nguyên toàn bộ khóa F1 và bổ sung thống kê thử thách sống cho F4.
 */
interface GameState {
  /** Tên hiển thị tùy chọn nhập ở trang chủ. */
  displayName: string;
  /** Cập nhật tên hiển thị trong RAM. */
  setDisplayName: (name: string) => void;
  /** Tổng XP đã xác thực trong lần tải trang này (bắt đầu từ 0). */
  totalXp: number;
  /** Kết quả thử thách sống của lượt tập hiện tại (dùng cho F4 và tổng kết F5). */
  livenessStats: LivenessRunStats;
  /** Khởi tạo bộ đếm thử thách sống cho một lượt tập thử mới. */
  startLivenessRun: (seed: number, scheduledCount: number) => void;
  /** Ghi nhận 1 lần đạt hoặc 1 lần thất bại thử thách sống. */
  recordChallengeOutcome: (passed: boolean) => void;
  /** Xóa trắng thống kê thử thách sống. */
  resetLivenessRun: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  displayName: '',
  setDisplayName: (name) => set({ displayName: name }),
  totalXp: 0,
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
}));