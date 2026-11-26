'use client';

import type { PostureMode } from '@/lib/game/engineAdapter';
import type { FrameStabilitySnapshot } from '@/lib/pose/frameCheck';
import { i18n } from '@/lib/i18n';

export interface SetupCheckProps {
  /** Trạng thái kiểm tra khung hình sau bộ chống nhấp nháy 400ms. */
  snapshot: FrameStabilitySnapshot;
  /** Chỉ hiển thị kết quả thật khi cả camera và mô hình AI đều đã sẵn sàng. */
  aiReady: boolean;
  /** Chế độ Đứng hoặc Ngồi để hiển thị đúng thông báo và mẹo đặt webcam. */
  postureMode?: PostureMode;
  /** True nếu người dùng đang chủ động tắt camera. */
  cameraOff?: boolean;
}

/**
 * Thẻ trạng thái Lớp 0 (Kiểm tra khung hình):
 * - Chế độ Đứng: báo theo khung toàn thân/thân trên.
 * - Chế độ Ngồi: báo theo thân trên kèm hướng dẫn đặt webcam ngang tầm ngực–vai, cách 60–80cm.
 */
export function SetupCheck({
  snapshot,
  aiReady,
  postureMode = 'standing',
  cameraOff = false,
}: SetupCheckProps) {
  const { frameCheck, status } = i18n.play.practice;
  const isSeated = postureMode === 'seated';

  if (cameraOff) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
        <span className="font-semibold text-white">{frameCheck.title}:</span>{' '}
        {status.cameraOff}
      </div>
    );
  }

  if (!aiReady) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400">
        <span className="font-semibold text-slate-300">{frameCheck.title}:</span>{' '}
        {status.waitingCamera}
      </div>
    );
  }

  const isReady = snapshot.stableOk;
  const isStabilizing = snapshot.transitioningTo !== null;
  const reasonMap = isSeated ? frameCheck.seatedReasons : frameCheck.reasons;
  const readyText = isSeated
    ? frameCheck.readyMessageSeated
    : frameCheck.readyMessage;
  const reasonText = snapshot.stableReason
    ? reasonMap[snapshot.stableReason]
    : readyText;

  return (
    <div
      className={`rounded-2xl border px-4 py-3 transition-colors ${
        isReady
          ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-100'
          : 'border-amber-500/40 bg-amber-950/40 text-amber-100'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isReady ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <span className="text-xs font-semibold uppercase tracking-wide opacity-80">
            {frameCheck.title}
          </span>
          {isSeated && (
            <span className="rounded-full border border-sky-400/40 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-200">
              🪑 {i18n.posture.seatedBadge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isStabilizing && (
            <span className="rounded-full bg-slate-900/70 px-2.5 py-0.5 text-[11px] font-medium text-slate-200">
              {frameCheck.stabilizingBadge}
            </span>
          )}
          <span
            className={`rounded-full px-3 py-0.5 text-xs font-bold ${
              isReady
                ? 'bg-emerald-500/25 text-emerald-200'
                : 'bg-amber-500/25 text-amber-200'
            }`}
          >
            {isReady ? frameCheck.readyBadge : frameCheck.notReadyBadge}
          </span>
        </div>
      </div>

      <p className="mt-1.5 text-sm leading-snug">
        {isReady ? readyText : reasonText}
      </p>

      {isSeated && !isReady && (
        <p className="mt-1.5 text-xs leading-relaxed text-sky-200/90">
          💡 {i18n.posture.seatedSetupGuide}
        </p>
      )}
    </div>
  );
}