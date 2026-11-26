'use client';

import type { LevelUpCelebration } from '@/lib/pose/useDungeonRun';
import { i18n } from '@/lib/i18n';
import './dungeon-fx.css';

export interface LevelUpBannerProps {
  celebration: LevelUpCelebration;
  reducedFx: boolean;
}

/**
 * Màn chúc mừng lên cấp hiển thị ngắn (< 2 giây, tự ẩn) ở phía trên màn hình,
 * thông báo cấp độ mới và danh sách kỹ năng vừa mở khóa (nếu có).
 */
export function LevelUpBanner({ celebration, reducedFx }: LevelUpBannerProps) {
  const texts = i18n.dungeon.levelUp;
  const skillTexts = i18n.dungeon.skills;

  return (
    <div
      key={celebration.seq}
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 top-5 z-40 flex justify-center px-4 ${
        reducedFx ? 'fq-reduced-fx' : ''
      }`}
    >
      <div className="fq-level-up w-full max-w-md rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-950/95 via-slate-950/95 to-slate-900/95 px-6 py-4 text-center shadow-2xl backdrop-blur">
        <span className="inline-block rounded-full bg-amber-400 px-3 py-0.5 text-xs font-black tracking-widest text-slate-950">
          ⭐ {texts.badge}
        </span>

        <h3 className="mt-1.5 text-3xl font-black tracking-tight text-white">
          {texts.levelPrefix} {celebration.newLevel}
        </h3>

        {celebration.unlockedSkills.length > 0 ? (
          <div className="mt-2.5 space-y-1 rounded-xl border border-amber-400/40 bg-slate-950/80 px-3 py-2 text-xs text-amber-100">
            <p className="font-bold text-amber-300">
              {texts.unlockedSkillsPrefix}
            </p>
            <ul className="space-y-0.5">
              {celebration.unlockedSkills.map((skill) => (
                <li key={skill.id} className="font-semibold text-white">
                  • {skillTexts.items[skill.id].name}{' '}
                  <span className="text-[11px] font-normal text-slate-300">
                    (
                    {skill.implemented
                      ? skillTexts.realBadge
                      : skillTexts.comingSoonBadge}
                    )
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-1 text-xs font-medium text-amber-200/90">
            {texts.noNewSkills}
          </p>
        )}
      </div>
    </div>
  );
}