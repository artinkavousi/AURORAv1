import { defineConfig } from 'vite'
import tslOperatorPlugin from 'vite-plugin-tsl-operator'
import plainText from 'vite-plugin-plain-text';

export default defineConfig({
    base: './',
    assetsInclude: ['**/*.hdr'],
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('three')) return 'vendor-three';
                        if (id.includes('tweakpane')) return 'vendor-tweakpane';
                        return 'vendor';
                    }
                }
            }
        },
        chunkSizeWarningLimit: 1600
    },
    server: {
        port: 1234,
    },
    plugins: [
        tslOperatorPlugin({logs:false}),
        plainText(
            [/\.obj$/],
            { namedExport: false },
        ),
    ]
});
