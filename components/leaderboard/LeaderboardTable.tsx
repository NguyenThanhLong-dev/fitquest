'use client';

import { memo } from 'react';
import type { LeaderboardEntry } from '@/lib/game/leaderboard';
import { i18n } from '@/lib/i18n';

export interface LeaderboardTableProps {
  /** Danh sách đã sắp xếp giảm dần theo điểm tuần. */
  rows: readonly LeaderboardEntry[];
  /** True khi hạng của người chơi vừa thay đổi để bật điểm nhấn ngắn trên dòng của mình. */
  highlightRankPulse: boolean;
}

/** Huy hiệu cho Top 3; các hạng dưới hiện số thứ tự rõ ràng. */
function renderRankBadge(rank: number) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-amber-400/60 bg-amber-500/20 px-2.5 py-0.5 font-mono text-sm font-black text-amber-200">
        <span aria-hidden="true">🥇</span>
        <span>#1</span>
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-slate-300/50 bg-slate-300/15 px-2.5 py-0.5 font-mono text-sm font-black text-slate-100">
        <span aria-hidden="true">🥈</span>
        <span>#2</span>
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-orange-400/50 bg-orange-500/20 px-2.5 py-0.5 font-mono text-sm font-black text-orange-200">
        <span aria-hidden="true">🥉</span>
        <span>#3</span>
      </span>
    );
  }

  return (
    <span className="inline-block min-w-[2.5rem] text-center font-mono text-sm font-bold text-slate-400">
      #{rank}
    </span>
  );
}

/**
 * Bảng xếp hạng tuần minh họa:
 * - Gắn nhãn rõ "Dữ liệu minh họa (demo data)" ở đầu bảng.
 * - Đánh dấu người chơi giả bằng biểu tượng 🤖 + nhãn "Demo".
 * - Tô nổi bật dòng người chơi thật; bọc React.memo để chỉ render lại khi danh sách điểm thay đổi.
 */
export const LeaderboardTable = memo(function LeaderboardTable({
  rows,
  highlightRankPulse,
}: LeaderboardTableProps) {
  const texts = i18n.leaderboard;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
      {/* Nhãn minh họa ở đầu bảng */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/80 px-4 py-3.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-0.5 text-xs font-extrabold text-amber-200">
            🤖 {texts.demoBannerBadge}
          </span>
          <span className="text-xs text-slate-400">{texts.demoBannerDesc}</span>
        </div>
      </div>

      {/* Bảng dữ liệu tương thích tốt cả màn hình điện thoại */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-800/90 bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="py-3 pl-4 pr-2 sm:pl-6">{texts.table.rankCol}</th>
              <th className="px-2 py-3">{texts.table.playerCol}</th>
              <th className="py-3 pl-2 pr-4 text-right sm:pr-6">
                {texts.table.scoreCol}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/70">
            {rows.map((row) => {
              const rowClass = row.isPlayer
                ? `bg-emerald-500/15 text-white ring-1 ring-inset ring-emerald-400/60 transition-colors duration-300 ${
                    highlightRankPulse ? 'bg-emerald-500/25' : ''
                  }`
                : 'text-slate-200 hover:bg-slate-800/40 transition-colors';

              return (
                <tr key={row.id} className={rowClass}>
                  {/* Hạng + huy hiệu Top 3 */}
                  <td className="whitespace-nowrap py-3 pl-4 pr-2 sm:pl-6">
                    {renderRankBadge(row.rank)}
                  </td>

                  {/* Tên người chơi + nhãn BẠN hoặc biểu tượng Demo */}
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {row.isDemo ? (
                        <span
                          className="text-base leading-none opacity-80"
                          title={texts.demoBannerBadge}
                          aria-hidden="true"
                        >
                          🤖
                        </span>
                      ) : (
                        <span
                          className="text-base leading-none"
                          aria-hidden="true"
                        >
                          ⚔️
                        </span>
                      )}

                      <span
                        className={`text-sm sm:text-base ${
                          row.isPlayer
                            ? 'font-black text-emerald-200'
                            : 'font-semibold text-slate-200'
                        }`}
                      >
                        {row.name}
                      </span>

                      {row.isPlayer ? (
                        <span className="rounded-md bg-emerald-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-950">
                          {texts.youBadge}
                        </span>
                      ) : (
                        <span className="rounded border border-slate-700 bg-slate-950/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                          {texts.demoBadge}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Điểm tuần */}
                  <td className="whitespace-nowrap py-3 pl-2 pr-4 text-right sm:pr-6">
                    <span
                      className={`font-mono text-sm font-extrabold sm:text-base ${
                        row.isPlayer ? 'text-emerald-300' : 'text-slate-100'
                      }`}
                    >
                      {row.score}
                    </span>{' '}
                    <span className="text-[11px] text-slate-400">
                      {texts.pointsUnit}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dòng nói thật về giới hạn bản prototype ở cuối bảng */}
      <div className="border-t border-slate-800 bg-slate-950/60 px-4 py-3 text-center text-xs text-slate-400 sm:px-6">
        {texts.honestDisclaimer}
      </div>
    </section>
  );
});