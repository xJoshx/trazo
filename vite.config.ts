import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import { gzipSync } from 'node:zlib'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

function buildMetrics(): Plugin {
  return {
    name: 'build-metrics',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files: { path: string; rawBytes: number; gzipBytes: number }[] = []
      const add = (path: string, contents: string | Uint8Array) => {
        const bytes = typeof contents === 'string' ? Buffer.from(contents) : Buffer.from(contents)
        files.push({ path, rawBytes: bytes.length, gzipBytes: gzipSync(bytes).length })
      }
      for (const [path, item] of Object.entries(bundle)) add(path, item.type === 'chunk' ? item.code : item.source)
      const publicRoot = join(process.cwd(), 'apps/web/public')
      const visit = (directory: string) => {
        for (const name of readdirSync(directory)) {
          const path = join(directory, name)
          if (statSync(path).isDirectory()) visit(path)
          else if (!name.endsWith('.md')) add(relative(publicRoot, path).replaceAll('\\', '/'), readFileSync(path))
        }
      }
      visit(publicRoot)
      files.sort((a, b) => a.path.localeCompare(b.path))
      this.emitFile({
        type: 'asset', fileName: 'build-metrics.json',
        source: JSON.stringify({
          generatedAt: new Date().toISOString(),
          rawBytes: files.reduce((sum, file) => sum + file.rawBytes, 0),
          gzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0),
          files
        })
      })
    }
  }
}

export default defineConfig({
  root: 'apps/web',
  publicDir: 'public',
  plugins: [
    svelte(),
    buildMetrics(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['icons/*', 'fonts/*'],
      manifest: {
        name: 'Daymark Writer',
        short_name: 'Daymark',
        description: 'A quiet, offline Markdown diary',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#fbfbfb',
        background_color: '#fbfbfb',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,wasm,woff2,svg,ico,png}'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html'
      },
      devOptions: { enabled: true }
    })
  ],
  build: { outDir: '../../dist', emptyOutDir: true }
})
