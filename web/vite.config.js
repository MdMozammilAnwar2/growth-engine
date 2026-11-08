import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const api = process.env.VITE_DEV_API || 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // open from your phone on the same Wi-Fi: http://<your-laptop-ip>:5173
    port: 5173,
    proxy: {
      '/api': api,
      '/p': api,
    },
  },
});
