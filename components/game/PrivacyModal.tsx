'use client';

import { i18n } from '@/lib/i18n';

export interface PrivacyModalProps {
  onClose: () => void;
}

/**
 * Khung "Quyền riêng tư" mô tả chính xác những gì code hiện tại đang làm:
 * - Xử lý video cục bộ trong trình duyệt, không gửi ảnh ra mạng, không ghi hình, không lưu dữ liệu.
 * - Nêu trung thực giới hạn của bản prototype chạy trên trình duyệt.
 */
export function PrivacyModal({ onClose }: PrivacyModalProps) {
  const texts = i18n.privacy;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fitquest-privacy-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-5"
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 bg-slate-950/70 px-5 py-4 sm:px-6">
          <span className="inline-block rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
            🔒 {texts.badge}
          </span>
          <h2
            id="fitquest-privacy-title"
            className="mt-1 text-xl font-black tracking-tight text-white sm:text-2xl"
          >
            {texts.title}
          </h2>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
          <ul className="space-y-2.5">
            {texts.points.map((point) => (
              <li
                key={point.title}
                className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5"
              >
                <span className="text-xl leading-none" aria-hidden="true">
                  {point.icon}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {point.title}
                  </h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
                    {point.desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-3.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-amber-300">
              {texts.honestLimitTitle}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-amber-100/90">
              {texts.honestLimitDesc}
            </p>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-800 bg-slate-950/70 px-5 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-400"
          >
            {texts.closeButton}
          </button>
        </div>
      </div>
    </div>
  );
}