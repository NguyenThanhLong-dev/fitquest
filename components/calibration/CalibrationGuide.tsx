'use client';

import type { TrialType } from '@/lib/game/calibration';
import { i18n } from '@/lib/i18n';

export interface CalibrationGuideProps {
  /** Kiểu thử hiện đang chọn để tô nổi bật hướng dẫn tương ứng. */
  activeTrialType: TrialType;
}

/**
 * Khung hướng dẫn ngắn trên trang /calibrate giúp người thử biết
 * khoảng cách đặt camera (Đứng / Ngồi) và cách thực hiện từng kiểu thử nghiệm.
 */
export function CalibrationGuide({ activeTrialType }: CalibrationGuideProps) {
  const guideTexts = i18n.calibration.guide;
  const trialLabels = i18n.calibration.trialTypes;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-emerald-300">
        📋 {guideTexts.title}
      </h2>

      {/* Khoảng cách đặt camera cho Đứng và Ngồi */}
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 text-xs leading-relaxed text-slate-200">
          <span className="font-bold text-emerald-300">🧍 </span>
          {guideTexts.distanceStanding}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 text-xs leading-relaxed text-slate-200">
          <span className="font-bold text-sky-300">🪑 </span>
          {guideTexts.distanceSeated}
        </div>
      </div>

      {/* Cách làm cho từng kiểu thử */}
      <p className="mt-3.5 text-xs font-bold text-slate-300">
        {guideTexts.scenariosTitle}
      </p>

      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {guideTexts.scenarios.map((item) => {
          const isActive = item.type === activeTrialType;
          const isCheat = item.type !== 'real';

          return (
            <div
              key={item.type}
              className={`rounded-xl border p-3 text-xs leading-relaxed transition ${
                isActive
                  ? isCheat
                    ? 'border-amber-400/70 bg-amber-950/40 text-amber-100'
                    : 'border-emerald-400/70 bg-emerald-950/40 text-emerald-100'
                  : 'border-slate-800 bg-slate-950/60 text-slate-300'
              }`}
            >
              <div className="font-bold text-white">
                {trialLabels[item.type]}
                {isActive && (
                  <span className="ml-2 rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-extrabold uppercase">
                    ●
                  </span>
                )}
              </div>
              <p className="mt-1 opacity-90">{item.desc}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}