import { bindings, defineConfig } from 'cf/config'

export default defineConfig(({ mode }) => ({
  worker: {
    name: 'home-nav',
    entrypoint: './worker/index.ts',
    compatibilityDate: '2026-10-27',
    compatibilityFlags: ['nodejs_compat'],
    domains: ['index.yaemiko.lol'],
    workersDev: false,
    previewUrls: false,
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({ name: 'home-nav', id: 'bf1c9c30-2d7a-4f11-8f1f-0fe587026ff3' }),
      ADMIN_PASSWORD: bindings.secret(),
      SESSION_SECRET: bindings.secret(),
      TURNSTILE_SECRET: bindings.secret(),
      TURNSTILE_SITE_KEY: bindings.text(mode === 'development' ? '1x00000000000000000000AA' : '0x4AAAAAAFoQuEqMCcs9svVR'),
    },
    assets: { notFoundHandling: 'single-page-application', runWorkerFirst: ['/api/*'] },
    observability: { enabled: true, logs: { enabled: true }, traces: { enabled: true, headSamplingRate: 0.01 } },
  },
}))
