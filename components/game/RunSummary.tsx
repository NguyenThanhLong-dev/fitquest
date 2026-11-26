'use client';

import Link from 'next/link';
import type { Rarity } from '@/lib/game/engineAdapter';
import type { DungeonSummaryData } from '@/lib/game/dungeon';
import type { LootChestRoll } from '@/lib/game/cosmetics';
import { i18n } from '@/lib/i18n';
import './dungeon-fx.css';

export interface RunSummaryProps {
  summary: DungeonSummaryData;
  lootRoll: LootChestRoll | null;
  chestOpened: boolean;
  reducedFx: boolean;
  onOpenChest: () => void;
  onPlayAgain: () => void;
}

const RARITY_CARD_STYLES: Record<Rarity, string> = {
  common: 'border-slate-500/60 bg-slate-900 text-slate-100',
  rare: 'border-sky-400/60 bg-sky-950/50 text-sky-100',
  epic: 'border-fuchsia-400/60 bg-fuchsia-950/50 text-fuchsia-100',
  legendary: 'border-amber-400/80 bg-amber-950/50 text-amber-100',
};

const RARITY_PILL_STYLES: Record<Rarity, string> = {
  common: 'bg-slate-700 text-slate-100',
  rare: 'bg-sky-500/25 text-sky-200',
  epic: 'bg-fuchsia-500/25 text-fuchsia-200',
  legendary: 'bg-amber-400 text-slate-950',
};

/** Dịch mã cờ lý do từ pose-engine / SessionGuard sang câu tiếng Việt dễ hiểu. */
function translateReasonCode(code: string): string {
  const dict = i18n.dungeon.verdictReasons;
  if (code.startsWith('INVALID_REP:')) {
    const ex = code.slice('INVALID_REP:'.length);
    return `${dict.INVALID_REP} (${ex})`;
  }
  return dict[code] ?? code;
}

/**
 * Màn tổng kết sau khi kết thúc lượt Dungeon Run (F5a + F5b + link Bảng xếp hạng F7):
 * - Kết quả từ finalizeRun (verified/review/rejected) + XP chính thức & giải thích chênh lệch.
 * - Rương chiến lợi phẩm cosmetic theo seed: verified (4 bậc), review (chỉ rương thường), rejected (không có).
 * - Có nút "Xem bảng xếp hạng tuần" dẫn sang /leaderboard.
 */
export function RunSummary({
  summary,
  lootRoll,
  chestOpened,
  reducedFx,
  onOpenChest,
  onPlayAgain,
}: RunSummaryProps) {
  const texts = i18n.dungeon;
  const sumTexts = texts.summary;
  const lootTexts = texts.loot;
  const verdictCopy = texts.verdicts[summary.verdict];
  const statTexts = texts.stats;

  const verdictStyle =
    summary.verdict === 'verified'
      ? 'border-emerald-500/50 bg-emerald-950/50 text-emerald-100'
      : summary.verdict === 'review'
        ? 'border-amber-500/50 bg-amber-950/50 text-amber-100'
        : 'border-rose-500/60 bg-rose-950/60 text-rose-100';

  const statRows = [
    {
      label: statTexts.str,
      before: summary.statsBefore.str,
      after: summary.statsAfter.str,
    },
    {
      label: statTexts.agi,
      before: summary.statsBefore.agi,
      after: summary.statsAfter.agi,
    },
    {
      label: statTexts.vit,
      before: summary.statsBefore.vit,
      after: summary.statsAfter.vit,
    },
    {
      label: statTexts.wis,
      before: summary.statsBefore.wis,
      after: summary.statsAfter.wis,
    },
  ];

  const xpDiffExplanation =
    summary.xpDiffReason !== 'none'
      ? texts.xpDiffExplanations[summary.xpDiffReason]
      : null;

  return (
    <section
      className={`mx-auto max-w-3xl space-y-5 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8 ${
        reducedFx ? 'fq-reduced-fx' : ''
      }`}
    >
      {/* Tiêu đề & kết quả xác thực */}
      <div className="space-y-3 text-center">
        <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          {summary.completedAllMonsters
            ? sumTexts.titleVictory
            : sumTexts.titleEnded}
        </h2>

        <div className={`rounded-2xl border p-4 text-left ${verdictStyle}`}>
          <p className="text-base font-extrabold">{verdictCopy.label}</p>
          <p className="mt-1 text-sm opacity-90">{verdictCopy.desc}</p>
        </div>
      </div>

      {/* Khối XP chính thức từ finalizeRun */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-slate-300">
            {sumTexts.officialXpLabel}
          </span>
          <span
            className={`font-mono text-4xl font-black ${
              summary.verdict === 'verified'
                ? 'text-emerald-400'
                : 'text-rose-300'
            }`}
          >
            +{summary.officialXp} {texts.xpUnit}
          </span>
        </div>

        {xpDiffExplanation && (
          <div className="mt-3 space-y-1 rounded-xl border border-amber-500/40 bg-amber-950/40 p-3 text-xs text-amber-100">
            <p className="font-mono text-amber-200">
              {sumTexts.tentativeXpLabel}: +{summary.tentativeXp} {texts.xpUnit}{' '}
              → {sumTexts.officialXpLabel}: +{summary.officialXp} {texts.xpUnit}
            </p>
            <p>{xpDiffExplanation}</p>
          </div>
        )}

        {summary.hitXpCap && (
          <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-950/50 px-3 py-2 text-sm font-semibold text-amber-200">
            {texts.xpBar.capReachedNotice}
          </p>
        )}
      </div>

      {/* Rương chiến lợi phẩm Cosmetic (F5b) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-amber-300">
            🎁 {lootTexts.sectionTitle}
          </h3>
          {lootRoll && (
            <span className="text-xs text-slate-400">
              {lootRoll.chestTier === 'standard'
                ? lootTexts.chestLabelVerified
                : lootTexts.chestLabelReview}
            </span>
          )}
        </div>

        {!lootRoll ? (
          <p className="mt-3 rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {lootTexts.rejectedNoChest}
          </p>
        ) : !chestOpened ? (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-950/35 to-slate-900 p-5 text-center">
            <div className="fq-chest-wiggle text-6xl" aria-hidden="true">
              🧰
            </div>

            {lootRoll.chestTier === 'common_only' && (
              <p className="text-xs font-medium text-amber-200">
                {lootTexts.commonOnlyNote}
              </p>
            )}

            <button
              type="button"
              onClick={onOpenChest}
              className="cursor-pointer rounded-xl bg-amber-400 px-6 py-3 text-base font-black text-slate-950 shadow-lg transition hover:bg-amber-300"
            >
              {lootTexts.openButton}
            </button>
          </div>
        ) : (
          <div
            className={`mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 ${RARITY_CARD_STYLES[lootRoll.item.rarity]}`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-slate-950/70 text-4xl"
                aria-hidden="true"
              >
                {lootRoll.item.icon}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-black uppercase ${RARITY_PILL_STYLES[lootRoll.item.rarity]}`}
                  >
                    {lootTexts.rarities[lootRoll.item.rarity]}
                  </span>
                  <span className="text-xs opacity-80">
                    {lootTexts.slots[lootRoll.item.slot]}
                  </span>
                </div>
                <p className="mt-1 text-lg font-black text-white">
                  {lootTexts.items[lootRoll.item.id]}
                </p>
                <p className="mt-0.5 text-xs text-emerald-300">
                  ✓ {lootTexts.openedBadge}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lưới thông số chính của lượt */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs text-slate-400">{sumTexts.monstersClearedLabel}</p>
          <p className="mt-1 font-mono text-2xl font-extrabold text-white">
            {summary.defeatedMonsters} / {summary.totalMonsters}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs text-slate-400">{sumTexts.repsLabel}</p>
          <p className="mt-1 font-mono text-2xl font-extrabold text-white">
            <span className="text-emerald-400">{summary.countedReps}</span>
            {' / '}
            <span className="text-rose-300">{summary.rejectedReps}</span>
            {' / '}
            <span className="text-amber-300">{summary.cancelledReps}</span>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs text-slate-400">{sumTexts.livenessLabel}</p>
          <p className="mt-1 font-mono text-2xl font-extrabold text-white">
            <span className="text-emerald-400">{summary.livenessPassed}</span>
            {' / '}
            <span className="text-rose-300">{summary.livenessFailed}</span>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs text-slate-400">{sumTexts.levelChangeLabel}</p>
          <p className="mt-1 font-mono text-2xl font-extrabold text-white">
            {texts.xpBar.levelPrefix} {summary.levelBefore} →{' '}
            <span
              className={
                summary.levelAfter > summary.levelBefore
                  ? 'text-emerald-400'
                  : 'text-white'
              }
            >
              {texts.xpBar.levelPrefix} {summary.levelAfter}
            </span>
          </p>
        </div>
      </div>

      {/* Chỉ số nhân vật trước -> sau */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
          {sumTexts.statsChangeLabel}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {statRows.map((row) => {
            const delta = row.after - row.before;
            return (
              <div
                key={row.label}
                className="rounded-xl border border-slate-800 bg-slate-900 p-3"
              >
                <div className="text-[11px] text-slate-400">{row.label}</div>
                <div className="mt-1 font-mono text-lg font-extrabold text-white">
                  {row.before} → {row.after}
                  {delta > 0 && (
                    <span className="ml-1 text-xs text-emerald-400">
                      (+{delta})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mục tiêu phụ trong lượt */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
          {sumTexts.objectivesLabel}
        </p>
        <ul className="mt-2.5 space-y-2">
          {summary.sideObjectives.map((obj) => (
            <li
              key={obj.id}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${
                obj.completed
                  ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-100'
                  : 'border-slate-800 bg-slate-900 text-slate-400'
              }`}
            >
              <span>
                {obj.completed ? '✓ ' : '○ '}
                {texts.sideObjectives.items[obj.id]}
              </span>
              <span className="font-mono text-xs">
                {obj.current}/{obj.target}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Chi tiết lý do kiểm định (nếu có) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
          {sumTexts.reasonsTitle}
        </p>
        {summary.reasonCodes.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-300">{sumTexts.noReasonsText}</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-200">
            {summary.reasonCodes.map((code) => (
              <li key={code}>{translateReasonCode(code)}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Nút hành động cuối màn tổng kết (bổ sung link /leaderboard cho F7) */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={onPlayAgain}
          className="cursor-pointer rounded-xl bg-emerald-500 px-6 py-3 text-base font-extrabold text-slate-950 transition hover:bg-emerald-400"
        >
          {sumTexts.playAgainButton}
        </button>

        <Link
          href="/leaderboard"
          className="rounded-xl border border-amber-400/60 bg-amber-500/15 px-5 py-3 text-base font-bold text-amber-200 transition hover:bg-amber-500/25"
        >
          🏆 {sumTexts.leaderboardButton}
        </Link>

        <Link
          href="/"
          className="rounded-xl border border-slate-700 bg-slate-950 px-6 py-3 text-base font-bold text-slate-200 transition hover:bg-slate-800"
        >
          {sumTexts.backHomeButton}
        </Link>
      </div>
    </section>
  );
}