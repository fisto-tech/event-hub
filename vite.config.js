import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

const REMOTE_API = 'https://www.fist-o.com/stall_event_app/backend/api'
const LOCAL_API = 'http://127.0.0.1:8080'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Default: local PHP (npm run dev:api). Set VITE_DEV_API_REMOTE=true to hit production.
  const useRemote = env.VITE_DEV_API_REMOTE === 'true'
  const apiTarget = useRemote ? REMOTE_API : LOCAL_API

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
