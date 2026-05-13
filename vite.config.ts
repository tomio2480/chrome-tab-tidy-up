import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import preact from '@preact/preset-vite'
import manifest from './src/manifest.json'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
      },
    },
    cssCodeSplit: true,
  },
  plugins: [preact(), crx({ manifest })],
})
