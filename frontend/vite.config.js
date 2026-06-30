import { visualizer } from 'rollup-plugin-visualizer';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    visualizer({
      filename: 'bundle-stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
    },
  },
  server: {
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.PORT || '3000', 10),
    // Never try to open a browser — not possible inside Docker / CI
    open: false,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://backend:8000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  optimizeDeps: {
    include: ['lottie-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three') || id.includes('@react-three')) {
              return 'vendor-3d';
            }
            if (id.includes('react') || id.includes('zustand')) {
              return 'vendor-react';
            }
            return 'vendor';
          }
        },
      },
    },
  },
  test: {
    environment: 'happy-dom',
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'tests/**/*'],
  },
});

