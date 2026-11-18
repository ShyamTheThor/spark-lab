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
      devOptions: {
        enabled: true,
        type: "module",
      },
      includeAssets: [
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/maskable-512.png",
        "icons/apple-touch-icon.png",
        "favicon.svg",
      ],
      workbox: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,jpeg,woff2,glb,gltf,bin,json}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "spark-font-styles",
              expiration: { maxEntries: 10, maxAgeSeconds: 31536000 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "spark-font-files",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 30, maxAgeSeconds: 31536000 },
            },
          },
        ],
      },
      manifest: {
        id: "/",
        name: "SparkLab — Interactive 3D STEM Lab",
        short_name: "SparkLab",
        description:
          "Free interactive 3D STEM lab for Classes 1–12. Works 100% offline.",
        theme_color: "#0f766e",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "any",
        start_url: "./index.html",
        scope: "./",
        categories: ["education", "science"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
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
