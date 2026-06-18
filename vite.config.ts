import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base must match the GitHub Pages project path so assets resolve under
// https://<user>.github.io/ligentia-po-monitoring/
export default defineConfig({
  base: '/ligentia-po-monitoring/',
  plugins: [react()],
})
