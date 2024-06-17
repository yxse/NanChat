import { defineConfig, splitVendorChunkPlugin } from "vite";
import path, { resolve } from "path";
import react from "@vitejs/plugin-react-swc";
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import fixReactVirtualized from 'esbuild-plugin-react-virtualized'


// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    esbuildOptions: {
      plugins: [fixReactVirtualized]
    }
  },
  plugins: [
    react(),
    nodePolyfills({
      include: ['crypto', 'stream', 'vm', 'process'],
      globals: {
        Buffer: true
      }
    }),
    splitVendorChunkPlugin()
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
