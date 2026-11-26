import { describe, expect, it } from 'vitest';
import type { MonsterEncounter } from '@/lib/game/dungeon';
import {
  getComboMilestone,
  getNewlyUnlockedSkills,
  isOneHitAway,
  rollLootChest,
} from '@/lib/game/cosmetics';

describe('F5b — Rương chiến lợi phẩm cosmetic & trợ giúp trình bày', () => {
  it('Lượt rejected không có rương; review chỉ nhận rương thường (common)', () => {
    for (let s = 1; s <= 40; s++) {
      expect(rollLootChest(s * 73, 'rejected')).toBeNull();

      const reviewRoll = rollLootChest(s * 73, 'review');
      expect(reviewRoll).not.toBeNull();
      expect(reviewRoll?.chestTier).toBe('common_only');
      expect(reviewRoll?.item.rarity).toBe('common');
    }
  });

  it('Lượt verified quay rương tất định theo seed và sinh đủ 4 bậc Rarity', () => {
    const first = rollLootChest(202605, 'verified');
    const second = rollLootChest(202605, 'verified');
    expect(first).toEqual(second);
    expect(first?.chestTier).toBe('standard');

    const rarities = new Set<string>();
    for (let s = 1; s <= 300; s++) {
      const roll = rollLootChest(s * 193, 'verified');
      if (roll) rarities.add(roll.item.rarity);
    }

    expect(rarities.has('common')).toBe(true);
    expect(rarities.has('rare')).toBe(true);
    expect(rarities.has('epic')).toBe(true);
    expect(rarities.has('legendary')).toBe(true);
  });

  it('Nhận diện đúng trạng thái "Đòn cuối!" và mốc combo x5 / x10', () => {
    const monster: MonsterEncounter = {
      stageNumber: 1,
      exercise: 'squat',
      isBoss: false,
      maxHp: 180,
      hp: 24,
      targetReps: 6,
      defeated: false,
    };

    expect(isOneHitAway(monster, 0)).toBe(true);
    expect(isOneHitAway({ ...monster, hp: 120 }, 0)).toBe(false);
    expect(isOneHitAway({ ...monster, hp: 0, defeated: true }, 0)).toBe(false);

    expect(getComboMilestone(4)).toBeNull();
    expect(getComboMilestone(5)).toBe(5);
    expect(getComboMilestone(9)).toBeNull();
    expect(getComboMilestone(10)).toBe(10);
  });

  it('Trả về đúng kỹ năng vừa mở khi lên level', () => {
    expect(getNewlyUnlockedSkills(1, 2)).toHaveLength(0);
    const lv3 = getNewlyUnlockedSkills(2, 3);
    expect(lv3.map((s) => s.id)).toEqual(['second_wind']);
    const jump = getNewlyUnlockedSkills(2, 5);
    expect(jump.map((s) => s.id)).toEqual(['second_wind', 'focus']);
  });
});