import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['tests/**/*.spec.ts', 'node_modules/**', 'e2e/**']
  }
})
