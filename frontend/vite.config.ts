import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const FRONTEND_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(FRONTEND_DIR, '..');
const DIST_DIR = path.resolve(REPO_ROOT, 'dist');

export default defineConfig(() => {
  return {
    root: FRONTEND_DIR,
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." still resolve in production builds.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const srcAssets = path.resolve(FRONTEND_DIR, 'src/assets');
          const distAssets = path.resolve(DIST_DIR, 'src/assets');
          if (fs.existsSync(DIST_DIR) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': REPO_ROOT,
      },
    },
    build: {
      outDir: DIST_DIR,
      emptyOutDir: true,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
