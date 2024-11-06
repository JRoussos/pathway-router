import { defineConfig } from 'vite'
import { resolve } from 'pathe'

import dts from 'vite-plugin-dts'

export default defineConfig({
    build: {
        target: "es2019",
        rollupOptions: {
            output: {
                extend: true,
                entryFileNames: 'index.min.js',
            }
        },
        lib: {
            entry: resolve(__dirname, 'src/pathway.router.js'),
            formats: ['cjs', 'iife'],
            name: 'Pathway',
            fileName: 'index'
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