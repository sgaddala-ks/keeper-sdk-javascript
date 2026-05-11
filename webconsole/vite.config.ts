import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: ".",
  build: {
    target: "es2017",
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "KeeperWebConsole",
      formats: ["es", "umd"],
      fileName: (format) =>
        format === "umd" ? "keeper-webconsole.umd.cjs" : "keeper-webconsole.es.js",
    },
    rollupOptions: {
      output: {
        exports: "named",
        assetFileNames: "keeper-webconsole.[ext]",
      },
    },
    sourcemap: true,
  },
  server: {
    port: 5174,
    proxy: {
      "/api": "http://127.0.0.1:3042",
    },
  },
});
