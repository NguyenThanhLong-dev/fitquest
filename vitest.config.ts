import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Lấy đường dẫn thư mục gốc dự án chuẩn trên Windows (không bị lỗi dấu gạch chéo)
const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Cấu hình Vitest để ánh xạ bí danh "@/" về thư mục gốc dự án,
 * khớp với cấu hình paths trong tsconfig.json của Next.js.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
  test: {
    environment: 'node',
  },
});