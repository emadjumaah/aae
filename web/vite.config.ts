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
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        playground: resolve(__dirname, "playground.html"),
        benchmark: resolve(__dirname, "benchmark.html"),
        usecases: resolve(__dirname, "usecases.html"),
      },
    },
  },
});
