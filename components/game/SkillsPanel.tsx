'use client';

import type { Rarity } from '@/lib/game/engineAdapter';
import {
  computeCharacterStats,
  getSkillsForLevel,
  type VerifiedRepCounts,
} from '@/lib/game/dungeon';
import { COSMETIC_BY_ID } from '@/lib/game/cosmetics';
import { useGameStore } from '@/lib/game/store';
import { i18n } from '@/lib/i18n';

export interface SkillsPanelProps {
  level: number;
  verifiedReps: VerifiedRepCounts;
}

const RARITY_BADGE_STYLES: Record<Rarity, string> = {
  common: 'bg-slate-800 text-slate-200 border-slate-600/60',
  rare: 'bg-sky-500/20 text-sky-200 border-sky-400/50',
  epic: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/50',
  legendary: 'bg-amber-500/20 text-amber-200 border-amber-400/60',
};

const WEEKLY_REWARD_ICONS: Record<Rarity, string> = {
  common: '🎖️',
  rare: '🛡️',
  epic: '⚔️',
  legendary: '👑',
};

/**
 * Bảng nhân vật trong RAM:
 * 1. Hồ sơ hiệp sĩ đang trang bị skin / khung avatar / danh hiệu cosmetic + huy hiệu thưởng tuần.
 * 2. 4 chỉ số STR / AGI / VIT / WIS tính từ verifiedReps.
 * 3. Kho trang bị Cosmetic: gộp vật phẩm rương Dungeon Run (F5b) và phần thưởng tuần Reward (F7).
 * 4. Danh sách kỹ năng theo level (phân biệt rõ "Hoạt động thật" vs "Sắp có").
 */
export function SkillsPanel({ level, verifiedReps }: SkillsPanelProps) {
  const displayName = useGameStore((state) => state.displayName);
  const cosmeticInventory = useGameStore((state) => state.cosmeticInventory);
  const equippedCosmetics = useGameStore((state) => state.equippedCosmetics);
  const equipCosmetic = useGameStore((state) => state.equipCosmetic);
  const weeklyRewards = useGameStore((state) => state.weeklyRewards);
  const equippedWeeklyRewardId = useGameStore(
    (state) => state.equippedWeeklyRewardId
  );
  const equipWeeklyReward = useGameStore((state) => state.equipWeeklyReward);

  const stats = computeCharacterStats(verifiedReps);
  const skills = getSkillsForLevel(level);
  const statTexts = i18n.dungeon.stats;
  const skillTexts = i18n.dungeon.skills;
  const lootTexts = i18n.dungeon.loot;

  const equippedSkin = equippedCosmetics.skin
    ? COSMETIC_BY_ID[equippedCosmetics.skin]
    : null;
  const equippedFrame = equippedCosmetics.frame
    ? COSMETIC_BY_ID[equippedCosmetics.frame]
    : null;
  const equippedTitle = equippedCosmetics.title
    ? COSMETIC_BY_ID[equippedCosmetics.title]
    : null;
  const equippedWeeklyReward =
    weeklyRewards.find((r) => r.id === equippedWeeklyRewardId) ?? null;

  const totalCosmeticCount = cosmeticInventory.length + weeklyRewards.length;

  const statItems = [
    { key: 'str', label: statTexts.str, value: stats.str },
    { key: 'agi', label: statTexts.agi, value: stats.agi },
    { key: 'vit', label: statTexts.vit, value: stats.vit },
    { key: 'wis', label: statTexts.wis, value: stats.wis },
  ];

  return (
    <div className="space-y-4">
      {/* 1. Thẻ nhân vật + skin / khung avatar / danh hiệu / huy hiệu thưởng tuần đang trang bị */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center gap-3.5">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 text-3xl ${
              equippedFrame ? equippedFrame.accentClass : ''
            }`}
            aria-hidden="true"
          >
            {equippedSkin ? equippedSkin.icon : '🧑‍💻'}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-extrabold text-white">
                {displayName.trim() || i18n.play.defaultPlayer}
              </p>
              <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                {i18n.dungeon.xpBar.levelPrefix} {level}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {equippedTitle && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${RARITY_BADGE_STYLES[equippedTitle.rarity]}`}
                >
                  <span>{equippedTitle.icon}</span>
                  <span>{lootTexts.items[equippedTitle.id]}</span>
                </span>
              )}

              {equippedWeeklyReward && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${RARITY_BADGE_STYLES[equippedWeeklyReward.rarity]}`}
                >
                  <span>{WEEKLY_REWARD_ICONS[equippedWeeklyReward.rarity]}</span>
                  <span>{equippedWeeklyReward.name}</span>
                </span>
              )}

              {!equippedTitle && !equippedWeeklyReward && (
                <p className="text-[11px] text-slate-400">
                  {equippedSkin
                    ? lootTexts.items[equippedSkin.id]
                    : i18n.dungeon.modeBadge}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. 4 chỉ số nhân vật */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-sm font-bold text-white">{statTexts.title}</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {statItems.map((item) => (
            <div
              key={item.key}
              className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2"
            >
              <div className="text-[11px] text-slate-400">{item.label}</div>
              <div className="mt-0.5 font-mono text-2xl font-extrabold text-emerald-400">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Kho vật phẩm Cosmetic (rương F5b + phần thưởng tuần Reward F7, chỉ trong RAM) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white">
            {lootTexts.inventoryTitle}
          </h3>
          <span className="font-mono text-xs text-slate-400">
            {totalCosmeticCount}
          </span>
        </div>

        {totalCosmeticCount === 0 ? (
          <p className="mt-2.5 text-xs leading-relaxed text-slate-400">
            {lootTexts.inventoryEmpty}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {/* Phần thưởng tuần từ rewardForRank (kiểu Reward gốc của pose-engine.ts) */}
            {weeklyRewards.map((reward) => {
              const isEquipped = equippedWeeklyRewardId === reward.id;
              return (
                <li
                  key={`weekly-${reward.id}`}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                    isEquipped
                      ? 'border-amber-400/70 bg-amber-950/35'
                      : 'border-slate-800 bg-slate-950/70'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span aria-hidden="true">
                        {WEEKLY_REWARD_ICONS[reward.rarity]}
                      </span>
                      <span className="truncate text-xs font-bold text-white">
                        {reward.name}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${RARITY_BADGE_STYLES[reward.rarity]}`}
                      >
                        {lootTexts.rarities[reward.rarity]}
                      </span>
                      <span className="text-[10px] text-amber-300/90">
                        {lootTexts.weeklyRewardTag}
                      </span>
                      {isEquipped && (
                        <span className="text-[10px] font-semibold text-emerald-300">
                          • {lootTexts.equippedBadge}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => equipWeeklyReward(reward.id)}
                    className={`shrink-0 cursor-pointer rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                      isEquipped
                        ? 'border border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-800'
                        : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                    }`}
                  >
                    {isEquipped
                      ? lootTexts.unequipButton
                      : lootTexts.equipButton}
                  </button>
                </li>
              );
            })}

            {/* Vật phẩm cosmetic mở từ rương Dungeon Run */}
            {cosmeticInventory.map((item) => {
              const isEquipped = equippedCosmetics[item.slot] === item.id;
              return (
                <li
                  key={item.id}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                    isEquipped
                      ? 'border-emerald-400/60 bg-emerald-950/35'
                      : 'border-slate-800 bg-slate-950/70'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span aria-hidden="true">{item.icon}</span>
                      <span className="truncate text-xs font-bold text-white">
                        {lootTexts.items[item.id]}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${RARITY_BADGE_STYLES[item.rarity]}`}
                      >
                        {lootTexts.rarities[item.rarity]}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {lootTexts.slots[item.slot]}
                      </span>
                      {isEquipped && (
                        <span className="text-[10px] font-semibold text-emerald-300">
                          • {lootTexts.equippedBadge}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => equipCosmetic(item)}
                    className={`shrink-0 cursor-pointer rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                      isEquipped
                        ? 'border border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-800'
                        : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                    }`}
                  >
                    {isEquipped
                      ? lootTexts.unequipButton
                      : lootTexts.equipButton}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 4. Kỹ năng theo level */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-sm font-bold text-white">{skillTexts.title}</h3>
        <ul className="mt-3 space-y-2">
          {skills.map((skill) => {
            const copy = skillTexts.items[skill.id];
            return (
              <li
                key={skill.id}
                className={`rounded-xl border px-3 py-2.5 ${
                  skill.implemented
                    ? 'border-emerald-500/40 bg-emerald-950/30'
                    : skill.unlocked
                      ? 'border-slate-700 bg-slate-950/80'
                      : 'border-slate-800/80 bg-slate-950/40 opacity-75'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-xs font-bold text-white">
                    {copy.name}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        skill.implemented
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {skill.implemented
                        ? skillTexts.realBadge
                        : skillTexts.comingSoonBadge}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        skill.unlocked
                          ? 'bg-sky-500/20 text-sky-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {skill.unlocked
                        ? skillTexts.unlockedTag
                        : `${skillTexts.lockedPrefix} ${skill.requiredLevel}`}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-400">
                  {copy.desc}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}