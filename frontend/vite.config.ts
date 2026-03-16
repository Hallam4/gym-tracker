import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "child_process";

function getVersion(): string {
  try {
    // Deepen shallow clone (Render uses depth=1)
    try { execSync("git fetch --depth=10000 2>/dev/null"); } catch {}
    const count = execSync("git rev-list --count HEAD").toString().trim();
    const n = parseInt(count);
    if (n > 1) return `0.${n}.0`;
  } catch {}
  // Fallback: use commit short hash
  const sha = process.env.RENDER_GIT_COMMIT
    || (() => { try { return execSync("git rev-parse --short HEAD").toString().trim(); } catch { return ""; } })();
  return sha ? `0.0.0-${sha.slice(0, 7)}` : "0.0.0";
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(getVersion()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Gym Tracker",
        short_name: "Gym",
        start_url: "/",
        display: "standalone",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^.*\/api\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
