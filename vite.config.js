import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => ({
  base: mode === 'demo' ? '/' : '/ikars_skola/',
  plugins: [vue()],
}))
