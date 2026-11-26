'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useGameStore } from '@/lib/game/store';
import { getXpProgressInfo, type Rarity } from '@/lib/game/engineAdapter';
import { COSMETIC_BY_ID } from '@/lib/game/cosmetics';
import { unlockGameAudio } from '@/lib/game/sound';
import { PrivacyModal } from '@/components/game/PrivacyModal';
import { GuideModal } from '@/components/game/GuideModal';
import { i18n } from '@/lib/i18n';

const WEEKLY_REWARD_ICONS: Record<Rarity, string> = {
  common: '🎖️',
  rare: '🛡️',
  epic: '⚔️',
  legendary: '👑',
};

/**
 * Trang chủ ("/") — Hoàn thiện F8:
 * - Công tắc "Đứng / Ngồi" (mặc định Đứng, lưu trong Zustand RAM) kèm hướng dẫn riêng khi chọn Ngồi.
 * - Nút mở khung "Quyền riêng tư" và "Hướng dẫn nhanh".
 * - Bố cục co giãn tốt trên điện thoại, nút bấm đủ lớn.
 */
export default function HomePage() {
  const displayName = useGameStore((state) => state.displayName);
  const setDisplayName = useGameStore((state) => state.setDisplayName);
  const postureMode = useGameStore((state) => state.postureMode);
  const setPostureMode = useGameStore((state) => state.setPostureMode);
  const totalXp = useGameStore((state) => state.totalXp);
  const cosmeticInventory = useGameStore((state) => state.cosmeticInventory);
  const equippedCosmetics = useGameStore((state) => state.equippedCosmetics);
  const weeklyRewards = useGameStore((state) => state.weeklyRewards);
  const equippedWeeklyRewardId = useGameStore(
    (state) => state.equippedWeeklyRewardId
  );

  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const xpInfo = getXpProgressInfo(totalXp);
  const equippedTitle = equippedCosmetics.title
    ? COSMETIC_BY_ID[equippedCosmetics.title]
    : null;
  const equippedSkin = equippedCosmetics.skin
    ? COSMETIC_BY_ID[equippedCosmetics.skin]
    : null;
  const equippedFrame = equippedCosmetics.frame
    ? COSMETIC_BY_ID[equippedCosmetics.frame]
    : null;
  const equippedWeeklyReward =
    weeklyRewards.find((r) => r.id === equippedWeeklyRewardId) ?? null;

  const totalCosmeticCount = cosmeticInventory.length + weeklyRewards.length;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-slate-950 to-indigo-950/70 px-4 py-8 text-slate-100 sm:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 right-1/4 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl"
      />

      <div className="relative w-full max-w-lg space-y-5 rounded-3xl border border-slate-800/90 bg-slate-900/90 p-6 shadow-2xl backdrop-blur sm:p-8">
        {/* Huy hiệu, Tiêu đề & Câu cốt truyện Hầm Ngục */}
        <div className="space-y-2.5 text-center">
          <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300">
            ⚔️ {i18n.home.dungeonTag}
          </span>

          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-amber-200 bg-clip-text text-transparent">
              {i18n.home.title}
            </span>
          </h1>

          <p className="text-base font-extrabold text-amber-200 sm:text-lg">
            {i18n.home.storyLine}
          </p>

          <p className="text-sm leading-relaxed text-slate-300">
            {i18n.home.description}
          </p>
        </div>

        {/* Trạng thái nhân vật tạm trong RAM */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/85 px-4 py-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-2xl ${
                equippedFrame ? equippedFrame.accentClass : ''
              }`}
              aria-hidden="true"
            >
              {equippedSkin ? equippedSkin.icon : '🛡️'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-slate-300">
                <span>
                  {i18n.home.levelPrefix}{' '}
                  <strong className="font-mono text-base text-emerald-400">
                    {xpInfo.level}
                  </strong>
                </span>
                {equippedTitle && (
                  <span className="text-amber-300">
                    {equippedTitle.icon}{' '}
                    {i18n.dungeon.loot.items[equippedTitle.id]}
                  </span>
                )}
                {equippedWeeklyReward && (
                  <span className="text-amber-200">
                    {WEEKLY_REWARD_ICONS[equippedWeeklyReward.rarity]}{' '}
                    {equippedWeeklyReward.name}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                {i18n.home.cosmeticCountPrefix}{' '}
                <span className="font-mono text-slate-200">
                  {totalCosmeticCount}
                </span>
              </div>
            </div>
          </div>

          <span className="shrink-0 font-mono text-xs font-bold text-slate-200">
            {xpInfo.xp} / {xpInfo.cap} {i18n.home.xpUnit}
          </span>
        </div>

        {/* Công tắc Đứng / Ngồi (mặc định Đứng, lưu trong Zustand RAM) */}
        <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-slate-200">
              {i18n.posture.label}
            </span>
            <div className="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1">
              <button
                type="button"
                onClick={() => setPostureMode('standing')}
                className={`cursor-pointer rounded-lg px-4 py-2 text-xs font-extrabold transition sm:text-sm ${
                  postureMode === 'standing'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                🧍 {i18n.posture.standing}
              </button>
              <button
                type="button"
                onClick={() => setPostureMode('seated')}
                className={`cursor-pointer rounded-lg px-4 py-2 text-xs font-extrabold transition sm:text-sm ${
                  postureMode === 'seated'
                    ? 'bg-sky-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                🪑 {i18n.posture.seated}
              </button>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-300">
            {postureMode === 'seated'
              ? i18n.posture.seatedShortDesc
              : i18n.posture.standingShortDesc}
          </p>

          {postureMode === 'seated' && (
            <p className="rounded-xl border border-sky-500/30 bg-sky-950/40 px-3 py-2 text-xs leading-relaxed text-sky-200">
              💡 {i18n.posture.seatedSetupGuide}
            </p>
          )}
        </div>

        {/* Ô nhập tên hiệp sĩ tùy chọn */}
        <div className="space-y-2">
          <label
            htmlFor="display-name"
            className="block text-sm font-semibold text-slate-200"
          >
            {i18n.home.nameLabel}
          </label>
          <input
            id="display-name"
            type="text"
            maxLength={30}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={i18n.home.namePlaceholder}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
          />
        </div>

        {/* Nút Bắt đầu Dungeon Run + Bảng xếp hạng + Luyện tập */}
        <div className="space-y-2.5">
          <Link
            href="/play"
            onClick={unlockGameAudio}
            className="block w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-4 text-center text-lg font-black tracking-wide text-slate-950 shadow-lg shadow-emerald-950/60 transition hover:from-emerald-400 hover:to-teal-300"
          >
            ⚔️ {i18n.home.startButton}
          </Link>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <Link
              href="/leaderboard"
              onClick={unlockGameAudio}
              className="block w-full rounded-xl border border-amber-400/50 bg-amber-500/15 px-4 py-3 text-center text-sm font-bold text-amber-200 transition hover:bg-amber-500/25"
            >
              🏆 {i18n.home.leaderboardButton}
            </Link>

            <Link
              href="/play?mode=practice"
              onClick={unlockGameAudio}
              className="block w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-center text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              {i18n.home.practiceButton}
            </Link>
          </div>

          {/* Nút mở Hướng dẫn nhanh & Quyền riêng tư */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="cursor-pointer rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              ❓ {i18n.home.guideButton}
            </button>

            <button
              type="button"
              onClick={() => setPrivacyOpen(true)}
              className="cursor-pointer rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              🔒 {i18n.home.privacyButton}
            </button>
          </div>
        </div>

        {/* Ghi chú quyền riêng tư và cảnh báo không lưu dữ liệu */}
        <div className="space-y-1 text-center text-xs text-slate-400">
          <p>{i18n.home.privacyNote}</p>
          <p className="font-medium text-amber-300/90">
            {i18n.home.reloadLossNotice}
          </p>
        </div>
      </div>

      {guideOpen && <GuideModal onClose={() => setGuideOpen(false)} />}
      {privacyOpen && <PrivacyModal onClose={() => setPrivacyOpen(false)} />}
    </main>
  );
}