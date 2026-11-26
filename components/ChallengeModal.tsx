'use client';

import type { ActiveChallengeSnapshot } from '@/lib/pose/liveness';
import { i18n } from '@/lib/i18n';

export interface ChallengeModalProps {
  /** Dữ liệu thử thách sống đang diễn ra (5s đếm ngược, giữ tay > vai 0,5s). */
  challenge: ActiveChallengeSnapshot;
}

/**
 * Lớp phủ lớn trên khung camera khi đến lượt Thử thách sống (Lớp 3b).
 * Bộ đếm rep đã bị tạm dừng trong lúc modal này hiển thị.
 */
export function ChallengeModal({ challenge }: ChallengeModalProps) {
  const { liveness } = i18n.play.practice;
  const promptText = liveness.prompts[challenge.id];
  const remainingSec = Math.max(0, challenge.remainingMs / 1000).toFixed(1);
  const holdSec = (challenge.holdMs / 1000).toFixed(2);
  const targetHoldSec = (challenge.requiredHoldMs / 1000).toFixed(1);
  const holdPercent = Math.min(
    100,
    Math.round((challenge.holdMs / Math.max(1, challenge.requiredHoldMs)) * 100)
  );
  const timePercent = Math.min(
    100,
    Math.round((challenge.remainingMs / Math.max(1, challenge.deadlineMs)) * 100)
  );

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-md space-y-4 rounded-2xl border-2 border-amber-400 bg-slate-950/95 p-6 text-center shadow-2xl">
        {/* Huy hiệu thông báo tạm dừng đếm rep */}
        <span className="inline-block rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
          {liveness.modalBadge}
        </span>

        {/* Lời nhắc lớn Giơ tay trái / Giơ tay phải */}
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          {promptText}
        </h2>

        <p className="text-xs text-slate-300">{liveness.holdInstruction}</p>

        {/* Đồng hồ đếm ngược 5 giây */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>{liveness.countdownLabel}</span>
            <span className="font-mono text-lg font-bold text-amber-300">
              {remainingSec}s
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-amber-400 transition-[width] duration-100 ease-linear"
              style={{ width: `${timePercent}%` }}
            />
          </div>
        </div>

        {/* Thanh giữ tay cao hơn vai liên tục 0,5 giây */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>{liveness.holdBarLabel}</span>
            <span
              className={`font-mono font-semibold ${
                challenge.poseHeldNow ? 'text-emerald-300' : 'text-slate-400'
              }`}
            >
              {holdSec}s / {targetHoldSec}s
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-400 transition-[width] duration-75 ease-linear"
              style={{ width: `${holdPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}