// @ts-check
import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  output: "server",
  adapter: node({
    mode: "standalone",
  }),
  vite: {
    server: {
      allowedHosts: true,
    },
    // Zorg dat html5-qrcode bij opstarten gebundeld wordt (niet pas bij eerste request)
    optimizeDeps: {
      include: ["html5-qrcode"],
    },
  },
});
