import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // TS6133エラーを無視
        if (warning.code === 'PLUGIN_WARNING') return
        warn(warning)
      }
    }
  }
})