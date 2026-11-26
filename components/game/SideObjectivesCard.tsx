'use client';

import type { SideObjectiveProgress } from '@/lib/game/dungeon';
import { i18n } from '@/lib/i18n';

export interface SideObjectivesCardProps {
  objectives: readonly SideObjectiveProgress[];
}

/**
 * Thẻ hiển thị 2 mục tiêu phụ ngẫu nhiên theo seed trong lượt (thành tích hiển thị, không cộng XP).
 */
export function SideObjectivesCard({ objectives }: SideObjectivesCardProps) {
  const texts = i18n.dungeon.sideObjectives;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-white">{texts.title}</h3>
        <span className="text-[11px] text-slate-400">{texts.subtitle}</span>
      </div>

      <ul className="mt-3 space-y-2">
        {objectives.map((obj) => (
          <li
            key={obj.id}
            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
              obj.completed
                ? 'border-emerald-500/50 bg-emerald-950/50 text-emerald-100'
                : 'border-slate-800 bg-slate-950/70 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-black ${
                  obj.completed
                    ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                    : 'border-slate-600 bg-slate-900 text-transparent'
                }`}
                aria-hidden="true"
              >
                ✓
              </span>
              <span className={obj.completed ? 'font-semibold' : ''}>
                {texts.items[obj.id]}
              </span>
            </div>

            <span className="shrink-0 font-mono text-xs font-bold text-slate-300">
              {obj.current}/{obj.target}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}