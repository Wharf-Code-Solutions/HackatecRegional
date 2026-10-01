import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Uso local: MOCK_API=1 en tu .env simula POST /api/reportes sin backend.
  const env = loadEnv(mode, '.', '')
  const mock = env.MOCK_API === '1'
  // API_TARGET=http://localhost:8000 en tu .env para usar un FastAPI local
  const target = env.API_TARGET || 'https://hackatec-regional.vercel.app'

  return {
  plugins: [react()],
  // Safari 15 (iPhone con iOS 15) como mínimo: el valor por defecto de Vite deja fuera iOS 15.0-16.3
  build: { target: ['es2020', 'safari15'], cssTarget: 'safari15' },
  server: {
    // En local no corre FastAPI: /api se manda al despliegue de Vercel.
    proxy: {
      '/api': {
        target,
        changeOrigin: true,
        bypass: mock
          ? (req, res) => {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({
                incidencia_id: crypto.randomUUID(),
                reporte_id: crypto.randomUUID(),
                agrupado: false,
                reportes_count: 1,
                prioridad: 3,
              }))
              return false
            }
          : undefined,
      },
    },
  },
  }
})
