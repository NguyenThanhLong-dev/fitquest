import { create } from 'zustand';

/**
 * Shape of the in-memory game store.
 * More RPG fields (stats, skills, rewards, run history) will be added in later tasks.
 */
interface GameState {
  /** Optional display name entered on the home page. */
  displayName: string;
  /** Updates the player's display name in memory. */
  setDisplayName: (name: string) => void;
  /** Total verified XP earned during this page load (starts at 0). */
  totalXp: number;
}

/**
 * Zustand store — strictly in-memory (NO persist middleware, NO localStorage).
 * Reloading the browser resets all values back to their defaults.
 */
export const useGameStore = create<GameState>((set) => ({
  displayName: '',
  setDisplayName: (name) => set({ displayName: name }),
  totalXp: 0,
}));