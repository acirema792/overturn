import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `base: './'` lets the same build run from GitHub Pages, Firebase Hosting or a file server.
export default defineConfig({
  base: './',
  plugins: [react()],
})
