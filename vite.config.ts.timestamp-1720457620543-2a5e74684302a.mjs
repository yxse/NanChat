// vite.config.ts
import { defineConfig, splitVendorChunkPlugin } from "file:///D:/dev/Cesium/node_modules/vite/dist/node/index.js";
import { resolve } from "path";
import react from "file:///D:/dev/Cesium/node_modules/@vitejs/plugin-react-swc/index.mjs";
import { nodePolyfills } from "file:///D:/dev/Cesium/node_modules/vite-plugin-node-polyfills/dist/index.js";
import fixReactVirtualized from "file:///D:/dev/Cesium/node_modules/esbuild-plugin-react-virtualized/dist/index.mjs";
var __vite_injected_original_dirname = "D:\\dev\\Cesium";
var vite_config_default = defineConfig({
  optimizeDeps: {
    esbuildOptions: {
      plugins: [fixReactVirtualized]
    }
  },
  plugins: [
    react(),
    nodePolyfills({
      include: ["crypto", "stream", "vm", "process"],
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
        popup: resolve(__vite_injected_original_dirname, "index.html"),
        options: resolve(__vite_injected_original_dirname, "options.html"),
        service_worker: resolve(__vite_injected_original_dirname, "src/background.ts"),
        content_script: resolve(__vite_injected_original_dirname, "src/content-script.ts")
      },
      output: {
        chunkFileNames: "[name].[hash].js",
        assetFileNames: "[name].[hash].[ext]",
        entryFileNames: "[name].js",
        dir: "dist"
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxkZXZcXFxcQ2VzaXVtXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxkZXZcXFxcQ2VzaXVtXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9kZXYvQ2VzaXVtL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBzcGxpdFZlbmRvckNodW5rUGx1Z2luIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHBhdGgsIHsgcmVzb2x2ZSB9IGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XHJcbmltcG9ydCB7IG5vZGVQb2x5ZmlsbHMgfSBmcm9tICd2aXRlLXBsdWdpbi1ub2RlLXBvbHlmaWxscyc7XHJcbmltcG9ydCBmaXhSZWFjdFZpcnR1YWxpemVkIGZyb20gJ2VzYnVpbGQtcGx1Z2luLXJlYWN0LXZpcnR1YWxpemVkJ1xyXG5cclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgb3B0aW1pemVEZXBzOiB7XHJcbiAgICBlc2J1aWxkT3B0aW9uczoge1xyXG4gICAgICBwbHVnaW5zOiBbZml4UmVhY3RWaXJ0dWFsaXplZF1cclxuICAgIH1cclxuICB9LFxyXG4gIHBsdWdpbnM6IFtcclxuICAgIHJlYWN0KCksXHJcbiAgICBub2RlUG9seWZpbGxzKHtcclxuICAgICAgaW5jbHVkZTogWydjcnlwdG8nLCAnc3RyZWFtJywgJ3ZtJywgJ3Byb2Nlc3MnXSxcclxuICAgICAgZ2xvYmFsczoge1xyXG4gICAgICAgIEJ1ZmZlcjogdHJ1ZVxyXG4gICAgICB9XHJcbiAgICB9KSxcclxuICAgIHNwbGl0VmVuZG9yQ2h1bmtQbHVnaW4oKVxyXG4gIF0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIG1pbmlmeTogdHJ1ZSxcclxuICAgIGNzc01pbmlmeTogdHJ1ZSxcclxuICAgIGNzc0NvZGVTcGxpdDogdHJ1ZSxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgaW5wdXQ6IHtcclxuICAgICAgICBwb3B1cDogcmVzb2x2ZShfX2Rpcm5hbWUsIFwiaW5kZXguaHRtbFwiKSxcclxuICAgICAgICBvcHRpb25zOiByZXNvbHZlKF9fZGlybmFtZSwgXCJvcHRpb25zLmh0bWxcIiksXHJcbiAgICAgICAgc2VydmljZV93b3JrZXI6IHJlc29sdmUoX19kaXJuYW1lLCBcInNyYy9iYWNrZ3JvdW5kLnRzXCIpLFxyXG4gICAgICAgIGNvbnRlbnRfc2NyaXB0OiByZXNvbHZlKF9fZGlybmFtZSwgXCJzcmMvY29udGVudC1zY3JpcHQudHNcIiksXHJcbiAgICAgIH0sXHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiBcIltuYW1lXS5baGFzaF0uanNcIixcclxuICAgICAgICBhc3NldEZpbGVOYW1lczogXCJbbmFtZV0uW2hhc2hdLltleHRdXCIsXHJcbiAgICAgICAgZW50cnlGaWxlTmFtZXM6IFwiW25hbWVdLmpzXCIsXHJcbiAgICAgICAgZGlyOiBcImRpc3RcIixcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBK04sU0FBUyxjQUFjLDhCQUE4QjtBQUNwUixTQUFlLGVBQWU7QUFDOUIsT0FBTyxXQUFXO0FBQ2xCLFNBQVMscUJBQXFCO0FBQzlCLE9BQU8seUJBQXlCO0FBSmhDLElBQU0sbUNBQW1DO0FBUXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLGNBQWM7QUFBQSxJQUNaLGdCQUFnQjtBQUFBLE1BQ2QsU0FBUyxDQUFDLG1CQUFtQjtBQUFBLElBQy9CO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sY0FBYztBQUFBLE1BQ1osU0FBUyxDQUFDLFVBQVUsVUFBVSxNQUFNLFNBQVM7QUFBQSxNQUM3QyxTQUFTO0FBQUEsUUFDUCxRQUFRO0FBQUEsTUFDVjtBQUFBLElBQ0YsQ0FBQztBQUFBLElBQ0QsdUJBQXVCO0FBQUEsRUFDekI7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxJQUNYLGNBQWM7QUFBQSxJQUNkLGVBQWU7QUFBQSxNQUNiLE9BQU87QUFBQSxRQUNMLE9BQU8sUUFBUSxrQ0FBVyxZQUFZO0FBQUEsUUFDdEMsU0FBUyxRQUFRLGtDQUFXLGNBQWM7QUFBQSxRQUMxQyxnQkFBZ0IsUUFBUSxrQ0FBVyxtQkFBbUI7QUFBQSxRQUN0RCxnQkFBZ0IsUUFBUSxrQ0FBVyx1QkFBdUI7QUFBQSxNQUM1RDtBQUFBLE1BQ0EsUUFBUTtBQUFBLFFBQ04sZ0JBQWdCO0FBQUEsUUFDaEIsZ0JBQWdCO0FBQUEsUUFDaEIsZ0JBQWdCO0FBQUEsUUFDaEIsS0FBSztBQUFBLE1BQ1A7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
