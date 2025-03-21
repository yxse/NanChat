import { defineConfig, splitVendorChunkPlugin } from "vite";
import path, { resolve } from "path";
import react from "@vitejs/plugin-react-swc";
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import fixReactVirtualized from 'esbuild-plugin-react-virtualized'
import { VitePWA } from 'vite-plugin-pwa'


// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    esbuildOptions: {
      plugins: [fixReactVirtualized]
    }
  },
  plugins: [
    react(),
    VitePWA({
      mode: 'development',
      strategies: 'injectManifest',
      injectManifest: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
      },
      // workbox: {
      //    maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
      // },
      srcDir: 'public',
      filename: 'firebase-messaging-sw.js',
      devOptions: {
        enabled: false,
        type: 'module',
      },
       registerType: 'prompt'
       },
      ),
    nodePolyfills({
      include: ['crypto', 'stream', 'vm', 'process'],
      globals: {
        Buffer: true
      }
    }),
    // splitVendorChunkPlugin()
  ],
  build: {
    minify: true,
    cssMinify: true,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "index.html"),
        options: resolve(__dirname, "options.html"),
        service_worker: resolve(__dirname, "src/background.ts"),
        // service_worker_firebase: resolve(__dirname, "src/firebase-messaging-sw.js"),
        content_script: resolve(__dirname, "src/content-script.ts"),
      },
      output: {
        chunkFileNames: "[name].[hash].js",
        assetFileNames: "[name].[hash].[ext]",
        entryFileNames: "[name].js",
        dir: "dist",
      },
    },
  },
});
