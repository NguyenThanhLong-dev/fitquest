'use client';

import {
  computeCharacterStats,
  getSkillsForLevel,
  type VerifiedRepCounts,
} from '@/lib/game/dungeon';
import { i18n } from '@/lib/i18n';

export interface SkillsPanelProps {
  level: number;
  verifiedReps: VerifiedRepCounts;
}

/**
 * Bảng chỉ số nhân vật (STR/AGI/VIT/WIS tính từ verifiedReps trong RAM)
 * và danh sách kỹ năng theo level (phân biệt rõ "Hoạt động thật" vs "Sắp có").
 */
export function SkillsPanel({ level, verifiedReps }: SkillsPanelProps) {
  const stats = computeCharacterStats(verifiedReps);
  const skills = getSkillsForLevel(level);
  const statTexts = i18n.dungeon.stats;
  const skillTexts = i18n.dungeon.skills;

  const statItems = [
    { key: 'str', label: statTexts.str, value: stats.str },
    { key: 'agi', label: statTexts.agi, value: stats.agi },
    { key: 'vit', label: statTexts.vit, value: stats.vit },
    { key: 'wis', label: statTexts.wis, value: stats.wis },
  ];

  return (
    <div className="space-y-4">
      {/* 4 chỉ số nhân vật */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-sm font-bold text-white">{statTexts.title}</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {statItems.map((item) => (
            <div
              key={item.key}
              className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2"
            >
              <div className="text-[11px] text-slate-400">{item.label}</div>
              <div className="mt-0.5 font-mono text-2xl font-extrabold text-emerald-400">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Kỹ năng theo level */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-sm font-bold text-white">{skillTexts.title}</h3>
        <ul className="mt-3 space-y-2">
          {skills.map((skill) => {
            const copy = skillTexts.items[skill.id];
            return (
              <li
                key={skill.id}
                className={`rounded-xl border px-3 py-2.5 ${
                  skill.implemented
                    ? 'border-emerald-500/40 bg-emerald-950/30'
                    : skill.unlocked
                      ? 'border-slate-700 bg-slate-950/80'
                      : 'border-slate-800/80 bg-slate-950/40 opacity-75'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-xs font-bold text-white">
                    {copy.name}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        skill.implemented
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {skill.implemented
                        ? skillTexts.realBadge
                        : skillTexts.comingSoonBadge}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        skill.unlocked
                          ? 'bg-sky-500/20 text-sky-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {skill.unlocked
                        ? skillTexts.unlockedTag
                        : `${skillTexts.lockedPrefix} ${skill.requiredLevel}`}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-400">
                  {copy.desc}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}