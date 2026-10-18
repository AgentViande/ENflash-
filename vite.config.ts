import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              input: {
                index: path.resolve(__dirname, 'src/main/index.ts'),
                kokoroWorker: path.resolve(__dirname, 'src/main/audio/kokoroWorker.ts'),
                llmWorker: path.resolve(__dirname, 'src/main/llm/llmWorker.ts'),
              },
              external: [
                'electron',
                'electron-updater',
                'kokoro-js',
                '@huggingface/transformers',
                'onnxruntime-node',
                'node-llama-cpp',
              ],
            },
          },
        },
      },
      preload: {
        input: 'src/preload/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/preload',
          },
        },
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer/src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@preload': path.resolve(__dirname, 'src/preload'),
    },
  },
})
