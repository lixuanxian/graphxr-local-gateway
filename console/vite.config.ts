import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/console/",
  build: {
    outDir: "../public/console",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:19285",
      "/health": "http://127.0.0.1:19285",
      "/catalog": "http://127.0.0.1:19285",
      "/graph": "http://127.0.0.1:19285",
      "/pair": "http://127.0.0.1:19285",
    },
  },
});
