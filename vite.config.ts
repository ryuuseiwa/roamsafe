import { defineConfig } from "vite";
export default defineConfig({
  define: { "process.env": {} },
  server: { host: "0.0.0.0", port: 5173, strictPort: true },
  build: { outDir: "dist" }
});
