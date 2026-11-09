import { defineConfig, splitVendorChunkPlugin } from "vite";
import path, { resolve } from "path";
import react from "@vitejs/plugin-react-swc";
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import fixReactVirtualized from 'esbuild-plugin-react-virtualized'
import { VitePWA } from 'vite-plugin-pwa'
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { createHash } from "crypto";
import { readFileSync } from "fs";

// Voice transcription: the ONNX Runtime WebAssembly binary (~15-27 MB) is not bundled in the
// app, it is downloaded from jsDelivr the first time transcription is enabled. Its hash is
// taken from the installed package so the download is checked against the exact same file.
const ortDir = resolve(__dirname, "node_modules/onnxruntime-web");
const ortIntegrity = (file: string) =>
  "sha256-" + createHash("sha256").update(readFileSync(resolve(ortDir, "dist", file))).digest("base64");
const ORT_WASM = {
  version: JSON.parse(readFileSync(resolve(ortDir, "package.json"), "utf8")).version,
  asyncify: ortIntegrity("ort-wasm-simd-threaded.asyncify.wasm"),
  plain: ortIntegrity("ort-wasm-simd-threaded.wasm"),
};


// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __ORT_WASM__: JSON.stringify(ORT_WASM),
  },
  resolve: {
    // onnxruntime-web build that doesn't reference (and bundle) its .wasm binary
    conditions: ["onnxruntime-web-use-extern-wasm"],
  },
  optimizeDeps: {
    esbuildOptions: {
      plugins: [fixReactVirtualized]
    },
  },
  plugins: [
    react(),
    // VitePWA({
    //   mode: 'development',
    //   strategies: 'injectManifest',
    //   injectManifest: {
    //     maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
    //   },
    //   // workbox: {
    //   //    maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
    //   // },
    //   srcDir: 'public',
    //   filename: 'firebase-messaging-sw.js',
    //   devOptions: {
    //     enabled: false,
    //     type: 'module',
    //   },
    //    registerType: 'prompt'
    //    },
    //   ),
    // VitePWA({
    //   mode: 'development',
    //   strategies: 'injectManifest',
    //   srcDir: 'public',
    //   filename: 'firebase-messaging-sw.js',
    //   devOptions: {
    //     enabled: false,
    //     type: 'module',
    //   },
    //    registerType: 'prompt'
    //    },
    //   ),
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
