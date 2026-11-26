import type { ChallengeId, ExerciseId, GateReason } from '@/lib/pose-engine';

/**
 * Toàn bộ chuỗi giao diện tiếng Việt cho FitQuest.
 * Giữ nguyên toàn bộ khóa F1 + F2 + F3 và bổ sung đầy đủ chuỗi cho F4
 * (kiểm tra khung hình lớp 0, thử thách sống lớp 3b, lượt tập thử và debug).
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

  // ── F1 + F2 + F3 + F4: Trang chơi, camera, AI, luyện tập & thử thách sống ──
  play: {
    // Khóa giữ nguyên từ F1
    placeholder: 'Camera sắp có',
    backHome: 'Quay lại trang chủ',
    playerPrefix: 'Người chơi:',
    defaultPlayer: 'Ẩn danh',
    xpPrefix: 'XP:',

    // Khóa dùng chung trên /play (F2)
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

    // Nhãn HUD góc camera (F2)
    hud: {
      poseDetected: 'Đang theo dõi khung xương',
      noPose: 'Chưa thấy người trong khung hình',
      fpsUnit: 'FPS',
    },

    // ── F3: Chế độ luyện tập 5 động tác ──
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
      bodyScopeUpper: 'Chỉ cần thấy thân trên',
      holdUnit: 's',

      // Trạng thái theo thời gian thực & kết quả rep
      status: {
        waitingCamera: 'Đang chờ camera và AI sẵn sàng...',
        holding: 'Giữ nguyên tư thế...',
        holdComplete: 'Đã tính rep! Thả lỏng về tư thế nghỉ để tập rep tiếp theo',
        awaitingRest: 'Đã xong rep — hãy thả lỏng về tư thế nghỉ trước khi tập tiếp',
        startFromRest: 'Hãy về tư thế nghỉ trước khi bắt đầu giữ',
        repCancelledTitle: 'Rep đang tập đã bị hủy',
        poseLostTitle: 'Tạm dừng đếm (khung hình chưa đạt)',
        challengePaused: 'Đang tạm dừng đếm rep để thực hiện thử thách sống...',
        runEnded: 'Lượt tập thử đã kết thúc. Bấm "Bắt đầu lượt tập thử" để tập lượt mới.',
        countedGood: 'Rep chuẩn! Tiếp tục giữ nhịp',
        countedWithNotePrefix: 'Đã tính rep — lưu ý:',
        rejectedPrefix: 'Chưa tính rep:',
        unknownIssue: 'Động tác chưa đạt yêu cầu, hãy thử lại',
      },

      // Lý do mất tư thế từ qualityGate (pose-engine.ts)
      gateReasons: {
        NO_POSE: 'Không thấy người trong khung hình. Hãy đứng hoặc ngồi vào trước camera.',
        LOW_VISIBILITY:
          'Thiếu khớp bắt buộc hoặc ánh sáng yếu. Hãy bật thêm đèn và để lộ rõ đủ khớp cần thiết.',
        OUT_OF_FRAME:
          'Khớp bắt buộc đang sát mép hoặc ra ngoài khung hình. Hãy căn lại vị trí ở giữa camera.',
        TOO_FAR: 'Bạn đang đứng quá xa camera (thân quá nhỏ). Hãy tiến lại gần hơn.',
      } satisfies Record<GateReason, string>,

      // Thông tin & gợi ý riêng cho từng động tác trong EXERCISES
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
          scope: 'upper',
          readyCue: 'Tư thế tốt — nghiêng người nhẹ sang một bên và giữ liên tục 1,5 giây',
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
          scope: 'full' | 'squat' | 'upper';
          readyCue: string;
          depthCue: string;
          peakCue: string;
          notDeepEnough: string;
        }
      >,

      // Gợi ý theo id của từng FormCheck trong EXERCISES[*].form
      formChecks: {
        TORSO_UPRIGHT: 'Giữ lưng thẳng hơn',
        HIPS_LEVEL: 'Giữ hông tương đối cân bằng',
        BOTH_WRISTS_UP: 'Đưa cả hai tay cao quá đầu',
        SHOULDERS_LEVEL: 'Giữ vai tương đối ngang',
      } as Record<string, string>,

      // Gợi ý theo mã cờ trả về trong RepResult.flags của pose-engine.ts
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

      // ── F4: Kiểm tra khung hình (Lớp 0) & Thử thách sống (Lớp 3b) ──
      frameCheck: {
        title: 'Kiểm tra khung hình',
        readyBadge: 'Sẵn sàng',
        notReadyBadge: 'Chưa đạt',
        stabilizingBadge: 'Đang ổn định...',
        readyMessage: 'Khung hình đạt chuẩn — có thể bắt đầu đếm rep.',
        reasons: {
          NO_POSE: 'Không thấy người trong khung hình. Hãy ngồi hoặc đứng vào trước camera.',
          LOW_VISIBILITY:
            'Thiếu khớp bắt buộc (độ tin cậy < 0,6). Hãy bật thêm đèn và để lộ rõ các khớp cần kiểm tra.',
          OUT_OF_FRAME:
            'Khớp bắt buộc đang sát mép hoặc ra ngoài khung hình. Hãy căn lại vị trí ở giữa khung.',
          TOO_FAR:
            'Bạn đang đứng quá xa camera (thân quá nhỏ trong khung). Hãy tiến lại gần hơn.',
          TOO_CLOSE:
            'Bạn đang đứng quá gần camera. Hãy lùi ra xa một chút để thấy rõ cơ thể.',
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

      // Khung debug F3 + F4 (bật/tắt bằng nút Debug)
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
} as const;