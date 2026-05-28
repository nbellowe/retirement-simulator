import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  base: process.env.NETLIFY ? '/' : '/retirement-simulator/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
