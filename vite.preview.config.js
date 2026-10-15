// Build for the shareable preview link. scripts/build-preview.js then inlines
// the output into one HTML page. Routes are kept in memory.
// Run: npm run build:preview  (writes preview/waste-utilities-preview.html)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: { 'import.meta.env.VITE_ROUTER': JSON.stringify('memory') },
  build: {
    outDir: 'dist-preview',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
