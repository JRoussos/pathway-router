import { defineConfig } from 'vite'
import { resolve } from 'pathe'

import dts from 'vite-plugin-dts'

export default defineConfig({
    build: {
        rollupOptions: {
            output: {
                extend: true,
                entryFileNames: 'pathway.router.min.js',
            }
        },
        lib: {
            entry: resolve(__dirname, 'src/pathway.router.js'),
            formats: ['iife'],
            name: 'Pathway',
        }
    },
    plugins: [
        dts (
            { insertTypesEntry: true }
        ),
    ],
})