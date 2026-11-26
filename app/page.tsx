'use client';

import Link from 'next/link';
import { useGameStore } from '@/lib/game/store';
import { getXpProgressInfo } from '@/lib/game/engineAdapter';
import { i18n } from '@/lib/i18n';

/**
 * Trang chủ ("/").
 * - Nhập tên hiển thị tùy chọn (lưu trong Zustand RAM, không localStorage).
 * - Hiển thị cấp độ & XP hiện tại của phiên, kèm nút vào Dungeon Run và Chế độ luyện tập.
 * - Có dòng nhắc rõ ràng: "Tải lại trang sẽ mất tiến độ".
 */
export default function HomePage() {
  const displayName = useGameStore((state) => state.displayName);
  const setDisplayName = useGameStore((state) => state.setDisplayName);
  const totalXp = useGameStore((state) => state.totalXp);
  const xpInfo = getXpProgressInfo(totalXp);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        {/* Tiêu đề game và mô tả ngắn */}
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-black tracking-tight text-emerald-400">
            {i18n.home.title}
          </h1>
          <p className="text-sm leading-relaxed text-slate-300">
            {i18n.home.description}
          </p>
        </div>

        {/* Trạng thái nhân vật tạm trong RAM (Cấp độ + XP) */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs">
          <span className="font-semibold text-slate-300">
            {i18n.home.levelPrefix}{' '}
            <strong className="font-mono text-base text-emerald-400">
              {xpInfo.level}
            </strong>
          </span>
          <span className="font-mono text-slate-300">
            {xpInfo.xp} / {xpInfo.cap} {i18n.home.xpUnit}
          </span>
        </div>

        {/* Ô nhập tên hiển thị tùy chọn (lưu trong Zustand) */}
        <div className="space-y-2">
          <label
            htmlFor="display-name"
            className="block text-sm font-medium text-slate-200"
          >
            {i18n.home.nameLabel}
          </label>
          <input
            id="display-name"
            type="text"
            maxLength={30}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={i18n.home.namePlaceholder}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
          />
        </div>

        {/* Nút vào Dungeon Run (chính) và Chế độ luyện tập tự do (F4) */}
        <div className="space-y-2.5">
          <Link
            href="/play"
            className="block w-full rounded-xl bg-emerald-500 px-5 py-3.5 text-center text-base font-extrabold text-slate-950 transition hover:bg-emerald-400"
          >
            {i18n.home.startButton}
          </Link>

          <Link
            href="/play?mode=practice"
            className="block w-full rounded-xl border border-slate-700 bg-slate-950 px-5 py-2.5 text-center text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            {i18n.home.practiceButton}
          </Link>
        </div>

        {/* Ghi chú quyền riêng tư và cảnh báo không lưu dữ liệu */}
        <div className="space-y-1 text-center text-xs text-slate-400">
          <p>{i18n.home.privacyNote}</p>
          <p className="font-medium text-amber-300/90">
            {i18n.home.reloadLossNotice}
          </p>
        </div>
      </div>
    </main>
  );
}