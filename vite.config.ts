import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Keep the browser targets from the previous Vite version.
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
