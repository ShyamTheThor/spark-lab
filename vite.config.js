import { defineConfig, loadEnv } from "vite";
import { createTranslationHandler } from "./server/bhashini.mjs";
import { createAIHandler } from "./server/ai.mjs";
import { VitePWA } from "vite-plugin-pwa";

const base = process.env.DEPLOY_BASE || "./";

export default defineConfig(({mode}) => ({
  base,
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "three";
        },
      },
    },
  },
  plugins: [
    { name: "spark-translation-server", configureServer(server) {
      const env={...loadEnv(mode, process.cwd(), "BHASHINI_"),...process.env};
      server.middlewares.use(createAIHandler({env:{...loadEnv(mode, process.cwd(), ""),...process.env}}));
      server.middlewares.use(createTranslationHandler({env}));
    }, configurePreviewServer(server) {
      const env={...loadEnv(mode, process.cwd(), "BHASHINI_"),...process.env};
      server.middlewares.use(createAIHandler({env:{...loadEnv(mode, process.cwd(), ""),...process.env}}));
      server.middlewares.use(createTranslationHandler({env}));
    } },
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["icons/icon-192.png", "icons/apple-touch-icon.png", "favicon.svg"],
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,jpeg,woff2,glb,gltf,bin,json}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "spark-font-styles",
              expiration: { maxEntries: 8, maxAgeSeconds: 31536000 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "spark-font-files",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 20, maxAgeSeconds: 31536000 },
            },
          },
        ],
      },
      manifest: {
        name: "SparkLab — Interactive 3D STEM Lab",
        short_name: "SparkLab",
        description:
          "A free, interactive 3D science lab: physics, chemistry, biology and math you can touch — works 100% offline.",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: base,
        scope: base,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
}));
