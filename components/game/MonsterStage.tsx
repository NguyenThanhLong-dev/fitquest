'use client';

import type { ExerciseId, XpProgressInfo } from '@/lib/game/engineAdapter';
import type { DamageEvent, DungeonRunState, MonsterEncounter } from '@/lib/game/dungeon';
import type { ProgressTone } from '@/components/ProgressRing';
import { i18n } from '@/lib/i18n';

export interface MonsterStageProps {
  dungeon: DungeonRunState;
  monster: MonsterEncounter;
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
  onTogglePause: () => void;
  onSwapMonster: () => void;
  onFinishRun: () => void;
}

// Tạo hình biểu tượng nội bộ bằng Emoji + nền CSS hầm ngục (không tải ảnh từ mạng)
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
 * Sân đấu quái Hầm Ngục — thiết kế tối màu, chữ lớn dễ đọc từ khoảng cách ~1m.
 * Hiển thị: quái hiện tại, thanh HP, thanh nạp lực / tiến độ đòn, sát thương / Chí mạng / +XP nổi,
 * Combo, thanh XP lên cấp, cảnh báo giới hạn XP và các nút Tạm dừng / Đổi quái / Kết thúc lượt.
 */
export function MonsterStage({
  dungeon,
  monster,
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
  onTogglePause,
  onSwapMonster,
  onFinishRun,
}: MonsterStageProps) {
  const texts = i18n.dungeon;
  const monsterInfo = texts.monsters[monster.exercise];
  const visual = MONSTER_VISUALS[monster.exercise];
  const isHold = targetHoldMs > 0;

  const hpPercent = Math.max(
    0,
    Math.min(100, Math.round((monster.hp / Math.max(1, monster.maxHp)) * 100))
  );
  const chargePercent = Math.max(0, Math.min(100, Math.round(ringProgress * 100)));
  const xpPercent = Math.round(xpInfo.progressRatio * 100);
  const xpToNext = Math.max(0, xpInfo.nextLevelXp - xpInfo.xp);

  const canSwap =
    !paused &&
    !challengeActive &&
    dungeon.phase === 'fighting' &&
    dungeon.swapsRemaining > 0;

  return (
    <section className="space-y-4">
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

      {/* Thẻ quái vật chính (phong cách hầm ngục, chữ to đọc từ xa 1m) */}
      <div
        className={`relative overflow-hidden rounded-2xl border p-5 shadow-2xl bg-gradient-to-br ${visual.accentClass} ${
          monster.isBoss
            ? 'border-fuchsia-500/60'
            : 'border-slate-700/80'
        }`}
      >
        {/* Hàng trên: tiến độ phòng + huy hiệu Boss/Thường + Combo */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-slate-950/80 px-3 py-1 font-mono text-xs font-bold text-slate-200">
              {texts.stagePrefix} {monster.stageNumber}/{dungeon.encounters.length}
            </span>
            <span
              className={`rounded-lg px-3 py-1 text-xs font-extrabold tracking-wide ${
                monster.isBoss
                  ? 'bg-fuchsia-500/25 text-fuchsia-200 border border-fuchsia-400/50'
                  : 'bg-slate-800/90 text-slate-200'
              }`}
            >
              {monster.isBoss ? texts.bossTag : texts.normalTag}
            </span>
          </div>

          {/* Huy hiệu Combo (chỉ ảnh hưởng sát thương) */}
          <div
            className={`rounded-xl border px-3 py-1.5 text-right ${
              dungeon.combo >= 3
                ? 'border-amber-400/60 bg-amber-500/15 text-amber-200'
                : 'border-slate-700 bg-slate-950/70 text-slate-300'
            }`}
          >
            <div className="font-mono text-lg font-black leading-none">
              {texts.comboLabel} x{dungeon.combo}
            </div>
            <div className="mt-0.5 text-[10px] opacity-80">
              {texts.comboDamageHint}
            </div>
          </div>
        </div>

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

        {/* Hình quái + Tên + Lời kêu gọi động tác lớn */}
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <div
            className={`relative flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-2 bg-slate-950/75 text-5xl shadow-inner ${visual.ringClass} ${
              monster.defeated ? 'opacity-40 grayscale' : ''
            }`}
            aria-hidden="true"
          >
            <span>{visual.emoji}</span>
            {monster.isBoss && (
              <span className="absolute -top-2 -right-2 rounded-full bg-fuchsia-600 px-2 py-0.5 text-[10px] font-black text-white shadow">
                👑
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
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
        </div>

        {/* Thanh HP quái lớn, rõ nét */}
        <div className="mt-5 space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {texts.hpLabel}
            </span>
            <span className="font-mono text-xl font-extrabold text-white">
              {monster.hp} / {monster.maxHp}
            </span>
          </div>

          <div className="h-5 w-full overflow-hidden rounded-full border border-slate-700 bg-slate-950/90 p-0.5">
            <div
              className={`h-full rounded-full transition-[width] duration-200 ${
                monster.isBoss
                  ? 'bg-gradient-to-r from-fuchsia-600 to-rose-400'
                  : hpPercent <= 30
                    ? 'bg-gradient-to-r from-rose-600 to-amber-400'
                    : 'bg-gradient-to-r from-rose-500 to-orange-400'
              }`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {/* Thanh Nạp lực (bài giữ) hoặc Nhịp tung đòn (bài động) */}
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/75 p-3.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>{isHold ? texts.chargeBarLabel : texts.repProgressLabel}</span>
            <span className="font-mono text-base font-bold text-sky-300">
              {isHold
                ? `${(currentHoldMs / 1000).toFixed(1)}s / ${(targetHoldMs / 1000).toFixed(1)}s`
                : `${chargePercent}%`}
            </span>
          </div>

          <div className="mt-2 h-3.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
                !frameReady
                  ? 'bg-amber-500/60'
                  : chargePercent >= 100
                    ? 'bg-emerald-400'
                    : 'bg-sky-400'
              }`}
              style={{ width: `${chargePercent}%` }}
            />
          </div>

          {isHold && (
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>{i18n.play.practice.reachPoseBarLabel}</span>
              <span className="font-mono text-slate-200">
                {Math.round(movementProgress * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Đòn đánh nổi: Sát thương, CHÍ MẠNG (chữ lớn), +XP nổi */}
        {activeHit && (
          <div
            key={hitSeq}
            className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 ${
              activeHit.isCrit
                ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100'
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-2.5">
              {activeHit.isCrit && (
                <span className="text-2xl font-black tracking-wide text-amber-300">
                  {texts.critBanner}
                </span>
              )}
              <span className="font-mono text-2xl font-black text-white">
                -{activeHit.damage} {texts.damageUnit}
              </span>
              <span className="font-mono text-xs opacity-85">
                (Q: {activeHit.quality.toFixed(2)})
              </span>
            </div>

            <span className="rounded-lg bg-emerald-500/25 px-3 py-1 font-mono text-base font-extrabold text-emerald-200">
              {texts.xpFloatingPrefix}
              {activeHit.tentativeXpAdded} {texts.xpUnit}
            </span>
          </div>
        )}

        {/* Thông báo vừa hạ gục quái (~1s chuyển quái kế) */}
        {dungeon.phase === 'transitioning' && (
          <div className="mt-4 rounded-xl border border-emerald-400 bg-emerald-950/90 px-4 py-3 text-center text-base font-extrabold text-emerald-200">
            {texts.defeatedBanner}
          </div>
        )}

        {/* Gợi ý form to, rõ ngay trong sân đấu */}
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-base font-bold leading-snug ${HINT_TONE_STYLES[hintTone]}`}
        >
          {hintText}
        </div>

        {/* Nút điều khiển lượt: Tạm dừng, Đổi quái (1 lần miễn phí), Kết thúc lượt */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={challengeActive || dungeon.phase !== 'fighting'}
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
            onClick={onFinishRun}
            className="ml-auto cursor-pointer rounded-xl border border-rose-500/50 bg-rose-950/70 px-4 py-2.5 text-sm font-bold text-rose-200 transition hover:bg-rose-900/70"
          >
            {texts.controls.finishRun}
          </button>
        </div>

        {/* Lớp phủ Tạm dừng */}
        {paused && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/85 p-6 text-center backdrop-blur-sm">
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