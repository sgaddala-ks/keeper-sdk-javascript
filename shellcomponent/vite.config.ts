import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: ".",
  resolve: {
    alias: {
      "@keeper-security/keeper-sdk-javascript": resolve(__dirname, "../KeeperSdk/src/browser.ts"),
      "fs/promises": resolve(__dirname, "src/shims/fs-promises-empty.ts"),
      fs: resolve(__dirname, "src/shims/fs-empty.ts"),
      path: resolve(__dirname, "node_modules/path-browserify/index.js"),
      os: resolve(__dirname, "src/shims/os-homedir.ts"),
      buffer: "buffer/",
    },
  },
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    include: [
      "@keeper-security/keeper-sdk-javascript",
      "@keeper-security/keeperapi",
      "@xterm/xterm",
      "@xterm/addon-fit",
      "buffer",
      "protobufjs",
    ],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  build: {
    target: "es2017",
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "KeeperShell",
      formats: ["es", "umd"],
      fileName: (format) =>
        format === "umd" ? "keeper-shell.umd.cjs" : "keeper-shell.es.js",
    },
    rollupOptions: {
      output: {
        exports: "named",
        assetFileNames: "keeper-shell.[ext]",
      },
    },
    sourcemap: true,
  },
  server: {
    port: 5175,
    fs: {
      allow: [__dirname, resolve(__dirname, "..")],
    },
  },
});
