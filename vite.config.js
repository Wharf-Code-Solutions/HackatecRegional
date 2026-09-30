import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Uso local: MOCK_API=1 en tu .env simula POST /api/reportes sin backend.
  const mock = loadEnv(mode, '.', '').MOCK_API === '1'

  return {
  plugins: [react()],
  server: {
    // En local no corre FastAPI: /api se manda al despliegue de Vercel.
    proxy: {
      '/api': {
        target: 'https://hackatec-regional.vercel.app',
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
