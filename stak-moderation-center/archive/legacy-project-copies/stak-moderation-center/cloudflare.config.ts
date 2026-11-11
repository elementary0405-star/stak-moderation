import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "stak-moderation-center",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-08",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      VINEXT_KV_CACHE: bindings.kv(),
      DB: bindings.d1({ name: "stak-moderation-db" }),
    },
  }),
});
