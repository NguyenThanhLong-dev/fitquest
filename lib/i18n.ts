/**
 * Toàn bộ chuỗi giao diện tiếng Việt cho FitQuest.
 * Giữ nguyên toàn bộ khóa từ F1 và bổ sung các thông báo lỗi chi tiết cho F2.
 */
export const i18n = {
  // ── F1: Metadata toàn cục ──
  app: {
    title: 'FitQuest',
    metaDescription:
      'RPG vận động 5–10 phút tại bàn học cho sinh viên IT, kiểm chứng động tác bằng camera ngay trên máy.',
  },

  // ── F1: Trang chủ (app/page.tsx) ──
  home: {
    title: 'FitQuest',
    description:
      'Game RPG giúp sinh viên IT tập các bài vận động ngắn 5–10 phút ngay tại bàn học với camera kiểm chứng trực tiếp trên máy bạn.',
    nameLabel: 'Tên hiển thị (không bắt buộc)',
    namePlaceholder: 'Nhập tên của bạn...',
    startButton: 'Bắt đầu chơi',
    privacyNote:
      'Video không bao giờ rời khỏi máy bạn. Dữ liệu chỉ lưu tạm trong RAM.',
  },

  // ── F1 + F2: Trang chơi, CameraView và usePoseLandmarker ──
  play: {
    // Khóa giữ nguyên từ F1
    placeholder: 'Camera sắp có',
    backHome: 'Quay lại trang chủ',
    playerPrefix: 'Người chơi:',
    defaultPlayer: 'Ẩn danh',
    xpPrefix: 'XP:',

    // Khóa dùng chung trên /play
    title: 'Phòng tập AI',
    privacyNotice:
      'Video xử lý hoàn toàn trên máy bạn — không bao giờ gửi qua mạng.',
    retryButton: 'Thử lại',
    errorDetailPrefix: 'Chi tiết lỗi gốc:',

    // Thông báo lỗi camera (components/CameraView.tsx)
    camera: {
      starting: 'Đang mở camera...',
      unsupported:
        'Trình duyệt không hỗ trợ camera hoặc trang chưa chạy trên localhost / HTTPS.',
      permissionDenied:
        'Bạn đã chặn quyền truy cập camera. Hãy bấm biểu tượng ổ khóa hoặc camera trên thanh địa chỉ trình duyệt để cho phép, rồi bấm "Thử lại".',
      notFound:
        'Không tìm thấy camera trên thiết bị. Hãy kiểm tra lại kết nối webcam rồi bấm "Thử lại".',
      inUse:
        'Camera đang được ứng dụng khác sử dụng (ví dụ: Zoom, Google Meet, MS Teams). Hãy tắt ứng dụng đó rồi bấm "Thử lại".',
      genericError:
        'Không thể khởi động camera. Hãy kiểm tra thiết bị và quyền truy cập rồi thử lại.',
    },

    // Thông báo tải và khởi tạo mô hình AI (lib/pose/usePoseLandmarker.ts)
    model: {
      loading: 'Đang tải mô hình AI nhận diện tư thế từ máy (MediaPipe Lite)...',
      ready: 'AI sẵn sàng',
      loadError:
        'Không thể tải mô hình AI. Hãy kiểm tra các file trong thư mục public/wasm và public/models rồi thử lại.',
      assetLoadError:
        'Không tải được file WASM hoặc file mô hình AI. Hãy kiểm tra xem các file đã có đúng trong thư mục public/wasm và public/models hay chưa, sau đó bấm "Thử lại".',
      initFailedError:
        'Không thể khởi tạo mô hình AI trên cả GPU lẫn CPU. Hãy kiểm tra trình duyệt có hỗ trợ WebAssembly/WebGL không rồi thử lại.',
    },

    // Nhãn HUD trên khung camera (app/play/page.tsx)
    hud: {
      poseDetected: 'Đang theo dõi khung xương',
      noPose: 'Chưa thấy người trong khung hình',
      fpsUnit: 'FPS',
    },
  },
} as const;