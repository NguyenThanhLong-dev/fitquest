'use client';

import { i18n } from '@/lib/i18n';

export interface GuideModalProps {
  onClose: () => void;
}

/**
 * Màn hướng dẫn ngắn gọn (mở lần đầu vào /play và mở lại bất cứ lúc nào từ nút "?"):
 * - Cách đặt camera (Đứng & Ngồi).
 * - 5 động tác (mô tả 1 dòng + emoji nội bộ, không tải ảnh).
 * - Cách tính rep, thử thách sống và lý do giới hạn 600 XP mỗi lần mở trang.
 * - Có nút "Bỏ qua" rõ ràng và cuộn mượt trên màn hình điện thoại.
 */
export function GuideModal({ onClose }: GuideModalProps) {
  const texts = i18n.guide;
  const s = texts.sections;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fitquest-guide-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-5"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Đầu modal + nút Bỏ qua */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 bg-slate-950/70 px-5 py-4 sm:px-6">
          <div>
            <span className="inline-block rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              {texts.badge}
            </span>
            <h2
              id="fitquest-guide-title"
              className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl"
            >
              {texts.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 cursor-pointer rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-200 transition hover:bg-slate-800 sm:text-sm"
          >
            {texts.skipButton}
          </button>
        </div>

        {/* Nội dung cuộn được trên điện thoại */}
        <div className="space-y-4 overflow-y-auto px-5 py-4 text-sm text-slate-200 sm:px-6">
          {/* 1. Cách đặt camera */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <h3 className="text-sm font-extrabold text-emerald-300">
              📷 {s.cameraTitle}
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-300 sm:text-sm">
              <li>• {s.cameraStanding}</li>
              <li>• {s.cameraSeated}</li>
            </ul>
          </section>

          {/* 2. 5 động tác (minh họa emoji nội bộ, 1 dòng/động tác) */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-extrabold text-emerald-300">
                ⚔️ {s.exercisesTitle}
              </h3>
              <span className="text-[11px] text-sky-300">
                {s.exercisesNoteSeated}
              </span>
            </div>

            <ul className="mt-2.5 space-y-2">
              {s.exercisesList.map((ex) => (
                <li
                  key={ex.id}
                  className="flex items-start gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/80 px-3 py-2 text-xs sm:text-sm"
                >
                  <span
                    className="mt-0.5 text-lg leading-none"
                    aria-hidden="true"
                  >
                    {ex.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-white">{ex.name}:</span>{' '}
                    <span className="text-slate-300">{ex.oneLiner}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* 3. Cách tính rep */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <h3 className="text-sm font-extrabold text-emerald-300">
              ⏱️ {s.repRuleTitle}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300 sm:text-sm">
              {s.repRuleDesc}
            </p>
          </section>

          {/* 4. Thử thách sống & 5. Giới hạn 600 XP */}
          <div className="grid gap-3 sm:grid-cols-2">
            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <h3 className="text-sm font-extrabold text-amber-300">
                ✋ {s.livenessTitle}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                {s.livenessDesc}
              </p>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <h3 className="text-sm font-extrabold text-sky-300">
                🛡️ {s.xpCapTitle}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                {s.xpCapDesc}
              </p>
            </section>
          </div>
        </div>

        {/* Chân modal với nút bấm lớn dễ chạm */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-800 bg-slate-950/70 px-5 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            {texts.skipButton}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-400"
          >
            {texts.startButton}
          </button>
        </div>
      </div>
    </div>
  );
}