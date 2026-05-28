import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  base: '/retirement-simulator/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
