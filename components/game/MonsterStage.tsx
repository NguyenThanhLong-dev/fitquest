'use client';

import { useEffect, useState } from 'react';
import type { ExerciseId, XpProgressInfo } from '@/lib/game/engineAdapter';
import type {
  DamageEvent,
  DungeonRunState,
  MonsterEncounter,
} from '@/lib/game/dungeon';
import { isOneHitAway, type ComboMilestone } from '@/lib/game/cosmetics';
import type { ProgressTone } from '@/components/ProgressRing';
import { i18n } from '@/lib/i18n';
import './dungeon-fx.css';

export interface MonsterStageProps {
  dungeon: DungeonRunState;
  monster: MonsterEncounter;
  nextMonster: MonsterEncounter | null;
  xpInfo: XpProgressInfo;
  activeHit: DamageEvent | null;
  hitSeq: number;
  ringProgress: number;
  movementProgress: number;
  currentHoldMs: number;
  targetHoldMs: number;
  paused: boolean;
  challengeActive: boolean;
  frameReady: boolean;
  hintText: string;
  hintTone: ProgressTone;
  reducedFx: boolean;
  breatherRemainingMs: number;
  breatherTip: string | null;
  bossIntroActive: boolean;
  bossFinisherActive: boolean;
  comboCheer: ComboMilestone | null;
  onTogglePause: () => void;
  onSwapMonster: () => void;
  onSkipBreather: () => void;
  onFinishRun: () => void;
}

const MONSTER_VISUALS: Record<
  ExerciseId,
  { emoji: string; accentClass: string; ringClass: string }
> = {
  squat: {
    emoji: '🪨',
    accentClass: 'from-stone-700/60 to-slate-900',
    ringClass: 'border-stone-400/50',
  },
  overhead_reach: {
    emoji: '🐉',
    accentClass: 'from-amber-700/50 to-slate-900',
    ringClass: 'border-amber-400/50',
  },
  side_bend: {
    emoji: '🐍',
    accentClass: 'from-emerald-800/50 to-slate-900',
    ringClass: 'border-emerald-400/50',
  },
  neck_tilt: {
    emoji: '👻',
    accentClass: 'from-indigo-800/50 to-slate-900',
    ringClass: 'border-indigo-400/50',
  },
  high_knees: {
    emoji: '🕷️',
    accentClass: 'from-rose-900/50 to-slate-900',
    ringClass: 'border-rose-400/50',
  },
};

const HINT_TONE_STYLES: Record<ProgressTone, string> = {
  neutral: 'border-slate-700 bg-slate-900/90 text-slate-100',
  info: 'border-sky-500/40 bg-sky-950/60 text-sky-100',
  success: 'border-emerald-500/50 bg-emerald-950/60 text-emerald-100',
  warning: 'border-amber-500/50 bg-amber-950/60 text-amber-100',
  error: 'border-rose-500/50 bg-rose-950/60 text-rose-100',
};

/**
 * Sân đấu quái vật Hầm Ngục:
 * - Với bài giữ (side_bend, neck_tilt, overhead_reach): hiển thị CẢ thanh "Độ vào tư thế giữ" (0-100%)
 *   lẫn thanh "Nạp lực tung đòn" (đếm thời gian giữ 1.5s / 2.0s) để thấy ngay phản hồi khi nghiêng/vươn.
 */
export function MonsterStage({
  dungeon,
  monster,
  nextMonster,
  xpInfo,
  activeHit,
  hitSeq,
  ringProgress,
  movementProgress,
  currentHoldMs,
  targetHoldMs,
  paused,
  challengeActive,
  frameReady,
  hintText,
  hintTone,
  reducedFx,
  breatherRemainingMs,
  breatherTip,
  bossIntroActive,
  bossFinisherActive,
  comboCheer,
  onTogglePause,
  onSwapMonster,
  onSkipBreather,
  onFinishRun,
}: MonsterStageProps) {
  const texts = i18n.dungeon;
  const monsterInfo = texts.monsters[monster.exercise];
  const visual = MONSTER_VISUALS[monster.exercise];
  const isHold = targetHoldMs > 0;

  const [impactState, setImpactState] = useState<'none' | 'normal' | 'crit'>(
    'none'
  );

  useEffect(() => {
    if (hitSeq <= 0 || !activeHit || reducedFx) {
      setImpactState('none');
      return;
    }

    setImpactState(activeHit.isCrit ? 'crit' : 'normal');
    const timer = window.setTimeout(
      () => setImpactState('none'),
      activeHit.isCrit ? 380 : 280
    );
    return () => window.clearTimeout(timer);
  }, [hitSeq, activeHit, reducedFx]);

  const hpPercent = Math.max(
    0,
    Math.min(100, Math.round((monster.hp / Math.max(1, monster.maxHp)) * 100))
  );
  const chargePercent = Math.max(0, Math.min(100, Math.round(ringProgress * 100)));
  const reachPercent = Math.max(
    0,
    Math.min(100, Math.round(movementProgress * 100))
  );
  const xpPercent = Math.round(xpInfo.progressRatio * 100);
  const xpToNext = Math.max(0, xpInfo.nextLevelXp - xpInfo.xp);

  const comboTarget = dungeon.combo < 5 ? 5 : 10;
  const comboProgressPct = Math.min(
    100,
    Math.round((dungeon.combo / comboTarget) * 100)
  );
  const oneHitLeft =
    dungeon.phase === 'fighting' && isOneHitAway(monster, dungeon.combo);

  const canSwap =
    !paused &&
    !challengeActive &&
    !bossIntroActive &&
    !bossFinisherActive &&
    dungeon.phase === 'fighting' &&
    dungeon.swapsRemaining > 0;

  const shakeClass =
    impactState === 'crit'
      ? 'fq-shake-crit'
      : impactState === 'normal'
        ? 'fq-shake-light'
        : '';

  const breatherSeconds = Math.max(1, Math.ceil(breatherRemainingMs / 1000));

  return (
    <section className={`space-y-4 ${reducedFx ? 'fq-reduced-fx' : ''}`}>
      {/* Thanh XP nhân vật + cảnh báo chạm giới hạn XP */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2.5">
            <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-sm font-extrabold text-emerald-300">
              {texts.xpBar.levelPrefix} {xpInfo.level}
            </span>
            <span className="font-mono text-sm font-bold text-white">
              {xpInfo.xp} {texts.xpUnit}
            </span>
            {dungeon.tentativeXpEarned > 0 && (
              <span className="font-mono text-xs text-emerald-300">
                ({texts.xpBar.tentativeLabel} +{dungeon.tentativeXpEarned})
              </span>
            )}
          </div>

          <div className="font-mono text-xs text-slate-400">
            {texts.xpBar.nextLevelPrefix} {xpToNext} {texts.xpUnit} ·{' '}
            {texts.xpBar.capPrefix} {xpInfo.xp}/{xpInfo.cap}
          </div>
        </div>

        <div className="mt-2.5 h-3 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-[width] duration-200"
            style={{ width: `${xpPercent}%` }}
          />
        </div>

        {xpInfo.atCap && (
          <p className="mt-2.5 rounded-xl border border-amber-500/40 bg-amber-950/60 px-3 py-2 text-sm font-semibold text-amber-200">
            {texts.xpBar.capReachedNotice}
          </p>
        )}
      </div>

      {/* Thẻ sân đấu quái vật chính */}
      <div
        className={`relative overflow-hidden rounded-2xl border p-5 shadow-2xl bg-gradient-to-br ${visual.accentClass} ${
          monster.isBoss
            ? 'border-fuchsia-400/75 shadow-fuchsia-950/50'
            : 'border-slate-700/80'
        } ${shakeClass}`}
      >
        {!reducedFx && activeHit?.isCrit && (
          <div
            key={`rays-${hitSeq}`}
            aria-hidden="true"
            className="fq-crit-rays pointer-events-none absolute -inset-12 z-0 rounded-full"
          />
        )}

        <div className="relative z-10">
          {/* Hàng trên: tiến độ phòng + huy hiệu Boss/Thường + Thanh Combo */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-slate-950/80 px-3 py-1 font-mono text-xs font-bold text-slate-200">
                {texts.stagePrefix} {monster.stageNumber}/
                {dungeon.encounters.length}
              </span>
              <span
                className={`rounded-lg px-3 py-1 text-xs font-extrabold tracking-wide ${
                  monster.isBoss
                    ? 'border border-fuchsia-400/60 bg-fuchsia-500/25 text-fuchsia-100'
                    : 'bg-slate-800/90 text-slate-200'
                }`}
              >
                {monster.isBoss ? texts.bossTag : texts.normalTag}
              </span>
            </div>

            <div
              className={`min-w-[175px] rounded-xl border px-3 py-2 ${
                dungeon.combo >= 10
                  ? 'border-fuchsia-400/70 bg-fuchsia-950/50 text-fuchsia-100'
                  : dungeon.combo >= 5
                    ? 'border-amber-400/70 bg-amber-950/50 text-amber-100'
                    : 'border-slate-700 bg-slate-950/75 text-slate-200'
              } ${comboCheer ? 'fq-combo-pop' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-lg font-black leading-none">
                  {texts.comboLabel} x{dungeon.combo}
                </span>
                <span className="text-[10px] font-semibold opacity-80">
                  {dungeon.combo >= 10
                    ? texts.comboMaxReached
                    : `${texts.comboNextMilestone} x${comboTarget}`}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-[width] duration-200 ${
                    dungeon.combo >= 10
                      ? 'bg-fuchsia-400'
                      : dungeon.combo >= 5
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                  }`}
                  style={{ width: `${comboProgressPct}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] opacity-75">
                {texts.comboDamageHint}
              </div>
            </div>
          </div>

          {comboCheer && (
            <div className="fq-combo-pop mt-3 rounded-xl border border-amber-400/60 bg-amber-500/20 px-4 py-2 text-center text-sm font-extrabold text-amber-100">
              🔥 {texts.comboCheers[comboCheer]}
            </div>
          )}

          {/* Chấm tiến độ các phòng trong hầm ngục */}
          <div className="mt-3 flex items-center gap-1.5">
            {dungeon.encounters.map((enc, idx) => (
              <div
                key={`${enc.stageNumber}-${enc.exercise}`}
                className={`h-2 flex-1 rounded-full ${
                  enc.defeated
                    ? 'bg-emerald-400'
                    : idx === dungeon.currentIndex
                      ? enc.isBoss
                        ? 'bg-fuchsia-400'
                        : 'bg-amber-400'
                      : 'bg-slate-800'
                }`}
              />
            ))}
          </div>

          {/* Hình quái + Tên + Số sát thương bay lên */}
          <div className="relative mt-5 flex flex-wrap items-center gap-4">
            <div
              className={`relative flex shrink-0 items-center justify-center rounded-2xl border-2 bg-slate-950/75 shadow-inner ${
                monster.isBoss
                  ? 'h-28 w-28 border-fuchsia-400/70 text-6xl'
                  : `h-24 w-24 text-5xl ${visual.ringClass}`
              } ${monster.defeated ? 'opacity-40 grayscale' : ''} ${
                impactState !== 'none' ? 'fq-monster-hit' : ''
              }`}
              aria-hidden="true"
            >
              <span>{visual.emoji}</span>
              {monster.isBoss && (
                <span className="absolute -top-2.5 -right-2.5 rounded-full bg-fuchsia-600 px-2 py-0.5 text-xs font-black text-white shadow">
                  👑
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <h2
                className={`font-black tracking-tight text-white ${
                  monster.isBoss
                    ? 'text-3xl sm:text-4xl'
                    : 'text-2xl sm:text-3xl'
                }`}
              >
                {monster.isBoss ? monsterInfo.bossName : monsterInfo.name}
              </h2>
              <p className="text-base font-bold text-emerald-300 sm:text-lg">
                {monsterInfo.actionLabel}
              </p>
              <p className="text-xs text-slate-300">
                {i18n.play.practice.exercises[monster.exercise].name} ·{' '}
                {i18n.play.practice.exercises[monster.exercise].meta}
              </p>
            </div>

            {activeHit && (
              <div
                key={`float-${hitSeq}`}
                className="fq-float-up pointer-events-none absolute right-2 -top-3 z-20 flex flex-col items-end"
              >
                {activeHit.isCrit && (
                  <span className="rounded-lg bg-amber-400 px-2.5 py-0.5 text-lg font-black tracking-wide text-slate-950 shadow-lg sm:text-2xl">
                    ⚡ {texts.critBanner}
                  </span>
                )}
                <span
                  className={`font-mono font-black drop-shadow-[0_3px_6px_rgba(0,0,0,0.85)] ${
                    activeHit.isCrit
                      ? 'text-4xl text-amber-300'
                      : 'text-3xl text-white'
                  }`}
                >
                  -{activeHit.damage} {texts.damageUnit}
                </span>
                <span className="rounded-md bg-emerald-500/90 px-2 py-0.5 font-mono text-xs font-extrabold text-slate-950 shadow">
                  {texts.xpFloatingPrefix}
                  {activeHit.tentativeXpAdded} {texts.xpUnit}
                </span>
              </div>
            )}
          </div>

          {/* Thanh HP quái */}
          <div className="mt-5 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {texts.hpLabel}
                </span>
                {oneHitLeft && (
                  <span className="rounded-full border border-amber-400 bg-amber-500/25 px-3 py-0.5 text-xs font-black uppercase tracking-wide text-amber-200">
                    🎯 {texts.lastHitBadge}
                  </span>
                )}
              </div>

              <span
                className={`font-mono font-extrabold text-white ${
                  monster.isBoss ? 'text-2xl' : 'text-xl'
                }`}
              >
                {monster.hp} / {monster.maxHp}
              </span>
            </div>

            <div
              className={`w-full overflow-hidden rounded-full border bg-slate-950/90 p-0.5 ${
                monster.isBoss
                  ? 'h-7 border-fuchsia-400/60'
                  : 'h-5 border-slate-700'
              }`}
            >
              <div
                className={`h-full rounded-full transition-[width] duration-200 ${
                  monster.isBoss
                    ? 'bg-gradient-to-r from-fuchsia-600 via-pink-500 to-rose-400'
                    : oneHitLeft || hpPercent <= 30
                      ? 'bg-gradient-to-r from-rose-600 to-amber-400'
                      : 'bg-gradient-to-r from-rose-500 to-orange-400'
                }`}
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>

          {/* Thanh tiến độ động tác + Thanh Nạp lực đếm giây giữ */}
          <div className="mt-4 space-y-3 rounded-xl border border-slate-800 bg-slate-950/75 p-3.5">
            {isHold && (
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>{i18n.play.practice.reachPoseBarLabel}</span>
                  <span className="font-mono text-sm font-bold text-emerald-300">
                    {reachPercent}%
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
                      !frameReady
                        ? 'bg-amber-500/60'
                        : reachPercent >= 100
                          ? 'bg-emerald-400'
                          : 'bg-sky-400'
                    }`}
                    style={{ width: `${reachPercent}%` }}
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>
                  {isHold ? texts.chargeBarLabel : texts.repProgressLabel}
                </span>
                <span className="font-mono text-base font-bold text-sky-300">
                  {isHold
                    ? `${(currentHoldMs / 1000).toFixed(1)}s / ${(targetHoldMs / 1000).toFixed(1)}s`
                    : `${chargePercent}%`}
                </span>
              </div>

              <div className="mt-1.5 h-3.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
                    !frameReady
                      ? 'bg-amber-500/60'
                      : chargePercent >= 100
                        ? 'bg-emerald-400'
                        : 'bg-amber-400'
                  }`}
                  style={{ width: `${chargePercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Gợi ý form to, rõ ngay trong sân đấu */}
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-base font-bold leading-snug ${HINT_TONE_STYLES[hintTone]}`}
          >
            {hintText}
          </div>

          {/* Nút điều khiển lượt */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={
                challengeActive ||
                bossIntroActive ||
                bossFinisherActive ||
                dungeon.phase !== 'fighting'
              }
              onClick={onTogglePause}
              className="cursor-pointer rounded-xl border border-slate-600 bg-slate-950/90 px-4 py-2.5 text-sm font-bold text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {paused ? texts.controls.resume : texts.controls.pause}
            </button>

            <button
              type="button"
              disabled={!canSwap}
              onClick={onSwapMonster}
              className="cursor-pointer rounded-xl border border-sky-400/50 bg-sky-500/20 px-4 py-2.5 text-sm font-bold text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {dungeon.swapsRemaining > 0
                ? `${texts.controls.swapMonster} (${dungeon.swapsRemaining})`
                : texts.controls.swapUsed}
            </button>

            <button
              type="button"
              disabled={bossFinisherActive}
              onClick={onFinishRun}
              className="ml-auto cursor-pointer rounded-xl border border-rose-500/50 bg-rose-950/70 px-4 py-2.5 text-sm font-bold text-rose-200 transition hover:bg-rose-900/70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {texts.controls.finishRun}
            </button>
          </div>
        </div>

        {/* Lớp phủ 1: Nghỉ lấy hơi 4s giữa các quái */}
        {dungeon.phase === 'transitioning' && breatherRemainingMs > 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/90 p-6 text-center backdrop-blur-sm">
            <span className="rounded-full border border-emerald-400/50 bg-emerald-500/20 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-emerald-200">
              {texts.breather.badge} · {breatherSeconds}{' '}
              {texts.breather.countdownSuffix}
            </span>

            <h3 className="text-2xl font-black text-white sm:text-3xl">
              {texts.breather.title}
            </h3>

            {breatherTip && (
              <p className="max-w-md text-base font-medium text-sky-200">
                💧 {breatherTip}
              </p>
            )}

            {nextMonster && (
              <p className="text-sm text-slate-300">
                {texts.breather.nextMonsterPrefix}{' '}
                <strong className="text-white">
                  {nextMonster.isBoss
                    ? texts.monsters[nextMonster.exercise].bossName
                    : texts.monsters[nextMonster.exercise].name}
                </strong>{' '}
                ({i18n.play.practice.exercises[nextMonster.exercise].name})
              </p>
            )}

            <button
              type="button"
              onClick={onSkipBreather}
              className="mt-1 cursor-pointer rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-400"
            >
              {texts.breather.skipButton}
            </button>
          </div>
        )}

        {/* Lớp phủ 2: Màn chào sân riêng của Boss cuối */}
        {bossIntroActive && monster.isBoss && (
          <div className="fq-boss-intro pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-fuchsia-950/95 via-slate-950/95 to-slate-950/95 p-6 text-center">
            <span className="rounded-full border border-fuchsia-400 bg-fuchsia-500/25 px-4 py-1 text-xs font-black tracking-widest text-fuchsia-200">
              👑 {texts.boss.introBadge}
            </span>
            <div className="text-6xl" aria-hidden="true">
              {visual.emoji}
            </div>
            <h3 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              {monsterInfo.bossName}
            </h3>
            <p className="max-w-md text-sm font-semibold text-fuchsia-200">
              {texts.boss.introSubtitle}
            </p>
          </div>
        )}

        {/* Lớp phủ 3: Hiệu ứng làm chậm 0,5s đòn kết liễu Boss */}
        {bossFinisherActive && (
          <div className="fq-boss-finisher pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-amber-500/35 via-fuchsia-950/90 to-slate-950/95 p-6 text-center backdrop-blur-[2px]">
            <span className="text-3xl font-black tracking-wider text-amber-300 drop-shadow sm:text-4xl">
              ⚡ {texts.boss.finisherBadge}
            </span>
            <p className="text-base font-bold text-white">
              {texts.boss.finisherSubtitle}
            </p>
          </div>
        )}

        {/* Lớp phủ 4: Tạm dừng */}
        {paused && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/85 p-6 text-center backdrop-blur-sm">
            <h3 className="text-3xl font-black text-white">
              {texts.pausedOverlayTitle}
            </h3>
            <p className="text-sm text-slate-300">{texts.pausedOverlayDesc}</p>
            <button
              type="button"
              onClick={onTogglePause}
              className="mt-2 cursor-pointer rounded-xl bg-emerald-500 px-6 py-3 text-base font-extrabold text-slate-950 transition hover:bg-emerald-400"
            >
              {texts.controls.resume}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}