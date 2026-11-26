/**
 * Centralized Vietnamese UI strings for FitQuest.
 * Keeping all visible text here makes it easy to translate the app later.
 */
export const i18n = {
  app: {
    title: 'FitQuest',
    metaDescription:
      'RPG vận động 5–10 phút tại bàn học cho sinh viên IT, kiểm chứng động tác bằng camera ngay trên máy.',
  },
  home: {
    title: 'FitQuest',
    description:
      'Game RPG giúp sinh viên IT tập các bài vận động ngắn 5–10 phút ngay tại bàn học với camera kiểm chứng trực tiếp trên máy bạn.',
    nameLabel: 'Tên hiển thị (không bắt buộc)',
    namePlaceholder: 'Nhập tên của bạn...',
    startButton: 'Bắt đầu chơi',
    privacyNote: 'Video không bao giờ rời khỏi máy bạn. Dữ liệu chỉ lưu tạm trong RAM.',
  },
  play: {
    placeholder: 'Camera sắp có',
    backHome: 'Quay lại trang chủ',
    playerPrefix: 'Người chơi:',
    defaultPlayer: 'Ẩn danh',
    xpPrefix: 'XP:',
  },
} as const;