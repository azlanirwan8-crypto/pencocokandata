import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Dev middleware: jalankan fungsi `api/*.ts` yang asli di dalam proses Vite.
 *
 * Dulu dev menyalin ulang query kode pos di sini, dan salinan itu perlahan
 * menyimpang dari api/ yang sebenarnya (perbedaan yang tidak pernah terlihat di
 * produksi). Sekarang satu berkas saja yang dipakai: permintaan /api/<nama>
 * dimuat dengan ssrLoadModule, lalu diberi shim API respons ala Vercel
 * (res.status().json()) dan body yang sudah diparse.
 */
function apiDevMiddleware(): Plugin {
  return {
    name: 'vercel-api-dev-middleware',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`)
        const nama = /^\/api\/([a-z0-9-]+)$/i.exec(url.pathname)?.[1]
        if (!nama) return next()

        const modul = await server
          .ssrLoadModule(`/api/${nama}.ts`)
          .catch(() => null)
        const handler = modul?.default
        if (typeof handler !== 'function') {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ ok: false, error: `Endpoint /api/${nama} tidak ada.` }))
        }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
          let raw = ''
          for await (const chunk of req) raw += chunk
          try {
            ;(req as any).body = raw ? JSON.parse(raw) : undefined
          } catch {
            ;(req as any).body = raw
          }
        }
        ;(req as any).query = Object.fromEntries(url.searchParams)
        ;(res as any).status = (kode: number) => {
          res.statusCode = kode
          return res
        }
        ;(res as any).json = (body: unknown) => {
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify(body ?? null))
        }

        try {
          await handler(req, res)
        } catch (e: any) {
          console.error(`[Vite] /api/${nama} gagal:`, e)
          if (!res.writableEnded) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: e?.message || 'Kesalahan fungsi serverless.' }))
          }
        }
        if (!res.writableEnded) res.end()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), apiDevMiddleware()],
  build: {
    target: 'esnext',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react'
            if (id.includes('xlsx')) return 'vendor-excel'
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf'
            if (id.includes('leaflet')) return 'vendor-map'
            if (id.includes('lucide-react')) return 'vendor-icons'
            if (id.includes('idb-keyval')) return 'vendor-db'
            return 'vendor-libs'
          }
        },
      },
    },
  },
}))
