/**
 * Logic thuần cho lớp trình bày và phần thưởng cosmetic F5b (KHÔNG phụ thuộc React,
 * KHÔNG chạm vào XP, finalizeRun hay quy tắc chống gian lận).
 */
import {
  createEngineRng,
  type Rarity,
  type Verdict,
} from '@/lib/game/engineAdapter';
import {
  calculateRepDamage,
  getSkillsForLevel,
  type MonsterEncounter,
  type SkillStatus,
} from '@/lib/game/dungeon';

export type CosmeticSlot = 'skin' | 'frame' | 'title';

export type CosmeticItemId =
  | 'skin_hoodie_code'
  | 'frame_terminal'
  | 'title_night_coder'
  | 'skin_iron_dev'
  | 'frame_neon_cyan'
  | 'title_bug_slayer'
  | 'skin_shadow_mage'
  | 'frame_void_purple'
  | 'title_ergonomic_knight'
  | 'skin_dragon_lord'
  | 'frame_solar_gold'
  | 'title_spine_guardian';

export interface CosmeticItem {
  id: CosmeticItemId;
  slot: CosmeticSlot;
  rarity: Rarity;
  /** Biểu tượng nội bộ (emoji), không tải ảnh từ mạng. */
  icon: string;
  /** Lớp màu viền/nền Tailwind khi trang bị cho nhân vật. */
  accentClass: string;
}

/** Danh mục 12 vật phẩm cosmetic (3 loại × 4 độ hiếm Rarity của pose-engine.ts). */
export const COSMETIC_CATALOG: readonly CosmeticItem[] = [
  // Thường (common)
  {
    id: 'skin_hoodie_code',
    slot: 'skin',
    rarity: 'common',
    icon: '🧥',
    accentClass: 'border-slate-500/60 bg-slate-800/80 text-slate-100',
  },
  {
    id: 'frame_terminal',
    slot: 'frame',
    rarity: 'common',
    icon: '💻',
    accentClass: 'ring-2 ring-slate-400/70',
  },
  {
    id: 'title_night_coder',
    slot: 'title',
    rarity: 'common',
    icon: '🌙',
    accentClass: 'border-slate-600 bg-slate-800/80 text-slate-200',
  },
  // Hiếm (rare)
  {
    id: 'skin_iron_dev',
    slot: 'skin',
    rarity: 'rare',
    icon: '🛡️',
    accentClass: 'border-sky-400/60 bg-sky-950/60 text-sky-100',
  },
  {
    id: 'frame_neon_cyan',
    slot: 'frame',
    rarity: 'rare',
    icon: '💠',
    accentClass: 'ring-2 ring-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.4)]',
  },
  {
    id: 'title_bug_slayer',
    slot: 'title',
    rarity: 'rare',
    icon: '⚔️',
    accentClass: 'border-sky-500/50 bg-sky-950/60 text-sky-200',
  },
  // Epic (epic)
  {
    id: 'skin_shadow_mage',
    slot: 'skin',
    rarity: 'epic',
    icon: '🧙',
    accentClass: 'border-fuchsia-400/60 bg-fuchsia-950/50 text-fuchsia-100',
  },
  {
    id: 'frame_void_purple',
    slot: 'frame',
    rarity: 'epic',
    icon: '🔮',
    accentClass:
      'ring-2 ring-fuchsia-400 shadow-[0_0_20px_rgba(232,121,249,0.45)]',
  },
  {
    id: 'title_ergonomic_knight',
    slot: 'title',
    rarity: 'epic',
    icon: '🏆',
    accentClass: 'border-fuchsia-500/50 bg-fuchsia-950/60 text-fuchsia-200',
  },
  // Huyền thoại (legendary)
  {
    id: 'skin_dragon_lord',
    slot: 'skin',
    rarity: 'legendary',
    icon: '🐉',
    accentClass: 'border-amber-400/70 bg-amber-950/50 text-amber-100',
  },
  {
    id: 'frame_solar_gold',
    slot: 'frame',
    rarity: 'legendary',
    icon: '👑',
    accentClass: 'ring-2 ring-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.55)]',
  },
  {
    id: 'title_spine_guardian',
    slot: 'title',
    rarity: 'legendary',
    icon: '✨',
    accentClass: 'border-amber-400/60 bg-amber-950/60 text-amber-200',
  },
] as const;

export const COSMETIC_BY_ID: Record<CosmeticItemId, CosmeticItem> =
  COSMETIC_CATALOG.reduce(
    (acc, item) => {
      acc[item.id] = item;
      return acc;
    },
    {} as Record<CosmeticItemId, CosmeticItem>
  );

export type ChestTier = 'standard' | 'common_only';

export interface LootChestRoll {
  chestTier: ChestTier;
  item: CosmeticItem;
}

/** Cấu hình trình bày F5b (thời gian nghỉ lấy hơi, màn Boss, làm chậm 0,5s, ngưỡng FPS). */
export const FX_CONFIG = {
  /** Thời gian nghỉ lấy hơi giữa các quái (ms — nằm trong 3–5s). */
  breatherDurationMs: 4000,
  /** Thời gian màn chào sân của Boss cuối (ms). */
  bossIntroMs: 1600,
  /** Thời gian làm chậm đặc biệt ở đòn kết liễu Boss (0,5s). */
  bossFinisherMs: 500,
  /** Thời gian hiện màn chúc mừng lên cấp (< 2s). */
  levelUpBannerMs: 1800,
  /** Thời gian hiện câu cổ vũ mốc combo x5 / x10 (ms). */
  comboCheerMs: 2200,
  /** Dưới ngưỡng FPS này sẽ tự động tắt hiệu ứng nặng để không kéo FPS xuống. */
  lowFpsThreshold: 20,
} as const;

/**
 * Mở rương chiến lợi phẩm tất định theo seed sau lượt Dungeon Run:
 * - `rejected`: KHÔNG có rương (trả về null).
 * - `review`: chỉ được rương thường (`rarity === 'common'`).
 * - `verified`: quay đủ 4 độ hiếm (50% common, 30% rare, 15% epic, 5% legendary).
 */
export function rollLootChest(
  seed: number,
  verdict: Verdict
): LootChestRoll | null {
  if (verdict === 'rejected') return null;

  // Lệch bit seed để bảng rương độc lập với chuỗi quái và mục tiêu phụ
  const rng = createEngineRng((seed ^ 0x7f4a7c15) >>> 0);

  let rarity: Rarity = 'common';
  let chestTier: ChestTier = 'common_only';

  if (verdict === 'verified') {
    chestTier = 'standard';
    const roll = rng();
    if (roll < 0.05) {
      rarity = 'legendary';
    } else if (roll < 0.20) {
      rarity = 'epic';
    } else if (roll < 0.50) {
      rarity = 'rare';
    } else {
      rarity = 'common';
    }
  }

  const pool = COSMETIC_CATALOG.filter((item) => item.rarity === rarity);
  const chosen = pool[Math.floor(rng() * pool.length)] ?? COSMETIC_CATALOG[0];

  return {
    chestTier,
    item: chosen,
  };
}

/**
 * Kiểm tra quái hiện tại có đang ở trạng thái "Đòn cuối!" (chỉ còn 1 đòn là hạ gục) hay không.
 * Dùng chất lượng tiêu chuẩn 0.85 và combo kế tiếp để ước lượng 1 đòn kết liễu tự nhiên.
 */
export function isOneHitAway(
  monster: MonsterEncounter | null,
  currentCombo: number
): boolean {
  if (!monster || monster.defeated || monster.hp <= 0) return false;
  const { damage } = calculateRepDamage(0.85, currentCombo + 1);
  return monster.hp <= damage;
}

export type ComboMilestone = 5 | 10;

/** Xác định xem chuỗi combo vừa đạt có chạm mốc cổ vũ x5 hoặc x10 hay không. */
export function getComboMilestone(combo: number): ComboMilestone | null {
  if (combo === 10) return 10;
  if (combo === 5) return 5;
  return null;
}

/** Chọn gợi ý nghỉ lấy hơi (uống nước, chỉnh tư thế...) ổn định theo seed & số phòng. */
export function getBreatherTipIndex(
  stageNumber: number,
  seed: number,
  tipCount: number
): number {
  if (tipCount <= 0) return 0;
  const rng = createEngineRng((seed ^ (stageNumber * 0x45d9f3b)) >>> 0);
  return Math.floor(rng() * tipCount);
}

/** Lấy danh sách các kỹ năng vừa được mở khóa khi tăng từ levelBefore -> levelAfter. */
export function getNewlyUnlockedSkills(
  levelBefore: number,
  levelAfter: number
): SkillStatus[] {
  if (levelAfter <= levelBefore) return [];
  return getSkillsForLevel(levelAfter).filter(
    (skill) =>
      skill.requiredLevel > levelBefore && skill.requiredLevel <= levelAfter
  );
}