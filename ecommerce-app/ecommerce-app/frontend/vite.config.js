import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('firebase')) {
            return 'vendor-firebase';
          }

          if (id.includes('recharts') || id.includes('framer-motion')) {
            return 'vendor-ui-heavy';
          }

          if (id.includes('react-quill') || id.includes('quill')) {
            return 'vendor-editor';
          }

          if (id.includes('date-fns') || id.includes('lodash') || id.includes('lodash-es')) {
            return 'vendor-utils';
          }

          return 'vendor-misc';
        },
      },
    },
  },
});
