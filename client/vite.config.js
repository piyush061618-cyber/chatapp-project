import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Exposes Vite dev server to local network (Wi-Fi)
    port: 5173,
  },
});
