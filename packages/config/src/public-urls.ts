/** URLs públicas de produção — sync com `vars` nos wrangler.jsonc dos workers. */
export const workerVarsProduction = {
  WEB_URL: "https://web.whasap.com.br",
  OFFICE_URL: "https://office.whasap.com.br",
  WEBHOOK_URL: "https://webhook.whasap.com.br",
  CDN_URL: "https://cdn.whasap.com.br",
  EMAIL_FROM: "noreply@whasap.com.br",
} as const;

/** Overrides locais — copiar para `.dev.vars` de cada app (não commitar). */
export const workerVarsDevelopment = {
  WEB_URL: "http://localhost:3000",
  OFFICE_URL: "http://localhost:3001",
  WEBHOOK_URL: "http://localhost:8788",
  CDN_URL: "http://localhost:8789",
  EMAIL_FROM: "noreply@localhost",
} as const;

/** Variáveis Vite embutidas no bundle em `vite build` (modo production). */
export const viteVarsProduction = {
  VITE_WEB_PANEL_URL: workerVarsProduction.WEB_URL,
} as const;
