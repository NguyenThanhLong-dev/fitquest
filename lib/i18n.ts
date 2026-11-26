import type {
  ChallengeId,
  ExerciseId,
  GateReason,
  Rarity,
  Verdict,
} from '@/lib/pose-engine';
import type { CosmeticItemId, CosmeticSlot } from '@/lib/game/cosmetics';

/**
 * Toàn bộ chuỗi giao diện tiếng Việt cho FitQuest (F1 + F2 + F3 + F4 + F5a + F5b + F7 + F8).
 * Giữ nguyên toàn bộ khóa cũ và bổ sung đầy đủ chuỗi cho Chế độ ngồi, Hướng dẫn, Quyền riêng tư và nút Tắt camera.
 */
export const i18n = {
  // ── F1: Metadata toàn cục ──
  app: {
    title: 'FitQuest',
    metaDescription:
      'RPG vận động 5–10 phút tại bàn học cho sinh viên IT, kiểm chứng động tác bằng camera ngay trên máy.',
  },

  // ── F1 + F5a + F5b + F7 + F8: Trang chủ (app/page.tsx) ──
  home: {
    title: 'FitQuest',
    dungeonTag: 'Hầm Ngục Vận Động · Local AI',
    storyLine: 'Hang động Cứng Cổ đang chờ bạn…',
    description:
      'Đánh bại quái vật bằng chính chuyển động của bạn trong 5–10 phút ngay tại bàn học, kiểm chứng bằng camera trên máy.',
    nameLabel: 'Tên hiệp sĩ (không bắt buộc)',
    namePlaceholder: 'Nhập tên của bạn...',
    startButton: 'Bắt đầu Dungeon Run',
    practiceButton: 'Chế độ luyện tập tự do',
    leaderboardButton: 'Bảng xếp hạng tuần (Demo)',
    privacyButton: 'Quyền riêng tư',
    guideButton: 'Hướng dẫn nhanh',
    privacyNote: 'Video không bao giờ rời khỏi máy bạn.',
    reloadLossNotice: 'Tải lại trang sẽ mất tiến độ',
    levelPrefix: 'Cấp',
    xpUnit: 'XP',
    cosmeticCountPrefix: 'Trang bị đã mở:',
  },

  // ── F8: Chế độ tư thế Đứng / Ngồi ──
  posture: {
    label: 'Tư thế tập',
    standing: 'Đứng',
    seated: 'Ngồi',
    standingShortDesc: 'Đủ 5 động tác (gồm Squat & Nâng gối).',
    seatedShortDesc:
      'Chỉ 3 bài giãn cơ tại bàn: Vươn vai, Nghiêng người, Nghiêng cổ.',
    seatedSetupGuide:
      'Mẹo chế độ Ngồi: đặt webcam ngang tầm ngực–vai, ngồi cách khoảng 60–80cm, thấy rõ cả hai vai và hai tay khi giơ lên.',
    seatedBadge: 'Chế độ Ngồi (Thân trên)',
  },

  // ── F8: Màn hướng dẫn nhanh (GuideModal) ──
  guide: {
    openButtonTitle: 'Mở hướng dẫn',
    badge: 'Hướng dẫn nhanh · 30 giây',
    title: 'Chào mừng đến với FitQuest!',
    skipButton: 'Bỏ qua',
    startButton: 'Đã hiểu, bắt đầu thôi!',
    sections: {
      cameraTitle: '1. Cách đặt camera',
      cameraStanding:
        'Chế độ Đứng: lùi cách webcam ~1,5–2m để thấy rõ vai, hông và đầu gối (Squat không cần thấy cổ chân).',
      cameraSeated:
        'Chế độ Ngồi: đặt webcam ngang tầm ngực–vai, ngồi cách khoảng 60–80cm, thấy rõ cả hai vai và hai tay khi giơ lên.',
      exercisesTitle: '2. 5 động tác trong game',
      exercisesNoteSeated: 'Ở chế độ Ngồi, game tự ẩn Squat & Nâng gối.',
      exercisesList: [
        {
          id: 'squat' as ExerciseId,
          emoji: '🏋️',
          name: 'Squat',
          oneLiner: 'Hạ hông xuống sâu rồi đứng thẳng lên (đứng, chỉ cần vai–hông–gối).',
        },
        {
          id: 'overhead_reach' as ExerciseId,
          emoji: '🙌',
          name: 'Vươn vai',
          oneLiner: 'Vươn hai tay cao quá đầu và giữ liên tục 2 giây (ngồi/đứng).',
        },
        {
          id: 'side_bend' as ExerciseId,
          emoji: '🤸',
          name: 'Nghiêng người',
          oneLiner: 'Nghiêng thân trên sang một bên và giữ liên tục 1,5 giây (ngồi/đứng).',
        },
        {
          id: 'neck_tilt' as ExerciseId,
          emoji: '🧘',
          name: 'Nghiêng cổ',
          oneLiner: 'Nghiêng nhẹ đầu sang bên, thả lỏng vai và giữ 2 giây (ngồi/đứng).',
        },
        {
          id: 'high_knees' as ExerciseId,
          emoji: '🏃',
          name: 'Nâng gối',
          oneLiner: 'Nâng luân phiên đầu gối cao ngang hông rồi hạ xuống (đứng).',
        },
      ],
      repRuleTitle: '3. Cách tính rep',
      repRuleDesc:
        'Động tác động (Squat, Nâng gối) tính khi xuống rồi lên đủ chu kỳ. Động tác giữ (Vươn vai, Nghiêng người, Nghiêng cổ) tính NGAY khi giữ liên tục đủ thời gian (1,5s hoặc 2s), thả lỏng sau đó không bị hủy rep.',
      livenessTitle: '4. Thử thách sống là gì?',
      livenessDesc:
        'Mỗi lượt có 0–2 lần ngẫu nhiên hiện lời nhắc "Giơ tay trái/phải lên" trong 5 giây (giữ cao hơn vai 0,5s). Bộ đếm rep tạm dừng khi thử thách hiện, giúp xác nhận có người thật đang tập.',
      xpCapTitle: '5. Vì sao XP giới hạn 600 mỗi lần mở trang?',
      xpCapDesc:
        'Để khuyến khích bạn tập vừa sức 5–10 phút giữa giờ code và tránh cày gian lận. Chạm 600 XP bạn vẫn có thể tập tự do, nhưng hệ thống sẽ nhắc nghỉ ngơi.',
    },
  },

  // ── F8: Khung Quyền riêng tư (PrivacyModal & dòng xin camera) ──
  privacy: {
    buttonLabel: 'Quyền riêng tư',
    badge: 'Minh bạch · Xử lý cục bộ 100%',
    title: 'Quyền riêng tư & Dữ liệu trong FitQuest',
    cameraRequestLine:
      'Video xử lý hoàn toàn trong trình duyệt của bạn — không gửi đi đâu, không ghi hình, không lưu dữ liệu.',
    closeButton: 'Đã hiểu',
    points: [
      {
        icon: '🖥️',
        title: 'Xử lý trực tiếp trên trình duyệt',
        desc: 'Khung hình webcam được MediaPipe đọc ngay trong RAM trình duyệt bằng file cục bộ (/wasm và /models).',
      },
      {
        icon: '🚫',
        title: 'Không gửi hình ảnh qua mạng',
        desc: 'Ứng dụng không có máy chủ backend và không gửi bất kỳ ảnh, video hay tọa độ khớp nào ra mạng ngoài.',
      },
      {
        icon: '🎞️',
        title: 'Không ghi hình, không chụp ảnh',
        desc: 'Camera chỉ phát trực tiếp để AI đếm rep. Khi bạn bấm "Tắt camera" hoặc rời trang, toàn bộ luồng camera được dừng ngay lập tức.',
      },
      {
        icon: '🧹',
        title: 'Không lưu dữ liệu cá nhân',
        desc: 'Không dùng localStorage, cookies hay cơ sở dữ liệu. Tải lại trang sẽ xóa sạch tên, XP, trang bị và điểm tuần.',
      },
    ],
    honestLimitTitle: 'Giới hạn trung thực của bản prototype',
    honestLimitDesc:
      'Vì chạy hoàn toàn trên trình duyệt để bảo vệ quyền riêng tư và dễ chạy thử nội bộ, hệ thống không thể chống gian lận tuyệt đối (người dùng am hiểu có thể sửa bộ nhớ bằng DevTools). Sản phẩm thực tế cần máy chủ xác thực.',
  },

  // ── F1 + F2 + F3 + F4 + F8: Trang chơi, camera, AI, luyện tập & thử thách sống ──
  play: {
    placeholder: 'Camera sắp có',
    backHome: 'Quay lại trang chủ',
    playerPrefix: 'Người chơi:',
    defaultPlayer: 'Ẩn danh',
    xpPrefix: 'XP:',

    title: 'FitQuest',
    privacyNotice:
      'Video xử lý hoàn toàn trên máy bạn — không gửi qua mạng, không ghi hình, không lưu dữ liệu.',
    retryButton: 'Thử lại',
    errorDetailPrefix: 'Chi tiết lỗi gốc:',

    modeTabs: {
      dungeon: 'Dungeon Run',
      practice: 'Chế độ luyện tập',
    },

    camera: {
      starting: 'Đang mở camera...',
      turnOffButton: 'Tắt camera',
      turnOnButton: 'Bật camera',
      offTitle: 'Camera đang tắt',
      offDesc:
        'Đèn camera đã tắt và không có khung hình nào được xử lý. Bấm "Bật camera" khi bạn sẵn sàng tiếp tục tập.',
      unsupported:
        'Trình duyệt không hỗ trợ camera hoặc trang chưa chạy trên localhost / HTTPS.',
      permissionDenied:
        'Bạn đã chặn quyền truy cập camera. Hãy bấm biểu tượng ổ khóa hoặc camera trên thanh địa chỉ trình duyệt để chọn "Cho phép", rồi bấm "Thử lại".',
      notFound:
        'Không tìm thấy webcam trên thiết bị này. Hãy kiểm tra lại dây cắm hoặc cài đặt camera trong hệ thống rồi bấm "Thử lại".',
      inUse:
        'Camera đang được ứng dụng khác sử dụng (ví dụ: Zoom, Google Meet, MS Teams). Hãy tắt ứng dụng đó rồi bấm "Thử lại".',
      overconstrained:
        'Webcam không hỗ trợ độ phân giải yêu cầu. Hãy thử lại hoặc kiểm tra trình điều khiển camera.',
      securityError:
        'Trình duyệt chặn mở camera vì trang không chạy trên địa chỉ an toàn (localhost hoặc HTTPS).',
      genericError:
        'Không thể khởi động camera. Hãy kiểm tra thiết bị và quyền truy cập rồi thử lại.',
    },

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

    hud: {
      poseDetected: 'Đang theo dõi khung xương',
      noPose: 'Chưa thấy người trong khung hình',
      fpsUnit: 'FPS',
    },

    practice: {
      modeBadge: 'Chế độ luyện tập',
      chooseExerciseLabel: 'Chọn động tác luyện tập',
      resetButton: 'Đặt lại bộ đếm',
      repCountLabel: 'Số rep đã tính',
      progressLabel: 'Tiến độ rep',
      holdProgressLabel: 'Thời gian giữ',
      reachPoseBarLabel: 'Độ vào tư thế giữ',
      qualityLabel: 'Chất lượng rep vừa xong (0–1)',
      qualityEmpty: 'Chưa có rep nào',
      repCountedBadge: 'Đã tính',
      repRejectedBadge: 'Không tính',
      formHintLabel: 'Gợi ý form theo thời gian thực',
      bodyScopeFull: 'Cần thấy thân & chân',
      bodyScopeSquat: 'Chỉ cần thấy vai, hông và gối (không cần cổ chân)',
      bodyScopeTorso: 'Cần thấy rõ cả vai và hông (lùi nhẹ nếu bị khuất hông)',
      bodyScopeUpper: 'Chỉ cần thấy thân trên (ngồi cách 60–80cm)',
      holdUnit: 's',

      status: {
        waitingCamera: 'Đang chờ camera và AI sẵn sàng...',
        cameraOff: 'Camera đang tắt. Bấm "Bật camera" để tiếp tục.',
        holding: 'Giữ nguyên tư thế...',
        holdComplete: 'Đã tính rep! Thả lỏng về tư thế nghỉ để tập rep tiếp theo',
        awaitingRest: 'Đã xong rep — hãy thả lỏng về tư thế nghỉ trước khi tập tiếp',
        startFromRest:
          'Hãy đứng/ngồi thẳng về tư thế nghỉ 1 nhịp rồi mới vào động tác giữ',
        repCancelledTitle: 'Rep đang tập đã bị hủy',
        poseLostTitle: 'Tạm dừng đếm (khung hình chưa đạt)',
        challengePaused: 'Đang tạm dừng đếm rep để thực hiện thử thách sống...',
        runEnded: 'Lượt tập thử đã kết thúc. Bấm "Bắt đầu lượt tập thử" để tập lượt mới.',
        countedGood: 'Rep chuẩn! Tiếp tục giữ nhịp',
        countedWithNotePrefix: 'Đã tính rep — lưu ý:',
        rejectedPrefix: 'Chưa tính rep:',
        unknownIssue: 'Động tác chưa đạt yêu cầu, hãy thử lại',
      },

      gateReasons: {
        NO_POSE: 'Không thấy người trong khung hình. Hãy đứng hoặc ngồi vào trước camera.',
        LOW_VISIBILITY:
          'Thiếu khớp bắt buộc hoặc ánh sáng yếu. Hãy bật thêm đèn và để lộ rõ đủ khớp cần thiết.',
        OUT_OF_FRAME:
          'Khớp bắt buộc đang sát mép hoặc ra ngoài khung hình. Hãy căn lại vị trí ở giữa camera.',
        TOO_FAR: 'Bạn đang đứng quá xa camera (thân quá nhỏ). Hãy tiến lại gần hơn.',
      } satisfies Record<GateReason, string>,

      exercises: {
        squat: {
          name: 'Squat',
          meta: 'Vai–hông–gối · Động tác động',
          scope: 'squat',
          readyCue: 'Tư thế tốt — bắt đầu hạ hông squat rồi đứng thẳng lên',
          depthCue: 'Hạ thấp hông thêm',
          peakCue: 'Đạt độ sâu! Đứng thẳng về tư thế nghỉ',
          notDeepEnough: 'Hạ thấp hông thêm',
        },
        overhead_reach: {
          name: 'Vươn vai',
          meta: 'Thân trên · Giữ 2s',
          scope: 'upper',
          readyCue: 'Tư thế tốt — vươn hai tay cao quá đầu và giữ liên tục 2 giây',
          depthCue: 'Đưa cả hai tay cao hơn quá đầu',
          peakCue: 'Giữ nguyên hai tay trên đầu...',
          notDeepEnough: 'Đưa hai tay cao quá đầu thêm',
        },
        side_bend: {
          name: 'Nghiêng người',
          meta: 'Thân trên · Giữ 1,5s',
          scope: 'torso',
          readyCue:
            'Ngồi hoặc đứng thẳng, sau đó nghiêng thân sang một bên và giữ liên tục 1,5 giây',
          depthCue: 'Nghiêng người thêm một chút',
          peakCue: 'Giữ nguyên tư thế nghiêng...',
          notDeepEnough: 'Nghiêng người thêm một chút',
        },
        neck_tilt: {
          name: 'Nghiêng cổ',
          meta: 'Thân trên · Giữ 2s',
          scope: 'upper',
          readyCue: 'Tư thế tốt — nghiêng nhẹ đầu sang bên và giữ liên tục 2 giây',
          depthCue: 'Nghiêng cổ thêm một chút',
          peakCue: 'Giữ nguyên cổ nghiêng...',
          notDeepEnough: 'Nghiêng cổ thêm một chút',
        },
        high_knees: {
          name: 'Nâng gối',
          meta: 'Toàn thân · Động tác động',
          scope: 'full',
          readyCue: 'Tư thế tốt — nâng luân phiên đầu gối lên cao',
          depthCue: 'Nâng đầu gối cao hơn ngang hông',
          peakCue: 'Đạt độ cao! Hạ chân về tư thế nghỉ',
          notDeepEnough: 'Nâng đầu gối cao hơn',
        },
      } satisfies Record<
        ExerciseId,
        {
          name: string;
          meta: string;
          scope: 'full' | 'squat' | 'torso' | 'upper';
          readyCue: string;
          depthCue: string;
          peakCue: string;
          notDeepEnough: string;
        }
      >,

      formChecks: {
        TORSO_UPRIGHT: 'Giữ lưng thẳng hơn',
        HIPS_LEVEL: 'Giữ hông tương đối cân bằng',
        BOTH_WRISTS_UP: 'Đưa cả hai tay cao quá đầu',
        SHOULDERS_LEVEL: 'Giữ vai tương đối ngang',
      } as Record<string, string>,

      repFlags: {
        TOO_FAST: 'Chậm lại, kiểm soát động tác tốt hơn',
        TOO_SLOW: 'Thực hiện dứt khoát hơn (quá lâu)',
        HOLD_TOO_SHORT: 'Giữ liên tục đủ thời gian yêu cầu',
        JITTER: 'Di chuyển mượt và ổn định hơn',
        TELEPORT: 'Chuyển động quá đột ngột, hãy tập chậm lại',
        FORM_TORSO_UPRIGHT: 'Giữ lưng thẳng hơn',
        FORM_HIPS_LEVEL: 'Giữ hông tương đối cân bằng',
        FORM_BOTH_WRISTS_UP: 'Đưa cả hai tay cao quá đầu',
        FORM_SHOULDERS_LEVEL: 'Giữ vai tương đối ngang',
      } as Record<string, string>,

      frameCheck: {
        title: 'Kiểm tra khung hình',
        readyBadge: 'Sẵn sàng',
        notReadyBadge: 'Chưa đạt',
        stabilizingBadge: 'Đang ổn định...',
        readyMessage: 'Khung hình đạt chuẩn — có thể bắt đầu đếm rep.',
        readyMessageSeated:
          'Khung hình thân trên đạt chuẩn — bắt đầu giãn cơ tại bàn nào!',
        reasons: {
          NO_POSE: 'Không thấy người trong khung hình. Hãy ngồi hoặc đứng vào trước camera.',
          LOW_VISIBILITY:
            'Thiếu khớp bắt buộc (độ tin cậy < 0,6). Hãy bật thêm đèn và để lộ rõ các khớp cần kiểm tra.',
          OUT_OF_FRAME:
            'Khớp bắt buộc đang sát mép hoặc ra ngoài khung hình. Hãy lùi nhẹ và căn lại vị trí ở giữa khung.',
          TOO_FAR:
            'Bạn đang đứng quá xa camera (thân quá nhỏ trong khung). Hãy tiến lại gần hơn.',
          TOO_CLOSE:
            'Bạn đang đứng quá gần camera. Hãy lùi ra xa một chút để thấy rõ cơ thể.',
        },
        seatedReasons: {
          NO_POSE: 'Chưa thấy bạn trước webcam. Hãy ngồi vào giữa khung hình.',
          LOW_VISIBILITY:
            'Thiếu khớp thân trên (vai, mặt hoặc tay khi giơ lên). Hãy chỉnh webcam ngang tầm ngực–vai và bật thêm đèn.',
          OUT_OF_FRAME:
            'Vai hoặc tay đang sát mép khung hình. Hãy ngồi cách webcam khoảng 60–80cm để thấy rõ cả hai vai và tay.',
          TOO_FAR:
            'Bạn đang ngồi quá xa webcam (vai quá nhỏ). Hãy ngồi lại gần khoảng 60–80cm.',
          TOO_CLOSE:
            'Bạn đang ngồi quá gần webcam (vai quá lớn). Hãy lùi ghế ra khoảng 60–80cm để thấy rõ cả hai vai và hai tay.',
        },
      },

      liveness: {
        runTitle: 'Lượt tập thử (Run)',
        runActiveBadge: 'Đang trong lượt',
        runEndedBadge: 'Đã kết thúc lượt',
        startNewRunButton: 'Bắt đầu lượt tập thử',
        restartRunButton: 'Lượt tập thử mới',
        endRunButton: 'Kết thúc lượt',
        statsLabel: 'Thử thách sống (tạm lưu RAM)',
        passedLabel: 'Đạt',
        failedLabel: 'Thất bại',
        scheduledLabel: 'Theo lịch lượt này',
        runRepsLabel: 'Rep hợp lệ trong lượt',
        modalBadge: 'Thử thách sống · Đang tạm dừng đếm rep',
        prompts: {
          RAISE_LEFT_HAND: 'Giơ tay trái lên',
          RAISE_RIGHT_HAND: 'Giơ tay phải lên',
        } satisfies Record<ChallengeId, string>,
        holdInstruction: 'Giơ 1 tay cao hơn vai và giữ liên tục 0,5 giây (hạ tay còn lại).',
        countdownLabel: 'Còn lại',
        holdBarLabel: 'Giữ tư thế',
        outcomePassed: 'Vượt qua thử thách sống! Tiếp tục lượt tập.',
        outcomeFailed: 'Hết giờ thử thách — đã ghi nhận 1 lần thất bại (lượt tập vẫn tiếp tục).',
        scheduleItemStatuses: {
          pending: 'Chờ',
          active: 'Đang chạy',
          passed: 'Đạt',
          failed: 'Thất bại',
        },
      },

      debug: {
        toggleShowButton: 'Hiện Debug',
        toggleHideButton: 'Ẩn Debug',
        title: 'Debug F4 (Khung hình, Lịch thử thách & Góc)',
        f4SectionTitle: 'Lớp 0 & Lớp 3b (F4)',
        seedLabel: 'Seed lượt tập',
        seedFixedTag: 'Cố định',
        seedRandomTag: 'Ngẫu nhiên',
        scheduleLabel: 'Lịch thử thách (0–2)',
        scheduleEmpty: 'Lượt này có 0 thử thách theo seed.',
        scheduleTriggerPrefix: 'Sau',
        scheduleRepsUnit: 'rep',
        frameStatusLabel: 'Khung hình (sau chống nhấp nháy)',
        frameRawLabel: 'Khung hình thô (tức thời)',
        frameReasonLabel: 'Lý do chưa đạt',
        frameReasonNone: 'Không có (đạt)',
        frameSizeLabel: 'Vai / Thân (tỷ lệ khung)',
        mirrorMappingLabel: 'Ánh xạ trái/phải gương',
        mirrorCssOnly: 'CSS gương (L→L, R→R)',
        mirrorSwapped: 'Đảo giải phẫu (L→R, R→L)',
        f3SectionTitle: 'Góc, Giữ & Tốc độ (F3)',
        metricAngleLabel: 'Góc hiện tại / Ngưỡng',
        metricRatioLabel: 'Chỉ số hiện tại / Ngưỡng',
        holdTimeLabel: 'Thời gian đã giữ',
        holdNotApplicable: 'Không áp dụng',
        secondaryLabels: {
          shoulderTilt: 'Độ nghiêng vai / Dung sai',
          hipTilt: 'Độ nghiêng hông / Dung sai',
          torsoLean: 'Độ gập thân / Dung sai',
        },
        stateLabel: 'Trạng thái đếm',
        stateReady: 'Sẵn sàng',
        stateActive: 'Đang vào/giữ rep',
        stateAwaitingRest: 'Chờ thả lỏng về nghỉ',
        currentVelocityLabel: 'Tốc độ hiện tại',
        livePeakLabel: 'Đỉnh rep hiện tại',
        lastRepPeakLabel: 'Đỉnh rep vừa xong',
        thresholdLabel: 'Ngưỡng TELEPORT',
        velocityUnit: 'p/s',
        filterLabel: 'One Euro',
        filterOn: 'Bật',
        filterOff: 'Tắt',
        lastRejectionLabel: 'Lý do từ chối gần nhất',
        noRejection: 'Chưa có rep nào bị từ chối',
        flagsPrefix: 'Cờ:',
      },
    },
  },

  // ── F5a + F5b: Dungeon Run & Lớp trình bày + Cosmetic ──
  dungeon: {
    modeBadge: 'Hầm Ngục · Dungeon Run',
    stagePrefix: 'Phòng',
    bossTag: 'BOSS CUỐI',
    normalTag: 'QUÁI THƯỜNG',
    hpLabel: 'HP',
    lastHitBadge: 'Đòn cuối!',
    chargeBarLabel: 'Nạp lực tung đòn',
    repProgressLabel: 'Nhịp tung đòn',
    comboLabel: 'COMBO',
    comboDamageHint: 'Tăng sát thương (không tăng XP)',
    comboNextMilestone: 'Mốc cổ vũ kế:',
    comboMaxReached: 'Đỉnh phong độ!',
    comboCheers: {
      5: 'Combo x5! Đang vào phom cực mượt!',
      10: 'Combo x10! Chiến thần bàn phím đây rồi!',
    } as Record<5 | 10, string>,
    critBanner: 'CHÍ MẠNG!',
    damageUnit: 'ST',
    xpFloatingPrefix: '+',
    xpUnit: 'XP',
    defeatedBanner: 'ĐÃ HẠ GỤC! Chuẩn bị đón quái kế tiếp...',
    pausedOverlayTitle: 'Đang tạm dừng',
    pausedOverlayDesc: 'Nhấn "Tiếp tục" để quay lại chiến đấu.',

    sound: {
      onLabel: '🔊 Tiếng: Bật',
      offLabel: '🔇 Tiếng: Tắt',
    },

    fx: {
      reducedBadge: 'Giảm hiệu ứng',
      lowFpsTag: 'FPS < 20',
      reducedMotionTag: 'Reduced Motion',
    },

    boss: {
      introBadge: 'CẢNH BÁO BOSS CUỐI',
      introSubtitle: 'Trùm hầm ngục xuất hiện — tập chắc nhịp để hạ gục!',
      finisherBadge: 'ĐÒN KẾT LIỄU BOSS!',
      finisherSubtitle: 'Hầm ngục rung chuyển…',
    },

    breather: {
      badge: 'Nghỉ lấy hơi',
      title: 'Hạ gục quái thành công!',
      nextMonsterPrefix: 'Sắp gặp:',
      countdownSuffix: 'giây',
      skipButton: 'Sẵn sàng ngay',
      tips: [
        'Uống một ngụm nước nhỏ cho tỉnh táo nhé.',
        'Thả lỏng hai vai và chỉnh lại tư thế đứng/ngồi thật thoải mái.',
        'Hít sâu bằng mũi, thở chậm bằng miệng để lấy lại nhịp thở.',
        'Lắc nhẹ cổ tay và rời mắt khỏi màn hình vài giây cho đỡ mỏi.',
      ],
    },

    levelUp: {
      badge: 'LÊN CẤP!',
      levelPrefix: 'Đạt Cấp',
      unlockedSkillsPrefix: 'Kỹ năng vừa mở:',
      noNewSkills: 'Tiếp tục chiến đấu để mở khóa kỹ năng mới!',
    },

    loot: {
      sectionTitle: 'Rương chiến lợi phẩm',
      chestLabelVerified: 'Rương Hầm Ngục (Theo seed lượt này)',
      chestLabelReview: 'Rương Thường (Lượt cần kiểm tra)',
      openButton: 'Mở rương ngay',
      openedBadge: 'Đã cất vào kho nhân vật (RAM)',
      commonOnlyNote:
        'Lượt ở trạng thái Cần kiểm tra (review) nên chỉ nhận rương Thường.',
      rejectedNoChest:
        'Lượt không hợp lệ (rejected) — không nhận được rương chiến lợi phẩm.',
      inventoryTitle: 'Trang bị Cosmetic (RAM)',
      inventoryEmpty:
        'Chưa có vật phẩm. Hoàn thành Dungeon Run hoặc nhận thưởng tuần để mở!',
      weeklyRewardTag: 'Thưởng tuần · Cosmetic',
      equipButton: 'Trang bị',
      unequipButton: 'Tháo',
      equippedBadge: 'Đang dùng',
      rarities: {
        common: 'Thường',
        rare: 'Hiếm',
        epic: 'Epic',
        legendary: 'Huyền thoại',
      } satisfies Record<Rarity, string>,
      slots: {
        skin: 'Skin',
        frame: 'Khung avatar',
        title: 'Danh hiệu',
      } satisfies Record<CosmeticSlot, string>,
      items: {
        skin_hoodie_code: 'Áo Hoodie Đêm Code',
        frame_terminal: 'Khung Cửa Sổ Terminal',
        title_night_coder: 'Cú Đêm Cần Mẫn',
        skin_iron_dev: 'Giáp Sắt Lập Trình',
        frame_neon_cyan: 'Khung Neon Xanh Lơ',
        title_bug_slayer: 'Thợ Săn Bug',
        skin_shadow_mage: 'Áo Choàng Pháp Sư Bóng Đêm',
        frame_void_purple: 'Khung Hư Không Tím',
        title_ergonomic_knight: 'Hiệp Sĩ Công Thái Học',
        skin_dragon_lord: 'Chiến Giáp Long Vương',
        frame_solar_gold: 'Khung Hoàng Kim Hầm Ngục',
        title_spine_guardian: 'Thần Hộ Mệnh Cột Sống',
      } satisfies Record<CosmeticItemId, string>,
    },

    controls: {
      pause: 'Tạm dừng',
      resume: 'Tiếp tục',
      swapMonster: 'Đổi quái',
      swapUsed: 'Đã dùng Đổi quái',
      finishRun: 'Kết thúc lượt',
      newRun: 'Lượt mới',
    },

    xpBar: {
      levelPrefix: 'Cấp',
      nextLevelPrefix: 'Còn',
      capPrefix: 'Giới hạn phiên:',
      capReachedNotice: 'Hôm nay bạn đã tập đủ, nghỉ ngơi nhé',
      tentativeLabel: 'XP tạm trong lượt:',
    },

    monsters: {
      squat: {
        name: 'Golem Đá',
        bossName: 'Đại Golem Hắc Thạch',
        actionLabel: 'Squat để đập giáp đá',
      },
      overhead_reach: {
        name: 'Rồng Ngái Ngủ',
        bossName: 'Hỏa Long Thức Giấc',
        actionLabel: 'Vươn vai giữ 2s để nạp chưởng',
      },
      side_bend: {
        name: 'Rắn Lắc',
        bossName: 'Mãnh Xà Bóng Đêm',
        actionLabel: 'Nghiêng người giữ 1,5s để né độc',
      },
      neck_tilt: {
        name: 'Bóng Ma Cứng Cổ',
        bossName: 'Ác Linh Khóa Cổ',
        actionLabel: 'Nghiêng cổ giữ 2s để phá nguyền',
      },
      high_knees: {
        name: 'Nhện Nhảy',
        bossName: 'Chúa Nhện Hầm Ngục',
        actionLabel: 'Nâng gối liên hoàn để chặn tơ',
      },
    } satisfies Record<
      ExerciseId,
      { name: string; bossName: string; actionLabel: string }
    >,

    sideObjectives: {
      title: 'Mục tiêu phụ lượt này',
      subtitle: 'Thành tích hiển thị (không cộng thêm XP)',
      items: {
        crit_3: 'Đạt 3 đòn chí mạng (chất lượng ≥ 0,9)',
        combo_8: 'Đạt chuỗi Combo x8',
        boss_no_swap: 'Hạ Boss không dùng Đổi quái',
        high_quality_5: 'Đạt 5 rep chất lượng ≥ 0,85',
        boss_crit: 'Tung ít nhất 1 đòn chí mạng vào Boss',
      },
    },

    skills: {
      title: 'Kỹ năng theo cấp độ',
      realBadge: 'Hoạt động thật',
      comingSoonBadge: 'Sắp có',
      unlockedTag: 'Đã mở',
      lockedPrefix: 'Mở ở Cấp',
      items: {
        free_swap: {
          name: 'Đổi quái miễn phí',
          desc: 'Đổi 1 quái sang động tác khác miễn phí mỗi lượt.',
        },
        second_wind: {
          name: 'Hơi thở thứ hai',
          desc: 'Thêm 1 lần đổi quái miễn phí mỗi phiên chơi.',
        },
        focus: {
          name: 'Tập trung cao độ',
          desc: '+10% XP cho nhiệm vụ đầu tiên của lượt.',
        },
        dungeon_skin: {
          name: 'Giáp Hầm Ngục',
          desc: 'Mở khóa huy hiệu và giao diện nhân vật đặc biệt.',
        },
        raid_boss: {
          name: 'Đại Boss Hầm Ngục',
          desc: 'Mở khóa nhiệm vụ Boss đặc biệt với mức XP cao hơn.',
        },
      },
    },

    stats: {
      title: 'Chỉ số nhân vật (RAM)',
      str: 'STR (Sức mạnh)',
      agi: 'AGI (Nhanh nhẹn)',
      vit: 'VIT (Thể lực)',
      wis: 'WIS (Trí tuệ)',
    },

    verdicts: {
      verified: {
        label: 'ĐÃ XÁC THỰC (Verified)',
        desc: 'Lượt tập hợp lệ. XP chính thức và chỉ số đã được cộng vào nhân vật.',
      },
      review: {
        label: 'CẦN KIỂM TRA (Review)',
        desc: 'Phát hiện dấu hiệu bất thường nên hệ thống tạm giữ XP (chưa cộng XP vào nhân vật).',
      },
      rejected: {
        label: 'KHÔNG HỢP LỆ (Rejected)',
        desc: 'Lượt tập bị từ chối do vi phạm kiểm tra chống gian lận — KHÔNG cộng XP.',
      },
    } satisfies Record<Verdict, { label: string; desc: string }>,

    verdictReasons: {
      STATIC_SUBJECT: 'Hình ảnh quá tĩnh trong thời gian dài (nghi vấn ảnh tĩnh).',
      CHALLENGE_FAILED: 'Không vượt qua thử thách sống giơ tay trong lượt.',
      LOW_FPS: 'Tốc độ khung hình quá thấp, dữ liệu chuyển động thiếu tin cậy.',
      NOISY_REPS: 'Tỷ lệ rep bị giật/nhiễu bất thường quá cao.',
      LOOPED_MOTION: 'Quỹ đạo các rep lặp lại gần như giống hệt nhau (nghi vấn phát lại video).',
      UNIFORM_TEMPO: 'Nhịp thời gian giữa các rep đều bất thường.',
      TOO_MANY_REPS: 'Số rep vượt quá giới hạn vật lý so với thời lượng lượt.',
      INVALID_REP: 'Có rep không vượt qua bước kiểm tra lại của engine.',
    } as Record<string, string>,

    xpDiffExplanations: {
      xp_cap:
        'XP chính thức từ finalizeRun thấp hơn XP tạm vì đã chạm giới hạn 600 XP trong lần tải trang này.',
      review_held:
        'XP chính thức là 0 vì lượt ở trạng thái Cần kiểm tra (review) — engine tạm giữ toàn bộ XP.',
      rejected_zero:
        'XP chính thức là 0 vì lượt bị từ chối (rejected) — không cộng XP cho lượt không hợp lệ.',
      recheck_adjusted:
        'XP chính thức được tính lại bởi finalizeRun sau bước kiểm tra lại từng rep.',
    },

    summary: {
      titleVictory: 'Hoàn thành Hầm Ngục!',
      titleEnded: 'Kết thúc lượt tập',
      officialXpLabel: 'XP chính thức (finalizeRun)',
      tentativeXpLabel: 'XP tạm cộng dồn trên UI',
      repsLabel: 'Rep đạt / bị loại / hủy',
      livenessLabel: 'Thử thách sống (Đạt / Trượt)',
      monstersClearedLabel: 'Quái đã hạ',
      levelChangeLabel: 'Cấp độ',
      statsChangeLabel: 'Chỉ số nhân vật',
      objectivesLabel: 'Mục tiêu phụ trong lượt',
      reasonsTitle: 'Chi tiết kiểm định chống gian lận',
      noReasonsText: 'Không phát hiện bất thường nào.',
      playAgainButton: 'Chơi lượt mới',
      leaderboardButton: 'Xem bảng xếp hạng tuần',
      backHomeButton: 'Về trang chủ',
    },

    debug: {
      title: 'Debug Dungeon (F5a/F5b)',
      sampleRunButton: 'Lượt mẫu (3 quái × 2 rep)',
      sampleRunTag: 'Đang chạy Lượt mẫu',
      normalRunTag: 'Lượt chuẩn (3–5 quái)',
      seedLabel: 'Seed hầm ngục',
      tentativeXpLabel: 'XP tạm (UI)',
      officialXpLabel: 'XP finalizeRun',
      pendingOfficial: 'Chờ kết thúc lượt',
      swapsLabel: 'Lượt Đổi quái còn lại',
      liveMetricLabel: 'Chỉ số / Ngưỡng hiện tại',
      liveHoldLabel: 'Vào tư thế / Giữ',
    },
  },

  // ── F7: Bảng xếp hạng minh họa & Thưởng tuần ──
  leaderboard: {
    title: 'Bảng xếp hạng tuần',
    demoBannerBadge: 'Dữ liệu minh họa (demo data)',
    demoBannerDesc:
      '20 đối thủ có biểu tượng 🤖 là người chơi giả tạo cục bộ theo seed cố định để minh họa xếp hạng.',
    backHome: 'Trang chủ',
    goPlay: 'Vào Dungeon Run',
    defaultPlayerName: 'Bạn (Hiệp sĩ IT)',
    youBadge: 'BẠN',
    demoBadge: 'Demo',
    pointsUnit: 'điểm',

    unranked: {
      title: 'Bạn chưa có điểm tuần này',
      desc: 'Hoàn thành ít nhất 1 lượt Dungeon Run hợp lệ (verified) để ghi tên lên bảng xếp hạng và mở khóa thưởng tuần nhé!',
      ctaButton: 'Bắt đầu Dungeon Run ngay',
      noteReview: 'Lưu ý: chỉ phiên đã xác thực (verified) mới cộng điểm tuần.',
    },

    status: {
      rankLabel: 'Hạng hiện tại',
      scoreLabel: 'Điểm tuần',
      verifiedXpLabel: 'XP verified tuần',
      activeDaysLabel: 'Ngày hoạt động',
      demoDayPrefix: 'Ngày demo:',
      gapPrefix: 'Còn',
      gapMiddle: 'điểm để vượt',
      topRankMessage: 'Bạn đang dẫn đầu bảng xếp hạng tuần! Giữ phong độ nhé!',
      rankEnteredBadge: 'Vừa ghi danh vào bảng xếp hạng!',
      rankUpPrefix: 'Tăng',
      rankUpSuffix: 'hạng!',
      rankShiftPrefix: 'Hạng mới #',
      rankShiftSuffix: '— tiếp tục giữ nhịp nhé!',
    },

    controls: {
      nextDemoDayButton: 'Sang ngày mới (demo)',
      simulateWeekendButton: 'Mô phỏng cuối tuần',
      weekendClaimedButton: 'Đã nhận thưởng tuần này',
      resetWeekButton: 'Đặt lại tuần',
      needScoreHint: 'Cần có điểm từ ít nhất 1 phiên verified để mô phỏng nhận thưởng cuối tuần.',
    },

    table: {
      rankCol: 'Hạng',
      playerCol: 'Người chơi',
      scoreCol: 'Điểm tuần',
    },

    rewardModal: {
      badge: 'Tổng kết cuối tuần (Demo)',
      title: 'Chúc mừng nhận thưởng tuần!',
      rankPrefix: 'Hạng chung cuộc:',
      cosmeticOnlyNote:
        'Lưu ý: Phần thưởng tuần chỉ mang tính trang trí (cosmetic), không tăng XP hay sát thương. Vật phẩm đã được thêm vào kho trang bị nhân vật (RAM).',
      closeButton: 'Đóng & xem bảng',
      goPlayButton: 'Vào Dungeon Run',
    },

    debug: {
      toggleShowButton: 'Hiện Debug',
      toggleHideButton: 'Ẩn Debug',
      title: 'Debug Bảng xếp hạng (F7)',
      addXpButton: 'Cộng nhanh 300 XP verified',
      changeSeedButton: 'Đổi seed demo',
      resetSeedButton: 'Seed mặc định (2026)',
      seedLabel: 'Seed demo',
      weeklyScoreLabel: 'Điểm tuần',
      weeklyXpLabel: 'XP verified tuần',
      activeDaysLabel: 'Ngày hoạt động (tính / thực)',
      currentDayLabel: 'Ngày demo hiện tại',
    },

    honestDisclaimer:
      'Bản prototype: bảng xếp hạng chạy trên trình duyệt, không có máy chủ nên không chống gian lận tuyệt đối.',
  },
} as const;