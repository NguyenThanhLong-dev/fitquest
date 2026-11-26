'use client';

export type ProgressTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

export interface ProgressRingProps {
  /** Giá trị tiến độ chuẩn hóa từ 0 đến 1. */
  progress: number;
  /** Chữ chính hiển thị giữa vòng tròn (ví dụ: "75%" hoặc "1.4s"). */
  valueText: string;
  /** Chữ phụ nhỏ bên dưới giá trị chính (ví dụ: "/ 2.0s" hoặc "Tiến độ rep"). */
  subText?: string;
  /** Màu sắc theo trạng thái hiện tại. */
  tone?: ProgressTone;
  /** Kích thước vòng tròn (px). */
  size?: number;
  /** Độ dày viền vòng tròn (px). */
  strokeWidth?: number;
}

const STROKE_COLOR_BY_TONE: Record<ProgressTone, string> = {
  neutral: 'stroke-slate-400',
  info: 'stroke-sky-400',
  success: 'stroke-emerald-400',
  warning: 'stroke-amber-400',
  error: 'stroke-rose-400',
};

const TEXT_COLOR_BY_TONE: Record<ProgressTone, string> = {
  neutral: 'text-slate-100',
  info: 'text-sky-300',
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  error: 'text-rose-300',
};

/**
 * Vòng tròn tiến độ SVG nhẹ, dùng cho cả tiến độ động tác (0..100%)
 * lẫn đồng hồ giữ tư thế (1,5s hoặc 2s).
 */
export function ProgressRing({
  progress,
  valueText,
  subText,
  tone = 'info',
  size = 148,
  strokeWidth = 12,
}: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Vòng nền */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-slate-800"
        />

        {/* Vòng tiến độ */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={`transition-[stroke-dashoffset,stroke] duration-100 ease-linear ${STROKE_COLOR_BY_TONE[tone]}`}
        />
      </svg>

      {/* Giá trị hiển thị ở tâm vòng tròn */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span
          className={`font-mono text-2xl font-bold leading-none ${TEXT_COLOR_BY_TONE[tone]}`}
        >
          {valueText}
        </span>
        {subText && (
          <span className="mt-1 text-xs font-medium text-slate-400">
            {subText}
          </span>
        )}
      </div>
    </div>
  );
}