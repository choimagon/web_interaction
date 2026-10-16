import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { target: 'chrome63', cssTarget: 'chrome63' },
  server: { port: 5173, strictPort: true },
});
