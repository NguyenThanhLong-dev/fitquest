'use client';

import Link from 'next/link';
import type { Rarity, Reward } from '@/lib/game/engineAdapter';
import { i18n } from '@/lib/i18n';

export interface WeeklyRewardModalProps {
  reward: Reward;
  rank: number;
  totalParticipants: number;
  onClose: () => void;
}

const RARITY_STYLES: Record<
  Rarity,
  { border: string; pill: string; icon: string; glow: string }
> = {
  common: {
    border: 'border-slate-500/70 bg-slate-900',
    pill: 'bg-slate-700 text-slate-100',
    icon: '🎖️',
    glow: 'from-slate-800/60 to-slate-950',
  },
  rare: {
    border: 'border-sky-400/70 bg-slate-900',
    pill: 'bg-sky-500/25 text-sky-200',
    icon: '🛡️',
    glow: 'from-sky-900/50 to-slate-950',
  },
  epic: {
    border: 'border-fuchsia-400/75 bg-slate-900',
    pill: 'bg-fuchsia-500/25 text-fuchsia-200',
    icon: '⚔️',
    glow: 'from-fuchsia-900/50 to-slate-950',
  },
  legendary: {
    border: 'border-amber-400 bg-slate-900',
    pill: 'bg-amber-400 text-slate-950',
    icon: '👑',
    glow: 'from-amber-900/50 to-slate-950',
  },
};

/**
 * Màn hình chúc mừng nhận thưởng cuối tuần từ `rewardForRank(rank, total)`:
 * - Hiển thị đúng `Reward` (`name`, `rarity`) của pose-engine.ts.
 * - Ghi rõ phần thưởng chỉ là cosmetic và đã được thêm vào kho trang bị (RAM).
 */
export function WeeklyRewardModal({
  reward,
  rank,
  totalParticipants,
  onClose,
}: WeeklyRewardModalProps) {
  const modalTexts = i18n.leaderboard.rewardModal;
  const rarityLabel = i18n.dungeon.loot.rarities[reward.rarity];
  const style = RARITY_STYLES[reward.rarity];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-reward-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div
        className={`w-full max-w-md space-y-5 rounded-3xl border-2 p-6 text-center shadow-2xl bg-gradient-to-b ${style.glow} ${style.border}`}
      >
        <span className="inline-block rounded-full border border-amber-400/40 bg-amber-500/15 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-amber-200">
          {modalTexts.badge}
        </span>

        <div className="space-y-2">
          <div className="text-6xl" aria-hidden="true">
            {style.icon}
          </div>
          <h2
            id="weekly-reward-title"
            className="text-2xl font-black tracking-tight text-white sm:text-3xl"
          >
            {modalTexts.title}
          </h2>
          <p className="font-mono text-sm font-bold text-emerald-300">
            {modalTexts.rankPrefix} #{rank} / {totalParticipants}
          </p>
        </div>

        {/* Thẻ vật phẩm thưởng tuần (dùng trực tiếp Reward.name và Reward.rarity) */}
        <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
          <span
            className={`inline-block rounded-full px-3 py-0.5 text-xs font-black uppercase ${style.pill}`}
          >
            {rarityLabel}
          </span>
          <p className="mt-2 text-xl font-black text-white">{reward.name}</p>
          <p className="mt-1 text-xs text-slate-400">
            {i18n.dungeon.loot.weeklyRewardTag}
          </p>
        </div>

        <p className="rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-2.5 text-xs leading-relaxed text-slate-300">
          {modalTexts.cosmeticOnlyNote}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-400"
          >
            {modalTexts.closeButton}
          </button>

          <Link
            href="/play"
            className="rounded-xl border border-slate-700 bg-slate-950 px-5 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-slate-800"
          >
            {modalTexts.goPlayButton}
          </Link>
        </div>
      </div>
    </div>
  );
}