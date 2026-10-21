import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    '.next/**',
    '.next-*/**',
    '.data/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // MediaPipe's runtime, copied unchanged from @mediapipe/tasks-vision (generated code, not ours).
    'public/mediapipe/**',
  ]),
])
