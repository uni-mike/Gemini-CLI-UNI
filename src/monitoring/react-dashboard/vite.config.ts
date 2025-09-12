import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('proxy error', err);
          });
        }
      }
    },
    // Performance optimizations
    hmr: {
      overlay: false
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  // Build optimizations
  optimizeDeps: {
    include: ['react', 'react-dom', 'reactflow', 'recharts'],
    exclude: []
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts', 'reactflow']
        }
      }
    }
  }
})