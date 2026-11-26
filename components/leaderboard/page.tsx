'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  createEngineSeed,
  type Reward,
} from '@/lib/game/engineAdapter';
import {
  LEADERBOARD_CONFIG,
  buildLeaderboardSnapshot,
} from '@/lib/game/leaderboard';
import { playGameSound, unlockGameAudio } from '@/lib/game/sound';
import { useGameStore } from '@/lib/game/store';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { WeeklyRewardModal } from '@/components/leaderboard/WeeklyRewardModal';
import { i18n } from '@/lib/i18n';

// Bật/tắt bảng Debug F7 (Cộng nhanh 300 XP verified, đổi seed, xem điểm tuần & số ngày hoạt động)
const SHOW_LEADERBOARD_DEBUG = true;

interface ClaimedModalState {
  reward: Reward;
  rank: number;
  totalParticipants: number;
}

/**
 * Trang Bảng xếp hạng minh họa & Thưởng tuần ("/leaderboard") — Task F7.
 * - Tất cả dữ liệu nằm trong Zustand (RAM), không persistence, không gửi ra mạng.
 * - Dùng `useMemo` cho bảng xếp hạng để chỉ tính lại khi điểm tuần, ngày hoạt động hoặc seed đổi.
 */
export default function LeaderboardPage() {
  const displayName = useGameStore((s) => s.displayName);
  const weeklyVerifiedXp = useGameStore((s) => s.weeklyVerifiedXp);
  const currentDemoDay = useGameStore((s) => s.currentDemoDay);
  const weeklyActiveDays = useGameStore((s) => s.weeklyActiveDays);
  const leaderboardSeed = useGameStore((s) => s.leaderboardSeed);
  const weeklyRewardClaimed = useGameStore((s) => s.weeklyRewardClaimed);
  const lastRankChange = useGameStore((s) => s.lastRankChange);
  const soundEnabled = useGameStore((s) => s.soundEnabled);

  const advanceDemoDay = useGameStore((s) => s.advanceDemoDay);
  const resetWeek = useGameStore((s) => s.resetWeek);
  const setLeaderboardSeed = useGameStore((s) => s.setLeaderboardSeed);
  const debugAddVerifiedWeeklyXp = useGameStore(
    (s) => s.debugAddVerifiedWeeklyXp
  );
  const simulateWeekendReward = useGameStore((s) => s.simulateWeekendReward);

  const [debugOpen, setDebugOpen] = useState(false);
  const [modalState, setModalState] = useState<ClaimedModalState | null>(null);
  const [rankPulseActive, setRankPulseActive] = useState(false);

  const resolvedPlayerName =
    displayName.trim() || i18n.leaderboard.defaultPlayerName;

  // Chỉ tính lại bảng xếp hạng khi seed, tên, XP verified tuần hoặc tập ngày hoạt động thay đổi
  const snapshot = useMemo(
    () =>
      buildLeaderboardSnapshot({
        seed: leaderboardSeed,
        playerName: resolvedPlayerName,
        verifiedXp: weeklyVerifiedXp,
        activeDays: weeklyActiveDays,
      }),
    [leaderboardSeed, resolvedPlayerName, weeklyVerifiedXp, weeklyActiveDays]
  );

  // Hiệu ứng nhấn mạnh ngắn (~1,8s) khi hạng của người chơi thay đổi
  useEffect(() => {
    if (!lastRankChange) {
      setRankPulseActive(false);
      return;
    }
    setRankPulseActive(true);
    const timer = window.setTimeout(() => setRankPulseActive(false), 1800);
    return () => window.clearTimeout(timer);
  }, [lastRankChange?.seq]);

  const handleSimulateWeekend = () => {
    unlockGameAudio();
    const result = simulateWeekendReward();
    if (result.status === 'claimed' && result.reward && result.rank !== null) {
      playGameSound('chestOpen', soundEnabled);
      setModalState({
        reward: result.reward,
        rank: result.rank,
        totalParticipants: result.totalParticipants,
      });
    }
  };

  const handleChangeRandomSeed = () => {
    unlockGameAudio();
    const nextSeed = createEngineSeed() % 1_000_000;
    setLeaderboardSeed(nextSeed === 0 ? 2027 : nextSeed);
  };

  const texts = i18n.leaderboard;
  const statusTexts = texts.status;
  const ctrlTexts = texts.controls;
  const debugTexts = texts.debug;

  // Chuỗi thông báo đổi hạng ngắn, tích cực (không dùng từ chê bai)
  let rankChangeText: string | null = null;
  if (snapshot.hasScored && lastRankChange) {
    if (lastRankChange.previousRank === null) {
      rankChangeText = statusTexts.rankEnteredBadge;
    } else if (lastRankChange.delta > 0) {
      rankChangeText = `▲ ${statusTexts.rankUpPrefix} ${lastRankChange.delta} ${statusTexts.rankUpSuffix}`;
    } else if (lastRankChange.delta < 0) {
      rankChangeText = `${statusTexts.rankShiftPrefix}${lastRankChange.newRank} ${statusTexts.rankShiftSuffix}`;
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Thanh tiêu đề & điều hướng */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-3.5">
          <div>
            <h1 className="text-xl font-black tracking-tight text-amber-300 sm:text-2xl">
              🏆 {texts.title}
            </h1>
            <p className="text-xs text-slate-400">
              {statusTexts.demoDayPrefix}{' '}
              <strong className="font-mono text-slate-200">
                #{currentDemoDay}
              </strong>{' '}
              · {statusTexts.activeDaysLabel}:{' '}
              <strong className="font-mono text-emerald-300">
                {snapshot.effectiveActiveDays}/{LEADERBOARD_CONFIG.maxActiveDays}
              </strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {SHOW_LEADERBOARD_DEBUG && (
              <button
                type="button"
                onClick={() => setDebugOpen((open) => !open)}
                className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  debugOpen
                    ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                    : 'border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800'
                }`}
              >
                {debugOpen
                  ? debugTexts.toggleHideButton
                  : debugTexts.toggleShowButton}
              </button>
            )}

            <Link
              href="/play"
              className="rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-extrabold text-slate-950 transition hover:bg-emerald-400"
            >
              ⚔️ {texts.goPlay}
            </Link>

            <Link
              href="/"
              className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              {texts.backHome}
            </Link>
          </div>
        </header>

        {/* Bảng Debug F7 (bật bằng hằng số SHOW_LEADERBOARD_DEBUG) */}
        {SHOW_LEADERBOARD_DEBUG && debugOpen && (
          <section className="rounded-2xl border border-sky-500/40 bg-slate-900/95 p-4 font-mono text-xs text-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <span className="font-sans text-xs font-bold uppercase tracking-wide text-sky-300">
                {debugTexts.title}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    unlockGameAudio();
                    debugAddVerifiedWeeklyXp(LEADERBOARD_CONFIG.debugQuickXp);
                  }}
                  className="cursor-pointer rounded-lg bg-emerald-500 px-3 py-1.5 font-sans text-xs font-extrabold text-slate-950 transition hover:bg-emerald-400"
                >
                  + {debugTexts.addXpButton}
                </button>

                <button
                  type="button"
                  onClick={handleChangeRandomSeed}
                  className="cursor-pointer rounded-lg border border-sky-400/50 bg-sky-500/20 px-3 py-1.5 font-sans text-xs font-bold text-sky-100 transition hover:bg-sky-500/30"
                >
                  {debugTexts.changeSeedButton}
                </button>

                <button
                  type="button"
                  onClick={() => setLeaderboardSeed(LEADERBOARD_CONFIG.defaultSeed)}
                  className="cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-sans text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
                >
                  {debugTexts.resetSeedButton}
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                <div className="font-sans text-[10px] text-slate-400">
                  {debugTexts.seedLabel}
                </div>
                <div className="mt-0.5 text-sm font-bold text-white">
                  {snapshot.seed}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                <div className="font-sans text-[10px] text-slate-400">
                  {debugTexts.weeklyScoreLabel}
                </div>
                <div className="mt-0.5 text-sm font-bold text-emerald-300">
                  {snapshot.playerScore}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                <div className="font-sans text-[10px] text-slate-400">
                  {debugTexts.weeklyXpLabel}
                </div>
                <div className="mt-0.5 text-sm font-bold text-amber-300">
                  {weeklyVerifiedXp} XP
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                <div className="font-sans text-[10px] text-slate-400">
                  {debugTexts.activeDaysLabel}
                </div>
                <div className="mt-0.5 text-sm font-bold text-sky-300">
                  {snapshot.effectiveActiveDays} / {snapshot.totalRecordedDays}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
                <div className="font-sans text-[10px] text-slate-400">
                  {debugTexts.currentDayLabel}
                </div>
                <div className="mt-0.5 text-sm font-bold text-white">
                  #{currentDemoDay}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Khối trạng thái của người chơi: chưa có điểm -> lời mời tập; có điểm -> hạng + khoảng cách */}
        {!snapshot.hasScored ? (
          <section className="rounded-3xl border border-emerald-500/35 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 p-6 text-center shadow-xl">
            <h2 className="text-xl font-black text-white sm:text-2xl">
              {texts.unranked.title}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-300">
              {texts.unranked.desc}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/play"
                className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-black text-slate-950 shadow-lg transition hover:bg-emerald-400"
              >
                ⚔️ {texts.unranked.ctaButton}
              </Link>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              {texts.unranked.noteReview}
            </p>
          </section>
        ) : (
          <section
            className={`rounded-3xl border p-5 shadow-xl transition-all duration-300 ${
              rankPulseActive
                ? 'border-emerald-400 bg-emerald-950/40'
                : 'border-slate-800 bg-slate-900'
            }`}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="text-xs text-slate-400">
                  {statusTexts.rankLabel}
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-3xl font-black text-amber-300">
                    #{snapshot.playerRank}
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    / {snapshot.totalParticipants}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="text-xs text-slate-400">
                  {statusTexts.scoreLabel}
                </div>
                <div className="mt-1 font-mono text-3xl font-black text-emerald-400">
                  {snapshot.playerScore}{' '}
                  <span className="text-xs font-semibold text-slate-400">
                    {texts.pointsUnit}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="text-xs text-slate-400">
                  {statusTexts.verifiedXpLabel} · {statusTexts.activeDaysLabel}
                </div>
                <div className="mt-1 font-mono text-xl font-extrabold text-white">
                  {weeklyVerifiedXp} XP{' '}
                  <span className="text-slate-500">·</span>{' '}
                  <span className="text-sky-300">
                    {snapshot.effectiveActiveDays}/{LEADERBOARD_CONFIG.maxActiveDays}
                  </span>
                </div>
              </div>
            </div>

            {/* Khoảng cách tới người đứng ngay trên + huy hiệu đổi hạng tích cực */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm">
              <p className="font-semibold text-slate-100">
                {snapshot.nextAbove ? (
                  <>
                    🎯 {statusTexts.gapPrefix}{' '}
                    <strong className="font-mono text-amber-300">
                      {snapshot.nextAbove.pointsNeeded}
                    </strong>{' '}
                    {statusTexts.gapMiddle}{' '}
                    <strong className="text-white">
                      {snapshot.nextAbove.name}
                    </strong>
                  </>
                ) : (
                  <span className="text-amber-200">
                    👑 {statusTexts.topRankMessage}
                  </span>
                )}
              </p>

              {rankChangeText && (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-extrabold transition ${
                    rankPulseActive
                      ? 'bg-emerald-400 text-slate-950 scale-105'
                      : 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                  }`}
                >
                  {rankChangeText}
                </span>
              )}
            </div>
          </section>
        )}

        {/* Thanh nút điều khiển mô phỏng tuần: Sang ngày mới / Mô phỏng cuối tuần / Đặt lại tuần */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={advanceDemoDay}
              className="cursor-pointer rounded-xl border border-sky-400/50 bg-sky-500/15 px-4 py-2.5 text-xs font-bold text-sky-100 transition hover:bg-sky-500/25 sm:text-sm"
            >
              📅 {ctrlTexts.nextDemoDayButton} (#{currentDemoDay} → #
              {currentDemoDay + 1})
            </button>

            <button
              type="button"
              disabled={!snapshot.hasScored || weeklyRewardClaimed}
              onClick={handleSimulateWeekend}
              className="cursor-pointer rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-black text-slate-950 shadow transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-400 sm:text-sm"
            >
              🎁{' '}
              {weeklyRewardClaimed
                ? ctrlTexts.weekendClaimedButton
                : ctrlTexts.simulateWeekendButton}
            </button>

            <button
              type="button"
              onClick={() => {
                setModalState(null);
                resetWeek();
              }}
              className="ml-auto cursor-pointer rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-slate-800 sm:text-sm"
            >
              ↺ {ctrlTexts.resetWeekButton}
            </button>
          </div>

          {!snapshot.hasScored && (
            <p className="mt-2.5 text-xs text-slate-400">
              {ctrlTexts.needScoreHint}
            </p>
          )}
        </section>

        {/* Bảng xếp hạng 20 người chơi giả + người chơi thật */}
        <LeaderboardTable
          rows={snapshot.rows}
          highlightRankPulse={rankPulseActive}
        />
      </div>

      {/* Modal nhận thưởng cuối tuần */}
      {modalState && (
        <WeeklyRewardModal
          reward={modalState.reward}
          rank={modalState.rank}
          totalParticipants={modalState.totalParticipants}
          onClose={() => setModalState(null)}
        />
      )}
    </main>
  );
}