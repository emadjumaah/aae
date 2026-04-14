import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "@engine": resolve(__dirname, "../src/engine"),
      "@src": resolve(__dirname, "../src"),
    },
  },
  optimizeDeps: {
    exclude: ["onnxruntime-web"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        usecases: resolve(__dirname, "usecases.html"),
        chat: resolve(__dirname, "chat.html"),
      },
    },
  },
});
