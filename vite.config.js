import { defineConfig } from 'vite'
import { resolve } from 'pathe'

import dts from 'vite-plugin-dts'

export default defineConfig({
    server: {
        open: 'demo/index.html'
    },
    build: {
        target: "es2019",
        lib: {
            entry: resolve(__dirname, 'src/pathway.router.js'),
            formats: ['cjs', 'iife'],
            name: 'Pathway',
        }
    },
    esbuild: {
        target: "es2019"
    },
    optimizeDeps: {
        esbuildOptions: {
            target: "es2019",
        }
    },
    plugins: [
        dts (
            { insertTypesEntry: true }
        ),
    ],
})